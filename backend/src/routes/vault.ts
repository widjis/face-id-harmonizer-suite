import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import database from '@/config/database';
import logger, { AuditLogger } from '@/utils/logger';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '@/middleware/auth';
import { 
  VaultConfiguration, 
  CreateVaultConfigRequest, 
  ApiResponse 
} from '@/types';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

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

export default router;