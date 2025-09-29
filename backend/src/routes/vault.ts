import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import database from '@/config/database';
import logger, { AuditLogger } from '@/utils/logger';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '@/middleware/auth';
import vaultApiService from '@/services/vaultApiService';
import { 
  VaultConfiguration, 
  CreateVaultConfigRequest, 
  ApiResponse,
  VaultCardProfile,
  VaultApiResponse
} from '@/types';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @swagger
 * components:
 *   schemas:
 *     VaultConfiguration:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique configuration ID
 *         name:
 *           type: string
 *           description: Configuration name
 *         host:
 *           type: string
 *           description: Vault server host
 *         port:
 *           type: integer
 *           description: Vault server port
 *         isSecure:
 *           type: boolean
 *           description: Whether to use HTTPS
 *         apiVersion:
 *           type: string
 *           description: API version
 *         isActive:
 *           type: boolean
 *           description: Whether this configuration is active
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     VaultCardProfile:
 *       type: object
 *       properties:
 *         cardNo:
 *           type: string
 *           description: Card number
 *         name:
 *           type: string
 *           description: Cardholder name
 *         department:
 *           type: string
 *           description: Department
 *         email:
 *           type: string
 *           description: Email address
 *         photo:
 *           type: string
 *           description: Base64 encoded photo
 */

/**
 * @swagger
 * /api/vault:
 *   get:
 *     summary: Get all vault configurations
 *     tags: [Vault]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vault configurations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VaultConfiguration'
 *                 message:
 *                   type: string
 *                   example: Vault configurations retrieved successfully
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
// GET /api/vault - Get all vault configurations
router.get('/', async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const result = await database.executeQuery(`
      SELECT 
        Id,
        Name,
        Host,
        Port,
        IsSecure,
        ApiVersion,
        IsActive,
        CreatedAt,
        UpdatedAt
      FROM VaultConfigurations
      ORDER BY CreatedAt DESC
    `);

    const configs: VaultConfiguration[] = result.recordset.map(row => ({
      id: row.Id,
      name: row.Name,
      host: row.Host,
      port: row.Port,
      isSecure: row.IsSecure,
      apiVersion: row.ApiVersion,
      isActive: row.IsActive,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt
    }));

    const response: ApiResponse<VaultConfiguration[]> = {
      success: true,
      data: configs,
      message: 'Vault configurations retrieved successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error retrieving vault configurations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve vault configurations'
    });
  }
});

/**
 * @swagger
 * /api/vault/active:
 *   get:
 *     summary: Get active vault configuration
 *     tags: [Vault]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active vault configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/VaultConfiguration'
 *                 message:
 *                   type: string
 *                   example: Active vault configuration retrieved successfully
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Authentication required
 *       404:
 *         description: No active vault configuration found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: No active vault configuration found
 *       500:
 *         description: Internal server error
 */
// GET /api/vault/active - Get active vault configuration
router.get('/active', async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const result = await database.executeQuery(`
      SELECT 
        Id,
        Name,
        Host,
        Port,
        IsSecure,
        ApiVersion,
        IsActive,
        CreatedAt,
        UpdatedAt
      FROM VaultConfigurations
      WHERE IsActive = 1
    `);

    if (result.recordset.length === 0) {
      res.status(404).json({
        success: false,
        message: 'No active vault configuration found'
      });
      return;
    }

    const config = result.recordset[0];
    const vaultConfig: VaultConfiguration = {
      id: config.Id,
      name: config.Name,
      host: config.Host,
      port: config.Port,
      isSecure: config.IsSecure,
      apiVersion: config.ApiVersion,
      isActive: config.IsActive,
      createdAt: config.CreatedAt,
      updatedAt: config.UpdatedAt
    };

    const response: ApiResponse<VaultConfiguration> = {
      success: true,
      data: vaultConfig,
      message: 'Active vault configuration retrieved successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error retrieving active vault configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve active vault configuration'
    });
  }
});

// GET /api/vault/:id - Get vault configuration by ID
router.get('/:id', async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await database.executeQuery(`
      SELECT 
        Id,
        Name,
        Host,
        Port,
        IsSecure,
        ApiVersion,
        IsActive,
        CreatedAt,
        UpdatedAt
      FROM VaultConfigurations
      WHERE Id = @id
    `, { id });

    if (result.recordset.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Vault configuration not found'
      });
      return;
    }

    const config = result.recordset[0];
    const vaultConfig: VaultConfiguration = {
      id: config.Id,
      name: config.Name,
      host: config.Host,
      port: config.Port,
      isSecure: config.IsSecure,
      apiVersion: config.ApiVersion,
      isActive: config.IsActive,
      createdAt: config.CreatedAt,
      updatedAt: config.UpdatedAt
    };

    const response: ApiResponse<VaultConfiguration> = {
      success: true,
      data: vaultConfig,
      message: 'Vault configuration retrieved successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error retrieving vault configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve vault configuration'
    });
  }
});

/**
 * @swagger
 * /api/vault:
 *   post:
 *     summary: Create new vault configuration (Admin only)
 *     tags: [Vault]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - host
 *               - port
 *             properties:
 *               name:
 *                 type: string
 *                 description: Configuration name
 *               host:
 *                 type: string
 *                 description: Vault server host
 *               port:
 *                 type: integer
 *                 description: Vault server port
 *               isSecure:
 *                 type: boolean
 *                 description: Whether to use HTTPS
 *                 default: false
 *               apiVersion:
 *                 type: string
 *                 description: API version
 *                 default: v1
 *               isActive:
 *                 type: boolean
 *                 description: Set as active configuration
 *                 default: false
 *     responses:
 *       201:
 *         description: Vault configuration created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                 message:
 *                   type: string
 *                   example: Vault configuration created successfully
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request - missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Name, host, and port are required
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Internal server error
 */
// POST /api/vault - Create new vault configuration (Admin only)
router.post('/', requireAdmin, async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const { name, host, port, isSecure, apiVersion }: CreateVaultConfigRequest = req.body;

    // Validate required fields
    if (!name || !host || !port) {
      res.status(400).json({
        success: false,
        message: 'Name, host, and port are required'
      });
      return;
    }

    const configId = uuidv4();
    const now = new Date();

    // If this is set as active, deactivate others
    let isActive = false;
    if (req.body.isActive) {
      await database.executeQuery(`
        UPDATE VaultConfigurations 
        SET IsActive = 0, UpdatedAt = @now
      `, { now });
      isActive = true;
    }

    // Create new vault configuration
    await database.executeQuery(`
      INSERT INTO VaultConfigurations (
        Id, Name, Host, Port, IsSecure, ApiVersion, IsActive, CreatedAt, UpdatedAt
      ) VALUES (
        @id, @name, @host, @port, @isSecure, @apiVersion, @isActive, @now, @now
      )
    `, {
      id: configId,
      name,
      host,
      port,
      isSecure: isSecure || false,
      apiVersion: apiVersion || 'v1',
      isActive,
      now
    });

    // Log audit trail
    await AuditLogger.audit({
      userId: req.user!.userId,
      action: 'CREATE_VAULT_CONFIG',
      entityType: 'VaultConfiguration',
      entityId: configId,
      details: { name, host, port, isActive },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || ''
    });

    const response: ApiResponse<{ id: string }> = {
      success: true,
      data: { id: configId },
      message: 'Vault configuration created successfully',
      timestamp: new Date().toISOString()
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating vault configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create vault configuration'
    });
  }
});

// PUT /api/vault/:id - Update vault configuration (Admin only)
router.put('/:id', requireAdmin, async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, host, port, isSecure, apiVersion, isActive } = req.body;

    // Check if configuration exists
    const existingResult = await database.executeQuery(`
      SELECT Id FROM VaultConfigurations WHERE Id = @id
    `, { id });

    if (existingResult.recordset.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Vault configuration not found'
      });
      return;
    }

    const now = new Date();

    // If setting as active, deactivate others
    if (isActive) {
      await database.executeQuery(`
        UPDATE VaultConfigurations 
        SET IsActive = 0, UpdatedAt = @now
        WHERE Id != @id
      `, { now, id });
    }

    // Build dynamic update query
    const updateFields: string[] = [];
    const params: any = { id, now };

    if (name !== undefined) {
      updateFields.push('Name = @name');
      params.name = name;
    }
    if (host !== undefined) {
      updateFields.push('Host = @host');
      params.host = host;
    }
    if (port !== undefined) {
      updateFields.push('Port = @port');
      params.port = port;
    }
    if (isSecure !== undefined) {
      updateFields.push('IsSecure = @isSecure');
      params.isSecure = isSecure;
    }
    if (apiVersion !== undefined) {
      updateFields.push('ApiVersion = @apiVersion');
      params.apiVersion = apiVersion;
    }
    if (isActive !== undefined) {
      updateFields.push('IsActive = @isActive');
      params.isActive = isActive;
    }

    if (updateFields.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
      return;
    }

    updateFields.push('UpdatedAt = @now');

    await database.executeQuery(`
      UPDATE VaultConfigurations 
      SET ${updateFields.join(', ')}
      WHERE Id = @id
    `, params);

    // Log audit trail
    await AuditLogger.audit({
      userId: req.user!.userId,
      action: 'UPDATE_VAULT_CONFIG',
      entityType: 'VaultConfiguration',
      entityId: id,
      details: req.body,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || ''
    });

    res.json({
      success: true,
      message: 'Vault configuration updated successfully'
    });
  } catch (error) {
    logger.error('Error updating vault configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update vault configuration'
    });
  }
});

// DELETE /api/vault/:id - Delete vault configuration (Admin only)
router.delete('/:id', requireAdmin, async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if configuration exists
    const existingResult = await database.executeQuery(`
      SELECT Id, Name FROM VaultConfigurations WHERE Id = @id
    `, { id });

    if (existingResult.recordset.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Vault configuration not found'
      });
      return;
    }

    const config = existingResult.recordset[0];

    // Check if there are any batches using this configuration
    const batchResult = await database.executeQuery(`
      SELECT COUNT(*) as count FROM ProcessingBatches WHERE VaultConfigId = @id
    `, { id });

    if (batchResult.recordset[0].count > 0) {
      res.status(400).json({
        success: false,
        message: 'Cannot delete vault configuration that is being used by processing batches'
      });
      return;
    }

    // Delete the configuration
    await database.executeQuery(`
      DELETE FROM VaultConfigurations WHERE Id = @id
    `, { id });

    // Log audit trail
    await AuditLogger.audit({
      userId: req.user!.userId,
      action: 'DELETE_VAULT_CONFIG',
      entityType: 'VaultConfiguration',
      entityId: id,
      details: { name: config.Name },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || ''
    });

    res.json({
      success: true,
      message: 'Vault configuration deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting vault configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete vault configuration'
    });
  }
});

// POST /api/vault/:id/activate - Activate vault configuration (Admin only)
router.post('/:id/activate', requireAdmin, async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if configuration exists
    const existingResult = await database.executeQuery(`
      SELECT Id, Name FROM VaultConfigurations WHERE Id = @id
    `, { id });

    if (existingResult.recordset.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Vault configuration not found'
      });
      return;
    }

    const now = new Date();

    // Deactivate all configurations
    await database.executeQuery(`
      UPDATE VaultConfigurations 
      SET IsActive = 0, UpdatedAt = @now
    `, { now });

    // Activate the selected configuration
    await database.executeQuery(`
      UPDATE VaultConfigurations 
      SET IsActive = 1, UpdatedAt = @now
      WHERE Id = @id
    `, { now, id });

    // Log audit trail
    await AuditLogger.audit({
      userId: req.user!.userId,
      action: 'ACTIVATE_VAULT_CONFIG',
      entityType: 'VaultConfiguration',
      entityId: id,
      details: { name: existingResult.recordset[0].Name },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || ''
    });

    res.json({
      success: true,
      message: 'Vault configuration activated successfully'
    });
  } catch (error) {
    logger.error('Error activating vault configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate vault configuration'
    });
  }
});

// POST /api/vault/test-connection - Test connection to active vault configuration
router.post('/test-connection', async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    
    const result = await vaultApiService.testConnection(userId);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        success: false,
        message: result.error || 'Failed to connect to Vault system',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Error testing vault connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test vault connection'
    });
  }
});

// POST /api/vault/cards - Create a new card in the Vault system
/**
 * @swagger
 * /api/vault/cards:
 *   post:
 *     summary: Create a new vault card
 *     tags: [Vault]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cardProfile
 *             properties:
 *               cardProfile:
 *                 $ref: '#/components/schemas/VaultCardProfile'
 *               batchId:
 *                 type: string
 *                 description: Associated batch ID
 *               employeeId:
 *                 type: string
 *                 description: Associated employee ID
 *     responses:
 *       201:
 *         description: Vault card created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     cardId:
 *                       type: string
 *                     cardNumber:
 *                       type: string
 *                 message:
 *                   type: string
 *                   example: Vault card created successfully
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request - missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Card number, first name, last name, and employee ID are required
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.post('/cards', async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { cardProfile, batchId, employeeId }: { 
      cardProfile: VaultCardProfile; 
      batchId?: string; 
      employeeId?: string; 
    } = req.body;

    // Validate required fields
    if (!cardProfile || !cardProfile.CardNumber || !cardProfile.FirstName || 
        !cardProfile.LastName || !cardProfile.EmployeeId) {
      res.status(400).json({
        success: false,
        message: 'Card number, first name, last name, and employee ID are required'
      });
      return;
    }

    const result = await vaultApiService.addCard(cardProfile, userId, batchId, employeeId);
    
    if (result.success) {
      // Update employee record if employeeId is provided
      if (employeeId) {
        try {
          await database.executeQuery(`
            UPDATE Employees 
            SET VaultCardCreated = 1, VaultCardId = @cardId, UpdatedAt = GETUTCDATE()
            WHERE Id = @employeeId
          `, { 
            cardId: result.cardId, 
            employeeId 
          });

          // Log audit trail
          await AuditLogger.audit({
            userId,
            action: 'VAULT_API_CALL',
            entityType: 'Employee',
            entityId: employeeId,
            details: {
              action: 'CREATE_VAULT_CARD',
              cardNumber: cardProfile.CardNumber,
              cardId: result.cardId
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent') || ''
          });
        } catch (dbError) {
          logger.error('Failed to update employee record after card creation:', dbError);
          // Don't fail the request as the card was created successfully
        }
      }

      res.status(201).json({
        success: true,
        data: {
          cardId: result.cardId,
          cardNumber: cardProfile.CardNumber
        },
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to create card in Vault system',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Error creating vault card:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create vault card'
    });
  }
});

// GET /api/vault/cards/:cardNumber - Retrieve card information from Vault system
router.get('/cards/:cardNumber', async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { cardNumber } = req.params;
    const { batchId, employeeId } = req.query;

    if (!cardNumber) {
      res.status(400).json({
        success: false,
        message: 'Card number is required'
      });
      return;
    }

    const result = await vaultApiService.getCard(
      cardNumber, 
      userId, 
      batchId as string, 
      employeeId as string
    );
    
    if (result.success) {
      res.json({
        success: true,
        data: {
          cardId: result.cardId,
          cardProfile: result.cardProfile
        },
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.error || 'Card not found in Vault system',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Error retrieving vault card:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve vault card'
    });
  }
});

// DELETE /api/vault/cards/:cardNumber - Delete card from Vault system
router.delete('/cards/:cardNumber', async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { cardNumber } = req.params;
    const { batchId, employeeId } = req.query;

    if (!cardNumber) {
      res.status(400).json({
        success: false,
        message: 'Card number is required'
      });
      return;
    }

    const result = await vaultApiService.deleteCard(
      cardNumber, 
      userId, 
      batchId as string, 
      employeeId as string
    );
    
    if (result.success) {
      // Update employee record if employeeId is provided
      if (employeeId) {
        try {
          await database.executeQuery(`
            UPDATE Employees 
            SET VaultCardCreated = 0, VaultCardId = NULL, UpdatedAt = GETUTCDATE()
            WHERE Id = @employeeId
          `, { employeeId });

          // Log audit trail
          await AuditLogger.audit({
            userId,
            action: 'VAULT_API_CALL',
            entityType: 'Employee',
            entityId: employeeId as string,
            details: {
              action: 'DELETE_VAULT_CARD',
              cardNumber
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent') || ''
          });
        } catch (dbError) {
          logger.error('Failed to update employee record after card deletion:', dbError);
          // Don't fail the request as the card was deleted successfully
        }
      }

      res.json({
        success: true,
        data: {
          cardId: result.cardId,
          cardNumber
        },
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to delete card from Vault system',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Error deleting vault card:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete vault card'
    });
  }
});

// POST /api/vault/cards/batch - Batch process multiple card operations
router.post('/cards/batch', async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { operations, batchId }: { 
      operations: Array<{
        operation: 'add' | 'delete';
        cardProfile?: VaultCardProfile;
        cardNumber?: string;
        employeeId?: string;
      }>;
      batchId?: string;
    } = req.body;

    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Operations array is required and cannot be empty'
      });
      return;
    }

    // Validate operations
    for (const op of operations) {
      if (op.operation === 'add' && !op.cardProfile) {
        res.status(400).json({
          success: false,
          message: 'Card profile is required for add operations'
        });
        return;
      }
      if (op.operation === 'delete' && !op.cardNumber) {
        res.status(400).json({
          success: false,
          message: 'Card number is required for delete operations'
        });
        return;
      }
    }

    const results = await vaultApiService.batchProcessCards(operations, userId, batchId);
    
    // Update employee records for successful operations
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const operation = operations[i];
      
      if (result.success && operation.employeeId) {
        try {
          if (operation.operation === 'add') {
            await database.executeQuery(`
              UPDATE Employees 
              SET VaultCardCreated = 1, VaultCardId = @cardId, UpdatedAt = GETUTCDATE()
              WHERE Id = @employeeId
            `, { 
              cardId: result.cardId, 
              employeeId: operation.employeeId 
            });
          } else if (operation.operation === 'delete') {
            await database.executeQuery(`
              UPDATE Employees 
              SET VaultCardCreated = 0, VaultCardId = NULL, UpdatedAt = GETUTCDATE()
              WHERE Id = @employeeId
            `, { employeeId: operation.employeeId });
          }

          // Log audit trail
          await AuditLogger.audit({
            userId,
            action: 'VAULT_API_CALL',
            entityType: 'Employee',
            entityId: operation.employeeId,
            details: {
              action: `BATCH_${operation.operation.toUpperCase()}_VAULT_CARD`,
              cardNumber: result.cardNumber,
              batchId
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent') || ''
          });
        } catch (dbError) {
          logger.error(`Failed to update employee record for ${operation.operation} operation:`, dbError);
          // Don't fail the request as the vault operation was successful
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    res.json({
      success: failureCount === 0,
      data: {
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failureCount
        }
      },
      message: failureCount === 0 
        ? `All ${results.length} operations completed successfully`
        : `${successCount} operations succeeded, ${failureCount} failed`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error processing batch card operations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process batch card operations'
    });
  }
});

export default router;