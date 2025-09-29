/**
 * Batch Service for Face ID Harmonizer Suite
 * 
 * This service handles batch processing operations using the backend API
 * instead of localStorage, providing better data persistence and consistency.
 */

import { apiClient, type Employee, type VaultCardProfile, type BatchOperation, createVaultCardProfile, formatApiError } from './apiClient';

export interface ProcessingBatch {
  id: string;
  name: string;
  description?: string;
  employees: Employee[];
  totalEmployees: number;
  processedImages: number;
  assignedCards: number;
  vaultCardsCreated: number;
  status: 'draft' | 'processing' | 'completed' | 'error';
  createdAt: string;
  updatedAt: string;
  excelFiles?: string[]; // File names for reference
  imageFiles?: string[]; // File names for reference
}

export interface BatchProcessingResult {
  success: boolean;
  batchId: string;
  results: {
    employeeId: string;
    cardNumber?: string;
    vaultCardId?: string;
    success: boolean;
    error?: string;
  }[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

class BatchService {
  private currentBatchId: string | null = null;

  /**
   * Create a new processing batch
   */
  async createBatch(
    name: string, 
    employees: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>[],
    description?: string
  ): Promise<ProcessingBatch> {
    try {
      // Create employees in the backend
      const createdEmployees: Employee[] = [];
      
      for (const employeeData of employees) {
        const employee = await apiClient.createEmployee(employeeData);
        createdEmployees.push(employee);
      }

      // Create batch object
      const batch: ProcessingBatch = {
        id: this.generateBatchId(),
        name,
        description,
        employees: createdEmployees,
        totalEmployees: createdEmployees.length,
        processedImages: 0,
        assignedCards: 0,
        vaultCardsCreated: 0,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Store batch reference locally (could be moved to backend in future)
      this.saveBatchLocally(batch);
      
      return batch;
    } catch (error) {
      throw new Error(`Failed to create batch: ${formatApiError(error)}`);
    }
  }

  /**
   * Get all processing batches
   */
  getAllBatches(): ProcessingBatch[] {
    try {
      const batchesJson = localStorage.getItem('processing-batches');
      return batchesJson ? JSON.parse(batchesJson) : [];
    } catch (error) {
      console.error('Failed to load batches:', error);
      return [];
    }
  }

  /**
   * Get a specific batch by ID
   */
  async getBatch(batchId: string): Promise<ProcessingBatch | null> {
    try {
      // Get batch from local storage
      const batch = this.getBatchLocally(batchId);
      if (!batch) return null;

      // Refresh employee data from backend
      const updatedEmployees: Employee[] = [];
      for (const employee of batch.employees) {
        try {
          const updatedEmployee = await apiClient.getEmployee(employee.id);
          updatedEmployees.push(updatedEmployee);
        } catch (error) {
          // If employee not found, keep the original data
          updatedEmployees.push(employee);
        }
      }

      // Update batch with fresh data
      const updatedBatch: ProcessingBatch = {
        ...batch,
        employees: updatedEmployees,
        assignedCards: updatedEmployees.filter(e => e.cardAssigned).length,
        vaultCardsCreated: updatedEmployees.filter(e => e.vaultCardCreated).length,
        updatedAt: new Date().toISOString(),
      };

      // Save updated batch
      this.saveBatchLocally(updatedBatch);

      return updatedBatch;
    } catch (error) {
      console.error('Failed to get batch:', error);
      return null;
    }
  }

  /**
   * Update batch status
   */
  async updateBatchStatus(batchId: string, status: ProcessingBatch['status']): Promise<boolean> {
    try {
      const batch = await this.getBatch(batchId);
      if (!batch) return false;

      batch.status = status;
      batch.updatedAt = new Date().toISOString();
      
      this.saveBatchLocally(batch);
      return true;
    } catch (error) {
      console.error('Failed to update batch status:', error);
      return false;
    }
  }

  /**
   * Assign card to employee in batch
   */
  async assignCardToEmployee(
    batchId: string, 
    employeeId: string, 
    cardNumber: string
  ): Promise<boolean> {
    try {
      // Update employee in backend
      await apiClient.assignCardToEmployee(employeeId, cardNumber);
      
      // Update local batch
      const batch = await this.getBatch(batchId);
      if (!batch) return false;

      const employeeIndex = batch.employees.findIndex(e => e.id === employeeId);
      if (employeeIndex === -1) return false;

      batch.employees[employeeIndex] = {
        ...batch.employees[employeeIndex],
        cardNumber,
        cardAssigned: true,
        updatedAt: new Date().toISOString(),
      };

      batch.assignedCards = batch.employees.filter(e => e.cardAssigned).length;
      batch.updatedAt = new Date().toISOString();

      this.saveBatchLocally(batch);
      return true;
    } catch (error) {
      console.error('Failed to assign card to employee:', error);
      return false;
    }
  }

  /**
   * Create vault cards for all employees in batch
   */
  async createVaultCardsForBatch(batchId: string): Promise<BatchProcessingResult> {
    const batch = await this.getBatch(batchId);
    if (!batch) {
      throw new Error('Batch not found');
    }

    // Filter employees that have cards assigned but no vault cards created
    const employeesToProcess = batch.employees.filter(
      emp => emp.cardAssigned && emp.cardNumber && !emp.vaultCardCreated
    );

    if (employeesToProcess.length === 0) {
      return {
        success: true,
        batchId,
        results: [],
        summary: { total: 0, successful: 0, failed: 0 }
      };
    }

    // Prepare batch operations for vault API
    const operations: BatchOperation[] = employeesToProcess.map(employee => ({
      operation: 'add',
      cardProfile: createVaultCardProfile(employee, employee.cardNumber!),
      employeeId: employee.id,
    }));

    try {
      // Update batch status to processing
      await this.updateBatchStatus(batchId, 'processing');

      // Process batch operations
      const batchResponse = await apiClient.batchProcessVaultCards(operations, batchId);

      // Process results and update employees
      const results = [];
      let successful = 0;
      let failed = 0;

      for (let i = 0; i < batchResponse.results.length; i++) {
        const result = batchResponse.results[i];
        const employee = employeesToProcess[i];

        if (result.success && result.cardId) {
          // Update employee with vault card info
          try {
            await apiClient.updateEmployee(employee.id, {
              vaultCardCreated: true,
              vaultCardId: result.cardId,
            });

            results.push({
              employeeId: employee.id,
              cardNumber: result.cardNumber,
              vaultCardId: result.cardId,
              success: true,
            });
            successful++;
          } catch (updateError) {
            results.push({
              employeeId: employee.id,
              cardNumber: employee.cardNumber,
              success: false,
              error: formatApiError(updateError),
            });
            failed++;
          }
        } else {
          results.push({
            employeeId: employee.id,
            cardNumber: employee.cardNumber,
            success: false,
            error: result.error || 'Unknown error',
          });
          failed++;
        }
      }

      // Update batch status based on results
      const finalStatus = failed === 0 ? 'completed' : (successful > 0 ? 'completed' : 'error');
      await this.updateBatchStatus(batchId, finalStatus);

      return {
        success: successful > 0,
        batchId,
        results,
        summary: {
          total: employeesToProcess.length,
          successful,
          failed,
        },
      };

    } catch (error) {
      await this.updateBatchStatus(batchId, 'error');
      throw new Error(`Batch processing failed: ${formatApiError(error)}`);
    }
  }

  /**
   * Delete vault cards for employees in batch
   */
  async deleteVaultCardsForBatch(batchId: string): Promise<BatchProcessingResult> {
    const batch = await this.getBatch(batchId);
    if (!batch) {
      throw new Error('Batch not found');
    }

    // Filter employees that have vault cards created
    const employeesToProcess = batch.employees.filter(
      emp => emp.vaultCardCreated && emp.cardNumber
    );

    if (employeesToProcess.length === 0) {
      return {
        success: true,
        batchId,
        results: [],
        summary: { total: 0, successful: 0, failed: 0 }
      };
    }

    // Prepare batch operations for vault API
    const operations: BatchOperation[] = employeesToProcess.map(employee => ({
      operation: 'delete',
      cardNumber: employee.cardNumber!,
      employeeId: employee.id,
    }));

    try {
      // Update batch status to processing
      await this.updateBatchStatus(batchId, 'processing');

      // Process batch operations
      const batchResponse = await apiClient.batchProcessVaultCards(operations, batchId);

      // Process results and update employees
      const results = [];
      let successful = 0;
      let failed = 0;

      for (let i = 0; i < batchResponse.results.length; i++) {
        const result = batchResponse.results[i];
        const employee = employeesToProcess[i];

        if (result.success) {
          // Update employee to remove vault card info
          try {
            await apiClient.updateEmployee(employee.id, {
              vaultCardCreated: false,
              vaultCardId: undefined,
            });

            results.push({
              employeeId: employee.id,
              cardNumber: result.cardNumber,
              success: true,
            });
            successful++;
          } catch (updateError) {
            results.push({
              employeeId: employee.id,
              cardNumber: employee.cardNumber,
              success: false,
              error: formatApiError(updateError),
            });
            failed++;
          }
        } else {
          results.push({
            employeeId: employee.id,
            cardNumber: employee.cardNumber,
            success: false,
            error: result.error || 'Unknown error',
          });
          failed++;
        }
      }

      // Update batch status
      const finalStatus = failed === 0 ? 'completed' : (successful > 0 ? 'completed' : 'error');
      await this.updateBatchStatus(batchId, finalStatus);

      return {
        success: successful > 0,
        batchId,
        results,
        summary: {
          total: employeesToProcess.length,
          successful,
          failed,
        },
      };

    } catch (error) {
      await this.updateBatchStatus(batchId, 'error');
      throw new Error(`Batch deletion failed: ${formatApiError(error)}`);
    }
  }

  /**
   * Delete a batch and all associated employees
   */
  async deleteBatch(batchId: string): Promise<boolean> {
    try {
      const batch = await this.getBatch(batchId);
      if (!batch) return false;

      // Delete all employees in the batch
      for (const employee of batch.employees) {
        try {
          await apiClient.deleteEmployee(employee.id);
        } catch (error) {
          console.warn(`Failed to delete employee ${employee.id}:`, error);
        }
      }

      // Remove batch from local storage
      this.deleteBatchLocally(batchId);

      // Clear current batch if it was deleted
      if (this.currentBatchId === batchId) {
        this.currentBatchId = null;
      }

      return true;
    } catch (error) {
      console.error('Failed to delete batch:', error);
      return false;
    }
  }

  /**
   * Set current working batch
   */
  setCurrentBatch(batchId: string): void {
    this.currentBatchId = batchId;
  }

  /**
   * Get current working batch
   */
  async getCurrentBatch(): Promise<ProcessingBatch | null> {
    if (!this.currentBatchId) return null;
    return this.getBatch(this.currentBatchId);
  }

  /**
   * Clear current batch
   */
  clearCurrentBatch(): void {
    this.currentBatchId = null;
  }

  /**
   * Test vault connection
   */
  async testVaultConnection(): Promise<{ success: boolean; message: string }> {
    try {
      return await apiClient.testVaultConnection();
    } catch (error) {
      return {
        success: false,
        message: formatApiError(error),
      };
    }
  }

  // Private helper methods
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private saveBatchLocally(batch: ProcessingBatch): void {
    try {
      const batches = this.getAllBatches();
      const existingIndex = batches.findIndex(b => b.id === batch.id);
      
      if (existingIndex >= 0) {
        batches[existingIndex] = batch;
      } else {
        batches.push(batch);
      }
      
      localStorage.setItem('processing-batches', JSON.stringify(batches));
    } catch (error) {
      console.error('Failed to save batch locally:', error);
    }
  }

  private getBatchLocally(batchId: string): ProcessingBatch | null {
    const batches = this.getAllBatches();
    return batches.find(b => b.id === batchId) || null;
  }

  private deleteBatchLocally(batchId: string): void {
    try {
      const batches = this.getAllBatches();
      const filteredBatches = batches.filter(b => b.id !== batchId);
      localStorage.setItem('processing-batches', JSON.stringify(filteredBatches));
    } catch (error) {
      console.error('Failed to delete batch locally:', error);
    }
  }
}

// Export singleton instance
export const batchService = new BatchService();

// Utility functions
export const formatBatchName = (prefix: string = 'Batch'): string => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
  return `${prefix}_${dateStr}_${timeStr}`;
};

export const getBatchStatusColor = (status: ProcessingBatch['status']): string => {
  switch (status) {
    case 'draft': return 'bg-gray-100 text-gray-800';
    case 'processing': return 'bg-blue-100 text-blue-800';
    case 'completed': return 'bg-green-100 text-green-800';
    case 'error': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const getBatchProgress = (batch: ProcessingBatch): number => {
  if (batch.totalEmployees === 0) return 0;
  return Math.round((batch.vaultCardsCreated / batch.totalEmployees) * 100);
};