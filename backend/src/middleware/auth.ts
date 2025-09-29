import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import database from '@/config/database';
import logger from '@/utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    email: string;
    role: string;
  };
}

// Middleware to verify JWT token
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    // Get user from database
    const userResult = await database.executeQuery(`
      SELECT Id, Username, Email, FirstName, LastName, Role, IsActive 
      FROM Users 
      WHERE Id = @userId AND IsActive = 1
    `, { userId: decoded.userId });

    if (userResult.recordset.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Invalid token - user not found'
      });
      return;
    }

    const user = userResult.recordset[0];

    // Attach user to request
    req.user = {
      userId: user.Id,
      username: user.Username,
      email: user.Email,
      role: user.Role
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
      return;
    }

    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Middleware to check if user has required role
export const requireRole = (roles: string | string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
      return;
    }

    next();
  };
};

// Middleware to check if user is admin
export const requireAdmin = requireRole('admin');

// Middleware to check if user is admin or user (not viewer)
export const requireUserOrAdmin = requireRole(['admin', 'user']);

// Optional authentication - doesn't fail if no token provided
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    // Get user from database
    const userResult = await database.executeQuery(`
      SELECT Id, Username, Email, FirstName, LastName, Role, IsActive 
      FROM Users 
      WHERE Id = @userId AND IsActive = 1
    `, { userId: decoded.userId });

    if (userResult.recordset.length > 0) {
      const user = userResult.recordset[0];
      req.user = {
        userId: user.Id,
        username: user.Username,
        email: user.Email,
        role: user.Role
      };
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail on token errors
    next();
  }
};

export default {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireUserOrAdmin,
  optionalAuth
};