import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errorHandler';

// Basic validation utilities
export const isValidUUID = (value: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const sanitizeString = (str: string): string => {
  return str.trim().replace(/[<>]/g, '');
};

export const isValidLength = (str: string, min: number, max: number): boolean => {
  return str.length >= min && str.length <= max;
};

export const isValidRole = (role: string): boolean => {
  return ['admin', 'user', 'viewer'].includes(role);
};

export const isValidStatus = (status: string): boolean => {
  return ['draft', 'processing', 'completed', 'error'].includes(status);
};

// Validation error collection
interface ValidationErrors {
  [field: string]: string[];
}

class ValidationBuilder {
  private errors: ValidationErrors = {};
  public req: Request;

  constructor(req: Request) {
    this.req = req;
  }

  validateBody(field: string, value: any): FieldValidator {
    return new FieldValidator(this.errors, field, value, 'body');
  }

  validateParam(field: string, value: any): FieldValidator {
    return new FieldValidator(this.errors, field, value, 'param');
  }

  validateQuery(field: string, value: any): FieldValidator {
    return new FieldValidator(this.errors, field, value, 'query');
  }

  getErrors(): ValidationErrors {
    return this.errors;
  }

  hasErrors(): boolean {
    return Object.keys(this.errors).length > 0;
  }
}

class FieldValidator {
  private errors: ValidationErrors;
  private field: string;
  private value: any;
  private location: string;

  constructor(errors: ValidationErrors, field: string, value: any, location: string) {
    this.errors = errors;
    this.field = field;
    this.value = value;
    this.location = location;
  }

  required(message?: string): FieldValidator {
    if (!this.value || (typeof this.value === 'string' && this.value.trim() === '')) {
      this.addError(message || `${this.field} is required`);
    }
    return this;
  }

  isUUID(message?: string): FieldValidator {
    if (this.value && !isValidUUID(this.value)) {
      this.addError(message || `${this.field} must be a valid UUID`);
    }
    return this;
  }

  isEmail(message?: string): FieldValidator {
    if (this.value && !isValidEmail(this.value)) {
      this.addError(message || `${this.field} must be a valid email`);
    }
    return this;
  }

  length(min: number, max: number, message?: string): FieldValidator {
    if (this.value && typeof this.value === 'string' && !isValidLength(this.value, min, max)) {
      this.addError(message || `${this.field} must be between ${min} and ${max} characters`);
    }
    return this;
  }

  isIn(values: string[], message?: string): FieldValidator {
    if (this.value && !values.includes(this.value)) {
      this.addError(message || `${this.field} must be one of: ${values.join(', ')}`);
    }
    return this;
  }

  isInt(options?: { min?: number; max?: number }, message?: string): FieldValidator {
    const num = parseInt(this.value);
    if (isNaN(num)) {
      this.addError(message || `${this.field} must be an integer`);
      return this;
    }
    
    if (options?.min !== undefined && num < options.min) {
      this.addError(message || `${this.field} must be at least ${options.min}`);
    }
    
    if (options?.max !== undefined && num > options.max) {
      this.addError(message || `${this.field} must be at most ${options.max}`);
    }
    
    return this;
  }

  matches(pattern: RegExp, message?: string): FieldValidator {
    if (this.value && typeof this.value === 'string' && !pattern.test(this.value)) {
      this.addError(message || `${this.field} format is invalid`);
    }
    return this;
  }

  isArray(message?: string): FieldValidator {
    if (this.value && !Array.isArray(this.value)) {
      this.addError(message || `${this.field} must be an array`);
    }
    return this;
  }

  private addError(message: string): void {
    if (!this.errors[this.field]) {
      this.errors[this.field] = [];
    }
    this.errors[this.field].push(message);
  }
}

// Validation middleware factory
export const validate = (validationFn: (validator: ValidationBuilder) => void) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const validator = new ValidationBuilder(req);
    validationFn(validator);

    if (validator.hasErrors()) {
      const error = new ValidationError('Validation failed', validator.getErrors());
      next(error);
      return;
    }

    next();
  };
};

// Common validation rules
export const authValidations = {
  login: validate((v) => {
    v.validateBody('username', v.req.body.username)
      .required()
      .length(3, 50);
    
    v.validateBody('password', v.req.body.password)
      .required()
      .length(6, 255);
  }),

  register: validate((v) => {
    v.validateBody('username', v.req.body.username)
      .required()
      .length(3, 50)
      .matches(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');
    
    v.validateBody('email', v.req.body.email)
      .required()
      .isEmail()
      .length(1, 100);
    
    v.validateBody('password', v.req.body.password)
      .required()
      .length(8, 255)
      .matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      );
    
    if (v.req.body.firstName) {
      v.validateBody('firstName', v.req.body.firstName).length(1, 50);
    }
    
    if (v.req.body.lastName) {
      v.validateBody('lastName', v.req.body.lastName).length(1, 50);
    }
    
    if (v.req.body.department) {
      v.validateBody('department', v.req.body.department).length(1, 100);
    }
    
    if (v.req.body.role) {
      v.validateBody('role', v.req.body.role).isIn(['admin', 'user', 'viewer']);
    }
  })
};

export const batchValidations = {
  create: validate((v) => {
    v.validateBody('name', v.req.body.name)
      .required()
      .length(1, 100);
    
    if (v.req.body.description) {
      v.validateBody('description', v.req.body.description).length(0, 500);
    }
    
    if (v.req.body.vaultConfigId) {
      v.validateBody('vaultConfigId', v.req.body.vaultConfigId).isUUID();
    }
    
    if (v.req.body.employees) {
      v.validateBody('employees', v.req.body.employees).isArray();
    }
  }),

  update: validate((v) => {
    v.validateParam('id', v.req.params.id).required().isUUID();
    
    if (v.req.body.name) {
      v.validateBody('name', v.req.body.name).length(1, 100);
    }
    
    if (v.req.body.description) {
      v.validateBody('description', v.req.body.description).length(0, 500);
    }
    
    if (v.req.body.status) {
      v.validateBody('status', v.req.body.status).isIn(['draft', 'processing', 'completed', 'error']);
    }
    
    if (v.req.body.vaultConfigId) {
      v.validateBody('vaultConfigId', v.req.body.vaultConfigId).isUUID();
    }
  }),

  get: validate((v) => {
    v.validateParam('id', v.req.params.id).required().isUUID();
  }),

  list: validate((v) => {
    if (v.req.query.page) {
      v.validateQuery('page', v.req.query.page).isInt({ min: 1 });
    }
    
    if (v.req.query.limit) {
      v.validateQuery('limit', v.req.query.limit).isInt({ min: 1, max: 100 });
    }
    
    if (v.req.query.search) {
      v.validateQuery('search', v.req.query.search).length(1, 100);
    }
    
    if (v.req.query.status) {
      v.validateQuery('status', v.req.query.status).isIn(['draft', 'processing', 'completed', 'error']);
    }
  })
};

export const employeeValidations = {
  create: validate((v) => {
    v.validateBody('employeeId', v.req.body.employeeId)
      .required()
      .length(1, 50);
    
    v.validateBody('firstName', v.req.body.firstName)
      .required()
      .length(1, 50);
    
    v.validateBody('lastName', v.req.body.lastName)
      .required()
      .length(1, 50);
    
    if (v.req.body.middleName) {
      v.validateBody('middleName', v.req.body.middleName).length(1, 50);
    }
    
    v.validateBody('department', v.req.body.department)
      .required()
      .length(1, 100);
    
    if (v.req.body.section) {
      v.validateBody('section', v.req.body.section).length(1, 100);
    }
    
    if (v.req.body.jobTitle) {
      v.validateBody('jobTitle', v.req.body.jobTitle).length(1, 100);
    }
    
    if (v.req.body.email) {
      v.validateBody('email', v.req.body.email).isEmail().length(1, 100);
    }
    
    v.validateBody('batchId', v.req.body.batchId)
      .required()
      .isUUID();
  }),

  update: validate((v) => {
    v.validateParam('id', v.req.params.id).required().isUUID();
    
    if (v.req.body.cardNumber) {
      v.validateBody('cardNumber', v.req.body.cardNumber).length(1, 50);
    }
    
    if (v.req.body.firstName) {
      v.validateBody('firstName', v.req.body.firstName).length(1, 50);
    }
    
    if (v.req.body.lastName) {
      v.validateBody('lastName', v.req.body.lastName).length(1, 50);
    }
    
    if (v.req.body.department) {
      v.validateBody('department', v.req.body.department).length(1, 100);
    }
  }),

  assignCard: validate((v) => {
    v.validateParam('id', v.req.params.id).required().isUUID();
    
    v.validateBody('cardNumber', v.req.body.cardNumber)
      .required()
      .length(1, 50);
  })
};

export const vaultValidations = {
  createConfig: validate((v) => {
    v.validateBody('name', v.req.body.name)
      .required()
      .length(1, 100);
    
    v.validateBody('host', v.req.body.host)
      .required()
      .length(1, 255);
    
    v.validateBody('port', v.req.body.port)
      .required()
      .isInt({ min: 1, max: 65535 });
    
    v.validateBody('username', v.req.body.username)
      .required()
      .length(1, 100);
    
    v.validateBody('password', v.req.body.password)
      .required()
      .length(1, 255);
  }),

  addCard: validate((v) => {
    v.validateBody('cardNumber', v.req.body.cardNumber)
      .required()
      .length(1, 50);
    
    v.validateBody('firstName', v.req.body.firstName)
      .required()
      .length(1, 50);
    
    v.validateBody('lastName', v.req.body.lastName)
      .required()
      .length(1, 50);
    
    v.validateBody('department', v.req.body.department)
      .required()
      .length(1, 100);
    
    v.validateBody('employeeId', v.req.body.employeeId)
      .required()
      .length(1, 50);
  }),

  batchOperations: validate((v) => {
    v.validateBody('operations', v.req.body.operations)
      .required()
      .isArray();
  })
};

export const fileValidations = {
  upload: validate((v) => {
    v.validateBody('batchId', v.req.body.batchId)
      .required()
      .isUUID();
  })
};

export default {
  validate,
  authValidations,
  batchValidations,
  employeeValidations,
  vaultValidations,
  fileValidations,
  isValidUUID,
  isValidEmail,
  sanitizeString,
  isValidLength,
  isValidRole,
  isValidStatus
};