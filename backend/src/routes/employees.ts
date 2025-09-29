import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import database from '@/config/database';
import logger, { AuditLogger } from '@/utils/logger';
import { Employee, CreateEmployeeRequest, UpdateEmployeeRequest } from '@/types';

const router = Router();

// Get all employees in a batch
router.get('/batch/:batchId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const batchId = req.params.batchId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Verify batch belongs to user
    const batchResult = await database.executeQuery(`
      SELECT Id FROM ProcessingBatches WHERE Id = @batchId AND CreatedBy = @userId
    `, { batchId, userId });

    if (batchResult.recordset.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
      return;
    }

    // Get employees
    const result = await database.executeQuery(`
      SELECT * FROM Employees WHERE BatchId = @batchId ORDER BY CreatedAt ASC
    `, { batchId });

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    logger.error('Get employees error:', error);
    next(error);
  }
});

// Get a specific employee
router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const employeeId = req.params.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Get employee with batch verification
    const result = await database.executeQuery(`
      SELECT e.* FROM Employees e
      INNER JOIN ProcessingBatches pb ON e.BatchId = pb.Id
      WHERE e.Id = @employeeId AND pb.CreatedBy = @userId
    `, { employeeId, userId });

    if (result.recordset.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
      return;
    }

    res.json({
      success: true,
      data: result.recordset[0]
    });
  } catch (error) {
    logger.error('Get employee error:', error);
    next(error);
  }
});

// Create a new employee
router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const {
      batchId,
      employeeId,
      name,
      department,
      section,
      jobTitle,
      messHall,
      email,
      imageFileName,
      processedImageUrl
    }: CreateEmployeeRequest & { batchId: string } = req.body;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (!batchId || !employeeId || !name) {
      res.status(400).json({
        success: false,
        message: 'Batch ID, Employee ID, and name are required'
      });
      return;
    }

    // Verify batch belongs to user
    const batchResult = await database.executeQuery(`
      SELECT Id FROM ProcessingBatches WHERE Id = @batchId AND CreatedBy = @userId
    `, { batchId, userId });

    if (batchResult.recordset.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
      return;
    }

    // Check if employee ID already exists in this batch
    const existingEmployee = await database.executeQuery(`
      SELECT Id FROM Employees WHERE BatchId = @batchId AND EmployeeId = @employeeId
    `, { batchId, employeeId });

    if (existingEmployee.recordset.length > 0) {
      res.status(409).json({
        success: false,
        message: 'Employee ID already exists in this batch'
      });
      return;
    }

    const newEmployeeId = uuidv4();
    
    await database.executeQuery(`
      INSERT INTO Employees (
        Id, BatchId, EmployeeId, Name, Department, Section, JobTitle, 
        MessHall, Email, ImageFileName, ProcessedImageUrl, CardAssigned, VaultCardCreated
      ) VALUES (
        @id, @batchId, @employeeId, @name, @department, @section, @jobTitle,
        @messHall, @email, @imageFileName, @processedImageUrl, 0, 0
      )
    `, {
      id: newEmployeeId,
      batchId,
      employeeId,
      name,
      department: department || null,
      section: section || null,
      jobTitle: jobTitle || null,
      messHall: messHall || null,
      email: email || null,
      imageFileName: imageFileName || null,
      processedImageUrl: processedImageUrl || null
    });

    // Log audit trail
    AuditLogger.audit({
      userId,
      action: 'CREATE',
      entityType: 'Employee',
      entityId: newEmployeeId,
      details: {
        batchId,
        employeeId,
        name,
        department,
        section,
        jobTitle
      }
    });

    // Get the created employee
    const result = await database.executeQuery(`
      SELECT * FROM Employees WHERE Id = @id
    `, { id: newEmployeeId });

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: result.recordset[0]
    });
  } catch (error) {
    logger.error('Create employee error:', error);
    next(error);
  }
});

// Update an employee
router.put('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const employeeId = req.params.id;
    const updateData: UpdateEmployeeRequest = req.body;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Get existing employee with batch verification
    const existingResult = await database.executeQuery(`
      SELECT e.* FROM Employees e
      INNER JOIN ProcessingBatches pb ON e.BatchId = pb.Id
      WHERE e.Id = @employeeId AND pb.CreatedBy = @userId
    `, { employeeId, userId });

    if (existingResult.recordset.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
      return;
    }

    const existingEmployee = existingResult.recordset[0];

    // Build update query dynamically
    const updates: string[] = [];
    const params: Record<string, any> = { employeeId };

    if (updateData.name !== undefined) {
      updates.push('Name = @name');
      params.name = updateData.name;
    }
    if (updateData.department !== undefined) {
      updates.push('Department = @department');
      params.department = updateData.department;
    }
    if (updateData.section !== undefined) {
      updates.push('Section = @section');
      params.section = updateData.section;
    }
    if (updateData.jobTitle !== undefined) {
      updates.push('JobTitle = @jobTitle');
      params.jobTitle = updateData.jobTitle;
    }
    if (updateData.messHall !== undefined) {
      updates.push('MessHall = @messHall');
      params.messHall = updateData.messHall;
    }
    if (updateData.email !== undefined) {
      updates.push('Email = @email');
      params.email = updateData.email;
    }
    if (updateData.cardNumber !== undefined) {
      updates.push('CardNumber = @cardNumber');
      params.cardNumber = updateData.cardNumber;
      
      // Update card assigned status
      updates.push('CardAssigned = @cardAssigned');
      params.cardAssigned = updateData.cardNumber ? 1 : 0;
    }
    if (updateData.cardAssigned !== undefined) {
      updates.push('CardAssigned = @cardAssigned');
      params.cardAssigned = updateData.cardAssigned ? 1 : 0;
    }
    if (updateData.vaultCardCreated !== undefined) {
      updates.push('VaultCardCreated = @vaultCardCreated');
      params.vaultCardCreated = updateData.vaultCardCreated ? 1 : 0;
    }
    if (updateData.vaultCardId !== undefined) {
      updates.push('VaultCardId = @vaultCardId');
      params.vaultCardId = updateData.vaultCardId;
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
      UPDATE Employees 
      SET ${updates.join(', ')}
      WHERE Id = @employeeId
    `, params);

    // Log audit trail
    AuditLogger.audit({
      userId,
      action: 'UPDATE',
      entityType: 'Employee',
      entityId: employeeId,
      details: {
        oldValues: existingEmployee,
        newValues: updateData
      }
    });

    // Get updated employee
    const result = await database.executeQuery(`
      SELECT * FROM Employees WHERE Id = @employeeId
    `, { employeeId });

    res.json({
      success: true,
      message: 'Employee updated successfully',
      data: result.recordset[0]
    });
  } catch (error) {
    logger.error('Update employee error:', error);
    next(error);
  }
});

// Delete an employee
router.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const employeeId = req.params.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Get existing employee with batch verification
    const existingResult = await database.executeQuery(`
      SELECT e.* FROM Employees e
      INNER JOIN ProcessingBatches pb ON e.BatchId = pb.Id
      WHERE e.Id = @employeeId AND pb.CreatedBy = @userId
    `, { employeeId, userId });

    if (existingResult.recordset.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
      return;
    }

    const employee = existingResult.recordset[0];

    // Delete the employee
    await database.executeQuery(`
      DELETE FROM Employees WHERE Id = @employeeId
    `, { employeeId });

    // Log audit trail
    AuditLogger.audit({
      userId,
      action: 'DELETE',
      entityType: 'Employee',
      entityId: employeeId,
      details: {
        employeeId: employee.EmployeeId,
        name: employee.Name,
        batchId: employee.BatchId
      }
    });

    res.json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    logger.error('Delete employee error:', error);
    next(error);
  }
});

// Bulk create employees
router.post('/bulk', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { batchId, employees }: { batchId: string; employees: CreateEmployeeRequest[] } = req.body;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (!batchId || !employees || !Array.isArray(employees) || employees.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Batch ID and employees array are required'
      });
      return;
    }

    // Verify batch belongs to user
    const batchResult = await database.executeQuery(`
      SELECT Id FROM ProcessingBatches WHERE Id = @batchId AND CreatedBy = @userId
    `, { batchId, userId });

    if (batchResult.recordset.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
      return;
    }

    const createdEmployees: any[] = [];
    const errors: any[] = [];

    // Process each employee
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      
      try {
        if (!emp.employeeId || !emp.name) {
          errors.push({
            index: i,
            employeeId: emp.employeeId,
            error: 'Employee ID and name are required'
          });
          continue;
        }

        // Check if employee ID already exists in this batch
        const existingEmployee = await database.executeQuery(`
          SELECT Id FROM Employees WHERE BatchId = @batchId AND EmployeeId = @employeeId
        `, { batchId, employeeId: emp.employeeId });

        if (existingEmployee.recordset.length > 0) {
          errors.push({
            index: i,
            employeeId: emp.employeeId,
            error: 'Employee ID already exists in this batch'
          });
          continue;
        }

        const newEmployeeId = uuidv4();
        
        await database.executeQuery(`
          INSERT INTO Employees (
            Id, BatchId, EmployeeId, Name, Department, Section, JobTitle, 
            MessHall, Email, ImageFileName, ProcessedImageUrl, CardAssigned, VaultCardCreated
          ) VALUES (
            @id, @batchId, @employeeId, @name, @department, @section, @jobTitle,
            @messHall, @email, @imageFileName, @processedImageUrl, 0, 0
          )
        `, {
          id: newEmployeeId,
          batchId,
          employeeId: emp.employeeId,
          name: emp.name,
          department: emp.department || null,
          section: emp.section || null,
          jobTitle: emp.jobTitle || null,
          messHall: emp.messHall || null,
          email: emp.email || null,
          imageFileName: emp.imageFileName || null,
          processedImageUrl: emp.processedImageUrl || null
        });

        // Get the created employee
        const result = await database.executeQuery(`
          SELECT * FROM Employees WHERE Id = @id
        `, { id: newEmployeeId });

        createdEmployees.push(result.recordset[0]);

        // Log audit trail
        AuditLogger.audit({
          userId,
          action: 'CREATE',
          entityType: 'Employee',
          entityId: newEmployeeId,
          details: {
            batchId,
            employeeId: emp.employeeId,
            name: emp.name,
            bulkOperation: true
          }
        });
      } catch (error) {
        errors.push({
          index: i,
          employeeId: emp.employeeId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Bulk employee creation completed. ${createdEmployees.length} created, ${errors.length} errors.`,
      data: {
        created: createdEmployees,
        errors: errors,
        summary: {
          total: employees.length,
          created: createdEmployees.length,
          failed: errors.length
        }
      }
    });
  } catch (error) {
    logger.error('Bulk create employees error:', error);
    next(error);
  }
});

// Assign card to employee
router.post('/:id/assign-card', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const employeeId = req.params.id;
    const { cardNumber }: { cardNumber: string } = req.body;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (!cardNumber) {
      res.status(400).json({
        success: false,
        message: 'Card number is required'
      });
      return;
    }

    // Get existing employee with batch verification
    const existingResult = await database.executeQuery(`
      SELECT e.* FROM Employees e
      INNER JOIN ProcessingBatches pb ON e.BatchId = pb.Id
      WHERE e.Id = @employeeId AND pb.CreatedBy = @userId
    `, { employeeId, userId });

    if (existingResult.recordset.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
      return;
    }

    const employee = existingResult.recordset[0];

    // Update employee with card number
    await database.executeQuery(`
      UPDATE Employees 
      SET CardNumber = @cardNumber, CardAssigned = 1, UpdatedAt = GETUTCDATE()
      WHERE Id = @employeeId
    `, { cardNumber, employeeId });

    // Log audit trail
    AuditLogger.audit({
      userId,
      action: 'UPDATE',
      entityType: 'Employee',
      entityId: employeeId,
      details: {
        action: 'CARD_ASSIGNED',
        cardNumber,
        employeeId: employee.EmployeeId,
        name: employee.Name
      }
    });

    // Get updated employee
    const result = await database.executeQuery(`
      SELECT * FROM Employees WHERE Id = @employeeId
    `, { employeeId });

    res.json({
      success: true,
      message: 'Card assigned successfully',
      data: result.recordset[0]
    });
  } catch (error) {
    logger.error('Assign card error:', error);
    next(error);
  }
});

export default router;