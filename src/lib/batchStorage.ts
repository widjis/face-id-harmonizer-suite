/**
 * Batch Storage Utility
 * Handles persistence of processing batches for vault card creation
 */

export interface EmployeeData {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  section?: string;
  jobTitle?: string;
  messHall?: string;
  email?: string;
  imageFile?: File;
  processedImageUrl?: string;
  cardNumber?: string;
  cardAssigned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessingBatch {
  id: string;
  name: string;
  description?: string;
  employees: EmployeeData[];
  totalEmployees: number;
  processedImages: number;
  assignedCards: number;
  status: 'draft' | 'processing' | 'completed' | 'error';
  createdAt: string;
  updatedAt: string;
  excelFiles?: string[]; // File names for reference
  imageFiles?: string[]; // File names for reference
}

export interface VaultConfig {
  host: string;
  endpoint: string;
  enabled: boolean;
}

class BatchStorageManager {
  private readonly BATCH_KEY = 'face-id-harmonizer-batches';
  private readonly CONFIG_KEY = 'face-id-harmonizer-config';
  private readonly CURRENT_BATCH_KEY = 'face-id-harmonizer-current-batch';

  /**
   * Save a processing batch to localStorage
   */
  saveBatch(batch: ProcessingBatch): void {
    try {
      const batches = this.getAllBatches();
      const existingIndex = batches.findIndex(b => b.id === batch.id);
      
      batch.updatedAt = new Date().toISOString();
      
      if (existingIndex >= 0) {
        batches[existingIndex] = batch;
      } else {
        batches.push(batch);
      }
      
      localStorage.setItem(this.BATCH_KEY, JSON.stringify(batches));
      console.log(`✅ Batch saved: ${batch.name} (${batch.employees.length} employees)`);
    } catch (error) {
      console.error('❌ Failed to save batch:', error);
      throw new Error('Failed to save batch data');
    }
  }

  /**
   * Get all saved batches
   */
  getAllBatches(): ProcessingBatch[] {
    try {
      const batchesJson = localStorage.getItem(this.BATCH_KEY);
      return batchesJson ? JSON.parse(batchesJson) : [];
    } catch (error) {
      console.error('❌ Failed to load batches:', error);
      return [];
    }
  }

  /**
   * Get a specific batch by ID
   */
  getBatch(batchId: string): ProcessingBatch | null {
    const batches = this.getAllBatches();
    return batches.find(b => b.id === batchId) || null;
  }

  /**
   * Delete a batch
   */
  deleteBatch(batchId: string): boolean {
    try {
      const batches = this.getAllBatches();
      const filteredBatches = batches.filter(b => b.id !== batchId);
      
      if (filteredBatches.length === batches.length) {
        return false; // Batch not found
      }
      
      localStorage.setItem(this.BATCH_KEY, JSON.stringify(filteredBatches));
      
      // Clear current batch if it was deleted
      if (this.getCurrentBatchId() === batchId) {
        this.clearCurrentBatch();
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to delete batch:', error);
      return false;
    }
  }

  /**
   * Set current working batch
   */
  setCurrentBatch(batchId: string): void {
    localStorage.setItem(this.CURRENT_BATCH_KEY, batchId);
  }

  /**
   * Get current working batch ID
   */
  getCurrentBatchId(): string | null {
    return localStorage.getItem(this.CURRENT_BATCH_KEY);
  }

  /**
   * Get current working batch
   */
  getCurrentBatch(): ProcessingBatch | null {
    const currentId = this.getCurrentBatchId();
    return currentId ? this.getBatch(currentId) : null;
  }

  /**
   * Clear current batch
   */
  clearCurrentBatch(): void {
    localStorage.removeItem(this.CURRENT_BATCH_KEY);
  }

  /**
   * Update employee data in a batch
   */
  updateEmployee(batchId: string, employeeId: string, updates: Partial<EmployeeData>): boolean {
    try {
      const batch = this.getBatch(batchId);
      if (!batch) return false;

      const employeeIndex = batch.employees.findIndex(e => e.id === employeeId);
      if (employeeIndex === -1) return false;

      batch.employees[employeeIndex] = {
        ...batch.employees[employeeIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Update batch statistics
      batch.assignedCards = batch.employees.filter(e => e.cardAssigned).length;
      batch.processedImages = batch.employees.filter(e => e.processedImageUrl).length;

      this.saveBatch(batch);
      return true;
    } catch (error) {
      console.error('❌ Failed to update employee:', error);
      return false;
    }
  }

  /**
   * Assign card number to employee
   */
  assignCardToEmployee(batchId: string, employeeId: string, cardNumber: string): boolean {
    return this.updateEmployee(batchId, employeeId, {
      cardNumber,
      cardAssigned: true
    });
  }

  /**
   * Save vault configuration
   */
  saveVaultConfig(config: VaultConfig): void {
    try {
      localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('❌ Failed to save vault config:', error);
    }
  }

  /**
   * Get vault configuration
   */
  getVaultConfig(): VaultConfig {
    try {
      const configJson = localStorage.getItem(this.CONFIG_KEY);
      return configJson ? JSON.parse(configJson) : {
        host: '10.60.10.6',
        endpoint: '/Vaultsite/APIwebservice.asmx',
        enabled: false
      };
    } catch (error) {
      console.error('❌ Failed to load vault config:', error);
      return {
        host: '10.60.10.6',
        endpoint: '/Vaultsite/APIwebservice.asmx',
        enabled: false
      };
    }
  }

  /**
   * Create a new batch from processed data
   */
  createBatchFromProcessedData(
    name: string,
    employees: Omit<EmployeeData, 'id' | 'createdAt' | 'updatedAt'>[],
    description?: string
  ): ProcessingBatch {
    const now = new Date().toISOString();
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const batch: ProcessingBatch = {
      id: batchId,
      name,
      description,
      employees: employees.map((emp, index) => ({
        ...emp,
        id: `emp_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
        updatedAt: now
      })),
      totalEmployees: employees.length,
      processedImages: employees.filter(e => e.processedImageUrl).length,
      assignedCards: employees.filter(e => e.cardAssigned).length,
      status: 'draft',
      createdAt: now,
      updatedAt: now
    };

    this.saveBatch(batch);
    this.setCurrentBatch(batchId);
    
    return batch;
  }

  /**
   * Export batch data for vault API
   */
  exportBatchForVault(batchId: string): any[] {
    const batch = this.getBatch(batchId);
    if (!batch) return [];

    return batch.employees
      .filter(emp => emp.cardNumber && emp.cardAssigned)
      .map(emp => ({
        CardNo: emp.cardNumber,
        Name: emp.name,
        StaffNo: emp.employeeId,
        Department: emp.department,
        Position: emp.jobTitle || '',
        Email: emp.email || '',
        // Add other required fields based on vault API
        CardPinNo: '0000',
        CardType: 'Standard',
        Company: 'MTI',
        Gentle: 'Mr',
        AccessLevel: '1',
        FaceAccessLevel: '00',
        LiftAccessLevel: '00',
        BypassAP: 'false',
        ActiveStatus: 'true',
        NonExpired: 'false',
        ExpiredDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        DownloadCard: 'true'
      }));
  }

  /**
   * Get storage usage statistics
   */
  getStorageStats(): { used: number; available: number; batches: number } {
    try {
      const batches = this.getAllBatches();
      const batchesSize = new Blob([JSON.stringify(batches)]).size;
      
      // Estimate available storage (5MB limit for localStorage)
      const maxStorage = 5 * 1024 * 1024; // 5MB
      
      return {
        used: batchesSize,
        available: maxStorage - batchesSize,
        batches: batches.length
      };
    } catch (error) {
      return { used: 0, available: 0, batches: 0 };
    }
  }

  /**
   * Clear all stored data (use with caution)
   */
  clearAllData(): void {
    localStorage.removeItem(this.BATCH_KEY);
    localStorage.removeItem(this.CONFIG_KEY);
    localStorage.removeItem(this.CURRENT_BATCH_KEY);
  }

  /**
   * Export all batch data to a JSON file for backup/transfer
   */
  exportAllData(): { filename: string; data: string } {
    const exportData = {
      batches: this.getAllBatches(),
      config: this.getVaultConfig(),
      currentBatchId: this.getCurrentBatchId(),
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    const filename = `face-id-harmonizer-backup-${new Date().toISOString().split('T')[0]}.json`;
    const data = JSON.stringify(exportData, null, 2);
    
    return { filename, data };
  }

  /**
   * Download backup file to user's device
   */
  downloadBackup(): void {
    const { filename, data } = this.exportAllData();
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Import batch data from backup file
   */
  async importFromFile(file: File): Promise<{ success: boolean; message: string; imported: number }> {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      // Validate import data structure
      if (!importData.batches || !Array.isArray(importData.batches)) {
        return { success: false, message: 'Invalid backup file format', imported: 0 };
      }

      // Get existing batches to avoid duplicates
      const existingBatches = this.getAllBatches();
      const existingIds = new Set(existingBatches.map(b => b.id));

      // Import batches (skip duplicates)
      let importedCount = 0;
      const batchesToImport = importData.batches.filter((batch: ProcessingBatch) => {
        if (existingIds.has(batch.id)) {
          return false; // Skip duplicate
        }
        return true;
      });

      // Save imported batches
      const allBatches = [...existingBatches, ...batchesToImport];
      localStorage.setItem(this.BATCH_KEY, JSON.stringify(allBatches));
      importedCount = batchesToImport.length;

      // Import config if available and not already set
      if (importData.config && !localStorage.getItem(this.CONFIG_KEY)) {
        this.saveVaultConfig(importData.config);
      }

      return { 
        success: true, 
        message: `Successfully imported ${importedCount} batches`, 
        imported: importedCount 
      };

    } catch (error) {
      return { 
        success: false, 
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        imported: 0 
      };
    }
  }

  /**
   * Export specific batch to JSON
   */
  exportBatch(batchId: string): { filename: string; data: string } | null {
    const batch = this.getBatch(batchId);
    if (!batch) return null;

    const exportData = {
      batch,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    const filename = `batch-${batch.name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    const data = JSON.stringify(exportData, null, 2);
    
    return { filename, data };
  }

  /**
   * Import single batch from file
   */
  async importBatch(file: File): Promise<{ success: boolean; message: string; batchId?: string }> {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      if (!importData.batch) {
        return { success: false, message: 'Invalid batch file format' };
      }

      const batch = importData.batch as ProcessingBatch;
      
      // Check if batch already exists
      if (this.getBatch(batch.id)) {
        return { success: false, message: 'Batch already exists' };
      }

      // Save the batch
      this.saveBatch(batch);

      return { 
        success: true, 
        message: `Successfully imported batch: ${batch.name}`, 
        batchId: batch.id 
      };

    } catch (error) {
      return { 
        success: false, 
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}

// Export singleton instance
export const batchStorage = new BatchStorageManager();

// Utility functions
export const generateBatchId = (): string => {
  return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const generateEmployeeId = (): string => {
  return `emp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const formatBatchName = (prefix: string = 'Batch'): string => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
  return `${prefix}_${dateStr}_${timeStr}`;
};