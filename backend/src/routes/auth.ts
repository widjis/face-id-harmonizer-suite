import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sql from 'mssql';
import { v4 as uuidv4 } from 'uuid';
import database from '@/config/database';
import logger, { AuditLogger } from '@/utils/logger';
import { CreateUserRequest, LoginRequest, AuthResponse, User } from '@/types';

const router = Router();

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Helper function to generate JWT token
const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

// Helper function to hash password
const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Helper function to verify password
const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

// Register new user
router.post('/register', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, email, password, firstName, lastName, department, role = 'user' }: CreateUserRequest = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      res.status(400).json({
        success: false,
        message: 'Username, email, and password are required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Check if user already exists
    const existingUserQuery = `
      SELECT Id FROM Users 
      WHERE Username = @username OR Email = @email
    `;
    
    const existingUser = await database.executeQuery(existingUserQuery, {
      username,
      email
    });

    if (existingUser.recordset.length > 0) {
      res.status(409).json({
        success: false,
        message: 'User with this username or email already exists',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);
    const userId = uuidv4();

    // Insert new user
    const insertUserQuery = `
      INSERT INTO Users (Id, Username, Email, PasswordHash, FirstName, LastName, Department, Role)
      VALUES (@id, @username, @email, @passwordHash, @firstName, @lastName, @department, @role)
    `;

    await database.executeQuery(insertUserQuery, {
      id: userId,
      username,
      email,
      passwordHash,
      firstName: firstName || null,
      lastName: lastName || null,
      department: department || null,
      role
    });

    // Get created user (without password)
    const getUserQuery = `
      SELECT Id, Username, Email, FirstName, LastName, Department, Role, IsActive, CreatedAt, UpdatedAt
      FROM Users WHERE Id = @userId
    `;
    
    const userResult = await database.executeQuery(getUserQuery, { userId });
    const user = userResult.recordset[0];

    // Generate token
    const token = generateToken(userId);

    // Log audit trail
    const auditQuery = `
      INSERT INTO AuditTrail (UserId, Action, EntityType, EntityId, NewValues, IpAddress, UserAgent)
      VALUES (@userId, @action, @entityType, @entityId, @newValues, @ipAddress, @userAgent)
    `;

    await database.executeQuery(auditQuery, {
      userId,
      action: 'CREATE',
      entityType: 'User',
      entityId: userId,
      newValues: JSON.stringify({ username, email, role }),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    const response: AuthResponse = {
      user,
      token,
      expiresIn: JWT_EXPIRES_IN
    };

    res.status(201).json({
      success: true,
      data: response,
      message: 'User registered successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Registration error:', error);
    next(error);
  }
});

// Login user
router.post('/login', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, password } = req.body;

    // Validate required fields
    if (!username || !password) {
      res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
      return;
    }

    // Find user by username or email
    const userResult = await database.executeQuery(
      'SELECT * FROM Users WHERE (Username = @username OR Email = @username) AND IsActive = 1',
      { username }
    );

    if (userResult.recordset.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
      return;
    }

    const user = userResult.recordset[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.PasswordHash);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
      return;
    }

    // Update last login
    await database.executeQuery(
      'UPDATE Users SET LastLoginAt = GETUTCDATE() WHERE Id = @userId',
      { userId: user.Id }
    );

    // Log audit trail
    AuditLogger.audit({
      userId: user.Id,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.Id,
      details: {
        username: user.Username,
        loginTime: new Date().toISOString()
      }
    });

    // Generate JWT token
    const token = generateToken(user.Id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.Id,
          username: user.Username,
          email: user.Email,
          firstName: user.FirstName,
          lastName: user.LastName,
          role: user.Role,
          lastLoginAt: user.LastLoginAt
        }
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    next(error);
  }
});

// Get current user profile
router.get('/me', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Extract user ID from JWT token (assuming middleware sets req.user)
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Get user details
    const userResult = await database.executeQuery(
      'SELECT Id, Username, Email, FirstName, LastName, Role, CreatedAt, LastLoginAt FROM Users WHERE Id = @userId AND IsActive = 1',
      { userId }
    );

    if (userResult.recordset.length === 0) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    const user = userResult.recordset[0];

    res.json({
      success: true,
      data: {
        user: {
          id: user.Id,
          username: user.Username,
          email: user.Email,
          firstName: user.FirstName,
          lastName: user.LastName,
          role: user.Role,
          createdAt: user.CreatedAt,
          lastLoginAt: user.LastLoginAt
        }
      }
    });
  } catch (error) {
    logger.error('Get user profile error:', error);
    next(error);
  }
});

// Logout (mainly for audit trail)
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
        
        // Log audit trail
        const auditQuery = `
          INSERT INTO AuditTrail (UserId, Action, EntityType, EntityId, IpAddress, UserAgent, Details)
          VALUES (@userId, @action, @entityType, @entityId, @ipAddress, @userAgent, @details)
        `;

        await database.executeQuery(auditQuery, {
          userId: decoded.userId,
          action: 'LOGOUT',
          entityType: 'User',
          entityId: decoded.userId,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          details: 'User logged out'
        });
      } catch (error) {
        // Token might be invalid, but we still want to respond with success
        console.log('Invalid token during logout:', error);
      }
    }

    res.json({
      success: true,
      message: 'Logout successful',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Logout error:', error);
    next(error);
  }
});

export default router;