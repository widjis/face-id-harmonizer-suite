/**
 * API Client for Face ID Harmonizer Suite
 * 
 * This client handles all communication with the backend APIs including:
 * - Authentication
 * - Employee management
 * - Vault configuration management
 * - Vault card operations
 * - Batch processing
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  timestamp?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
}

export interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  department: string;
  section?: string;
  jobTitle?: string;
  messHall?: string;
  email?: string;
  cardNumber?: string;
  cardAssigned: boolean;
  vaultCardCreated: boolean;
  vaultCardId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VaultConfiguration {
  id: string;
  name: string;
  host: string;
  addCardEndpoint: string;
  getCardEndpoint: string;
  timeout: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VaultCardProfile {
  CardNumber: string;
  FirstName: string;
  LastName: string;
  EmployeeId: string;
  Department?: string;
  JobTitle?: string;
  Email?: string;
  CardPinNo?: string;
  CardType?: string;
  Company?: string;
  AccessLevel?: string;
  ActiveStatus?: boolean;
  ExpiredDate?: string;
}

export interface VaultCardResponse {
  cardId: string;
  cardNumber: string;
  cardProfile?: VaultCardProfile;
}

export interface BatchOperation {
  operation: 'add' | 'delete';
  cardProfile?: VaultCardProfile;
  cardNumber?: string;
  employeeId?: string;
}

export interface BatchResult {
  success: boolean;
  cardId?: string;
  cardNumber?: string;
  error?: string;
}

export interface BatchResponse {
  results: BatchResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Authentication
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.success && response.data) {
      this.token = response.data.token;
      localStorage.setItem('auth_token', this.token);
      return response.data;
    }

    throw new Error(response.message || 'Login failed');
  }

  async logout(): Promise<void> {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  // Employee Management
  async getEmployees(): Promise<Employee[]> {
    const response = await this.request<Employee[]>('/api/employees');
    return response.data || [];
  }

  async getEmployee(id: string): Promise<Employee> {
    const response = await this.request<Employee>(`/api/employees/${id}`);
    if (!response.data) {
      throw new Error('Employee not found');
    }
    return response.data;
  }

  async createEmployee(employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Employee> {
    const response = await this.request<Employee>('/api/employees', {
      method: 'POST',
      body: JSON.stringify(employee),
    });
    if (!response.data) {
      throw new Error('Failed to create employee');
    }
    return response.data;
  }

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee> {
    const response = await this.request<Employee>(`/api/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (!response.data) {
      throw new Error('Failed to update employee');
    }
    return response.data;
  }

  async deleteEmployee(id: string): Promise<void> {
    await this.request(`/api/employees/${id}`, {
      method: 'DELETE',
    });
  }

  async assignCardToEmployee(employeeId: string, cardNumber: string): Promise<Employee> {
    const response = await this.request<Employee>(`/api/employees/${employeeId}/assign-card`, {
      method: 'POST',
      body: JSON.stringify({ cardNumber }),
    });
    if (!response.data) {
      throw new Error('Failed to assign card to employee');
    }
    return response.data;
  }

  // Vault Configuration Management
  async getVaultConfigurations(): Promise<VaultConfiguration[]> {
    const response = await this.request<VaultConfiguration[]>('/api/vault/configurations');
    return response.data || [];
  }

  async getActiveVaultConfiguration(): Promise<VaultConfiguration | null> {
    const response = await this.request<VaultConfiguration>('/api/vault/configurations/active');
    return response.data || null;
  }

  async createVaultConfiguration(config: Omit<VaultConfiguration, 'id' | 'createdAt' | 'updatedAt'>): Promise<VaultConfiguration> {
    const response = await this.request<VaultConfiguration>('/api/vault/configurations', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    if (!response.data) {
      throw new Error('Failed to create vault configuration');
    }
    return response.data;
  }

  async updateVaultConfiguration(id: string, updates: Partial<VaultConfiguration>): Promise<VaultConfiguration> {
    const response = await this.request<VaultConfiguration>(`/api/vault/configurations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (!response.data) {
      throw new Error('Failed to update vault configuration');
    }
    return response.data;
  }

  async deleteVaultConfiguration(id: string): Promise<void> {
    await this.request(`/api/vault/configurations/${id}`, {
      method: 'DELETE',
    });
  }

  async activateVaultConfiguration(id: string): Promise<VaultConfiguration> {
    const response = await this.request<VaultConfiguration>(`/api/vault/configurations/${id}/activate`, {
      method: 'POST',
    });
    if (!response.data) {
      throw new Error('Failed to activate vault configuration');
    }
    return response.data;
  }

  // Vault Card Operations
  async testVaultConnection(): Promise<{ success: boolean; message: string }> {
    const response = await this.request<{ success: boolean; message: string }>('/api/vault/test-connection', {
      method: 'POST',
    });
    return {
      success: response.success,
      message: response.message || 'Connection test completed',
    };
  }

  async createVaultCard(
    cardProfile: VaultCardProfile,
    batchId?: string,
    employeeId?: string
  ): Promise<VaultCardResponse> {
    const response = await this.request<VaultCardResponse>('/api/vault/cards', {
      method: 'POST',
      body: JSON.stringify({ cardProfile, batchId, employeeId }),
    });
    if (!response.data) {
      throw new Error('Failed to create vault card');
    }
    return response.data;
  }

  async getVaultCard(
    cardNumber: string,
    batchId?: string,
    employeeId?: string
  ): Promise<VaultCardResponse> {
    const params = new URLSearchParams();
    if (batchId) params.append('batchId', batchId);
    if (employeeId) params.append('employeeId', employeeId);
    
    const queryString = params.toString();
    const endpoint = `/api/vault/cards/${cardNumber}${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.request<VaultCardResponse>(endpoint);
    if (!response.data) {
      throw new Error('Vault card not found');
    }
    return response.data;
  }

  async deleteVaultCard(
    cardNumber: string,
    batchId?: string,
    employeeId?: string
  ): Promise<VaultCardResponse> {
    const params = new URLSearchParams();
    if (batchId) params.append('batchId', batchId);
    if (employeeId) params.append('employeeId', employeeId);
    
    const queryString = params.toString();
    const endpoint = `/api/vault/cards/${cardNumber}${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.request<VaultCardResponse>(endpoint, {
      method: 'DELETE',
    });
    if (!response.data) {
      throw new Error('Failed to delete vault card');
    }
    return response.data;
  }

  async batchProcessVaultCards(
    operations: BatchOperation[],
    batchId?: string
  ): Promise<BatchResponse> {
    const response = await this.request<BatchResponse>('/api/vault/cards/batch', {
      method: 'POST',
      body: JSON.stringify({ operations, batchId }),
    });
    if (!response.data) {
      throw new Error('Failed to process batch operations');
    }
    return response.data;
  }

  // Utility methods
  setAuthToken(token: string): void {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  getAuthToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export utility functions
export const createVaultCardProfile = (
  employee: Employee,
  cardNumber: string
): VaultCardProfile => {
  return {
    CardNumber: cardNumber,
    FirstName: employee.firstName,
    LastName: employee.lastName,
    EmployeeId: employee.employeeId,
    Department: employee.department,
    JobTitle: employee.jobTitle,
    Email: employee.email,
    CardPinNo: '0000',
    CardType: 'Standard',
    Company: 'MTI',
    AccessLevel: '1',
    ActiveStatus: true,
    ExpiredDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  };
};

export const formatApiError = (error: any): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
};