import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import database from '@/config/database';
import logger, { AuditLogger } from '@/utils/logger';
import { ProcessingBatch, CreateBatchRequest, UpdateBatchRequest } from '@/types';

const router = Router();

// Get all batches for the current user
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const result = await database.executeQuery(`
      SELECT 
        pb.*,
        u.Username as CreatedByUsername,
        (SELECT COUNT(*) FROM Employees WHERE BatchId = pb.Id) as EmployeeCount
      FROM ProcessingBatches pb
      LEFT JOIN Users u ON pb.CreatedBy = u.Id
      WHERE pb.CreatedBy = @userId
      ORDER BY pb.CreatedAt DESC
    `, { userId });

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    logger.error('Get batches error:', error);
    next(error);
  }
});

// Get a specific batch by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const batchId = req.params.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const result = await database.executeQuery(`
      SELECT 
        pb.*,
        u.Username as CreatedByUsername
      FROM ProcessingBatches pb
      LEFT JOIN Users u ON pb.CreatedBy = u.Id
      WHERE pb.Id = @batchId AND pb.CreatedBy = @userId
    `, { batchId, userId });

    if (result.recordset.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
      return;
    }

    // Get employees in this batch
    const employeesResult = await database.executeQuery(`
      SELECT * FROM Employees WHERE BatchId = @batchId ORDER BY CreatedAt ASC
    `, { batchId });

    const batch = result.recordset[0];
    batch.employees = employeesResult.recordset;

    res.json({
      success: true,
      data: batch
    });
  } catch (error) {
    logger.error('Get batch error:', error);
    next(error);
  }
});

// Create a new batch
router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { name, description, vaultConfigId }: CreateBatchRequest = req.body;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Batch name is required'
      });
      return;
    }

    const batchId = uuidv4();
    
    await database.executeQuery(`
      INSERT INTO ProcessingBatches (
        Id, Name, Description, Status, CreatedBy, VaultConfigId
      ) VALUES (
        @batchId, @name, @description, 'Draft', @userId, @vaultConfigId
      )
    `, {
      batchId,
      name,
      description: description || null,
      userId,
      vaultConfigId: vaultConfigId || null
    });

    // Log audit trail
    AuditLogger.audit({
      userId,
      action: 'BATCH_CREATED',
      entityType: 'ProcessingBatch',
      entityId: batchId,
      details: {
        batchName: name,
        description
      }
    });

    // Get the created batch
    const result = await database.executeQuery(`
      SELECT 
        pb.*,
        u.Username as CreatedByUsername
      FROM ProcessingBatches pb
      LEFT JOIN Users u ON pb.CreatedBy = u.Id
      WHERE pb.Id = @batchId
    `, { batchId });

    res.status(201).json({
      success: true,
      message: 'Batch created successfully',
      data: result.recordset[0]
    });
  } catch (error) {
    logger.error('Create batch error:', error);
    next(error);
  }
});

// Update a batch
router.put('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const batchId = req.params.id;
    const { name, description, status, vaultConfigId }: UpdateBatchRequest = req.body;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Check if batch exists and belongs to user
    const existingBatch = await database.executeQuery(`
      SELECT * FROM ProcessingBatches WHERE Id = @batchId AND CreatedBy = @userId
    `, { batchId, userId });

    if (existingBatch.recordset.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
      return;
    }

    const oldBatch = existingBatch.recordset[0];

    // Build update query dynamically
    const updates: string[] = [];
    const params: Record<string, any> = { batchId, userId };

    if (name !== undefined) {
      updates.push('Name = @name');
      params.name = name;
    }
    if (description !== undefined) {
      updates.push('Description = @description');
      params.description = description;
    }
    if (status !== undefined) {
      updates.push('Status = @status');
      params.status = status;
    }
    if (vaultConfigId !== undefined) {
      updates.push('VaultConfigId = @vaultConfigId');
      params.vaultConfigId = vaultConfigId;
    }

    if (updates.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
      return;
    }

    updates.push('UpdatedAt = GETUTCDATE()');

    await database.executeQuery(`
      UPDATE ProcessingBatches 
      SET ${updates.join(', ')}
      WHERE Id = @batchId AND CreatedBy = @userId
    `, params);

    // Log audit trail
    AuditLogger.audit({
      userId,
      action: 'BATCH_UPDATED',
      entityType: 'ProcessingBatch',
      entityId: batchId,
      details: {
        oldValues: {
          name: oldBatch.Name,
          description: oldBatch.Description,
          status: oldBatch.Status,
          vaultConfigId: oldBatch.VaultConfigId
        },
        newValues: {
          name: name !== undefined ? name : oldBatch.Name,
          description: description !== undefined ? description : oldBatch.Description,
          status: status !== undefined ? status : oldBatch.Status,
          vaultConfigId: vaultConfigId !== undefined ? vaultConfigId : oldBatch.VaultConfigId
        }
      }
    });

    // Get updated batch
    const result = await database.executeQuery(`
      SELECT 
        pb.*,
        u.Username as CreatedByUsername
      FROM ProcessingBatches pb
      LEFT JOIN Users u ON pb.CreatedBy = u.Id
      WHERE pb.Id = @batchId
    `, { batchId });

    res.json({
      success: true,
      message: 'Batch updated successfully',
      data: result.recordset[0]
    });
  } catch (error) {
    logger.error('Update batch error:', error);
    next(error);
  }
});

// Delete a batch
router.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const batchId = req.params.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Check if batch exists and belongs to user
    const existingBatch = await database.executeQuery(`
      SELECT * FROM ProcessingBatches WHERE Id = @batchId AND CreatedBy = @userId
    `, { batchId, userId });

    if (existingBatch.recordset.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
      return;
    }

    const batch = existingBatch.recordset[0];

    // Check if batch has employees
    const employeeCount = await database.executeQuery(`
      SELECT COUNT(*) as count FROM Employees WHERE BatchId = @batchId
    `, { batchId });

    if (employeeCount.recordset[0].count > 0) {
      res.status(400).json({
        success: false,
        message: 'Cannot delete batch with employees. Remove all employees first.'
      });
      return;
    }

    // Delete the batch
    await database.executeQuery(`
      DELETE FROM ProcessingBatches WHERE Id = @batchId AND CreatedBy = @userId
    `, { batchId, userId });

    // Log audit trail
    AuditLogger.audit({
      userId,
      action: 'BATCH_DELETED',
      entityType: 'ProcessingBatch',
      entityId: batchId,
      details: {
        batchName: batch.Name,
        description: batch.Description
      }
    });

    res.json({
      success: true,
      message: 'Batch deleted successfully'
    });
  } catch (error) {
    logger.error('Delete batch error:', error);
    next(error);
  }
});

// Get batch statistics
router.get('/:id/stats', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const batchId = req.params.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Check if batch exists and belongs to user
    const batchResult = await database.executeQuery(`
      SELECT * FROM ProcessingBatches WHERE Id = @batchId AND CreatedBy = @userId
    `, { batchId, userId });

    if (batchResult.recordset.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
      return;
    }

    // Get statistics
    const statsResult = await database.executeQuery(`
      SELECT 
        COUNT(*) as totalEmployees,
        COUNT(CASE WHEN CardNumber IS NOT NULL THEN 1 END) as employeesWithCards,
        COUNT(CASE WHEN CardNumber IS NULL THEN 1 END) as employeesWithoutCards,
        COUNT(CASE WHEN ProcessedAt IS NOT NULL THEN 1 END) as processedEmployees,
        COUNT(CASE WHEN ProcessedAt IS NULL THEN 1 END) as pendingEmployees
      FROM Employees 
      WHERE BatchId = @batchId
    `, { batchId });

    const stats = statsResult.recordset[0];

    res.json({
      success: true,
      data: {
        batchId,
        totalEmployees: stats.totalEmployees,
        employeesWithCards: stats.employeesWithCards,
        employeesWithoutCards: stats.employeesWithoutCards,
        processedEmployees: stats.processedEmployees,
        pendingEmployees: stats.pendingEmployees,
        completionPercentage: stats.totalEmployees > 0 
          ? Math.round((stats.processedEmployees / stats.totalEmployees) * 100) 
          : 0
      }
    });
  } catch (error) {
    logger.error('Get batch stats error:', error);
    next(error);
  }
});

export default router;