// Type definitions for Face ID Harmonizer Suite Backend
import { Request } from 'express';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  role: 'admin' | 'user' | 'viewer';
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  role?: 'admin' | 'user' | 'viewer';
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash'>;
  token: string;
  expiresIn: string;
}

export interface ProcessingBatch {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'processing' | 'completed' | 'error';
  totalEmployees: number;
  processedImages: number;
  assignedCards: number;
  excelFiles?: string[];
  imageFiles?: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface CreateBatchRequest {
  name: string;
  description?: string;
  vaultConfigId?: string;
  employees?: CreateEmployeeRequest[];
}

export interface UpdateBatchRequest {
  name?: string;
  description?: string;
  status?: 'draft' | 'processing' | 'completed' | 'error';
  vaultConfigId?: string;
}

export interface Employee {
  id: string;
  batchId: string;
  employeeId: string;
  name: string;
  department?: string;
  section?: string;
  jobTitle?: string;
  messHall?: string;
  email?: string;
  imageFileName?: string;
  processedImageUrl?: string;
  cardNumber?: string;
  cardAssigned: boolean;
  vaultCardCreated: boolean;
  vaultCardId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmployeeRequest {
  employeeId: string;
  name: string;
  department?: string;
  section?: string;
  jobTitle?: string;
  messHall?: string;
  email?: string;
  imageFileName?: string;
  processedImageUrl?: string;
}

export interface UpdateEmployeeRequest {
  name?: string;
  department?: string;
  section?: string;
  jobTitle?: string;
  messHall?: string;
  email?: string;
  cardNumber?: string;
  cardAssigned?: boolean;
  vaultCardCreated?: boolean;
  vaultCardId?: string;
}

export interface VaultConfiguration {
  id: string;
  name: string;
  host: string;
  port: number;
  isSecure: boolean;
  apiVersion: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVaultConfigRequest {
  name: string;
  host: string;
  port: number;
  isSecure?: boolean;
  apiVersion?: string;
  isActive?: boolean;
}

export interface AuditTrailEntry {
  id: string;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT' | 'VAULT_API_CALL';
  entityType: 'User' | 'Batch' | 'Employee' | 'VaultConfig' | 'FileUpload';
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  details?: string;
  createdAt: Date;
}

export interface CreateAuditEntryRequest {
  action: AuditTrailEntry['action'];
  entityType: AuditTrailEntry['entityType'];
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  details?: string;
}

export interface FileUpload {
  id: string;
  batchId?: string;
  fileName: string;
  originalName: string;
  fileType: 'excel' | 'image';
  fileSize: number;
  filePath: string;
  mimeType?: string;
  uploadedBy: string;
  createdAt: Date;
}

export interface VaultApiLog {
  id: string;
  batchId?: string;
  employeeId?: string;
  apiEndpoint: string;
  requestMethod: string;
  requestPayload?: string;
  responseStatus?: number;
  responseBody?: string;
  executionTimeMs?: number;
  success: boolean;
  errorMessage?: string;
  createdBy: string;
  createdAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: Record<string, any>;
}

// Vault API Types
export interface VaultCardProfile {
  CardNumber: string;
  FirstName: string;
  LastName: string;
  MiddleName?: string;
  Department: string;
  Section?: string;
  JobTitle?: string;
  MessHall?: string;
  Email?: string;
  EmployeeId: string;
}

export interface VaultApiResponse {
  success: boolean;
  cardId?: string;
  message?: string;
  error?: string;
}

// Request context for middleware
export interface AuthenticatedRequest extends Request {
  user?: Omit<User, 'passwordHash'>;
  ipAddress?: string;
  userAgent?: string;
}

// Multer file upload request interface
export interface MulterRequest extends AuthenticatedRequest {
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

// Database connection types
export interface DatabaseConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  port: number;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
    enableArithAbort?: boolean;
    connectionTimeout?: number;
    requestTimeout?: number;
  };
}

// Error types
export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}