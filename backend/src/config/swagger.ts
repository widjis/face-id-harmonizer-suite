import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Face ID Harmonizer Suite API',
      version: '1.0.0',
      description: 'A comprehensive API for managing employee batches, face recognition data, and Vault integration',
      contact: {
        name: 'API Support',
        email: 'support@faceid-harmonizer.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3001',
        description: 'Development server'
      },
      {
        url: 'https://api.faceid-harmonizer.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'An error occurred'
            },
            code: {
              type: 'string',
              example: 'VALIDATION_ERROR'
            },
            details: {
              type: 'object',
              additionalProperties: true
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Validation failed'
            },
            code: {
              type: 'string',
              example: 'VALIDATION_ERROR'
            },
            details: {
              type: 'object',
              additionalProperties: {
                type: 'array',
                items: {
                  type: 'string'
                }
              },
              example: {
                'name': ['Name is required'],
                'email': ['Email must be valid']
              }
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            username: {
              type: 'string',
              example: 'john_doe'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john@example.com'
            },
            firstName: {
              type: 'string',
              example: 'John'
            },
            lastName: {
              type: 'string',
              example: 'Doe'
            },
            department: {
              type: 'string',
              example: 'Engineering'
            },
            role: {
              type: 'string',
              enum: ['admin', 'user', 'viewer'],
              example: 'user'
            },
            isActive: {
              type: 'boolean',
              example: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Batch: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            name: {
              type: 'string',
              example: 'Q1 2024 New Hires'
            },
            description: {
              type: 'string',
              example: 'Batch processing for Q1 2024 new employee onboarding'
            },
            status: {
              type: 'string',
              enum: ['draft', 'processing', 'completed', 'error'],
              example: 'draft'
            },
            vaultConfigId: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            employeeCount: {
              type: 'integer',
              example: 25
            },
            processedCount: {
              type: 'integer',
              example: 15
            },
            errorCount: {
              type: 'integer',
              example: 2
            },
            createdBy: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            },
            completedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            }
          }
        },
        Employee: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            employeeId: {
              type: 'string',
              example: 'EMP001'
            },
            cardNumber: {
              type: 'string',
              example: '1234567890',
              nullable: true
            },
            firstName: {
              type: 'string',
              example: 'John'
            },
            lastName: {
              type: 'string',
              example: 'Doe'
            },
            middleName: {
              type: 'string',
              example: 'Michael',
              nullable: true
            },
            department: {
              type: 'string',
              example: 'Engineering'
            },
            section: {
              type: 'string',
              example: 'Backend Development',
              nullable: true
            },
            jobTitle: {
              type: 'string',
              example: 'Senior Software Engineer',
              nullable: true
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john.doe@company.com',
              nullable: true
            },
            batchId: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            status: {
              type: 'string',
              enum: ['pending', 'processing', 'completed', 'error'],
              example: 'pending'
            },
            errorMessage: {
              type: 'string',
              nullable: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        VaultConfig: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            name: {
              type: 'string',
              example: 'Main Vault Server'
            },
            host: {
              type: 'string',
              example: '192.168.1.100'
            },
            port: {
              type: 'integer',
              example: 8080
            },
            username: {
              type: 'string',
              example: 'vault_admin'
            },
            isDefault: {
              type: 'boolean',
              example: true
            },
            isActive: {
              type: 'boolean',
              example: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'array',
              items: {}
            },
            pagination: {
              type: 'object',
              properties: {
                page: {
                  type: 'integer',
                  example: 1
                },
                limit: {
                  type: 'integer',
                  example: 10
                },
                total: {
                  type: 'integer',
                  example: 100
                },
                totalPages: {
                  type: 'integer',
                  example: 10
                },
                hasNext: {
                  type: 'boolean',
                  example: true
                },
                hasPrev: {
                  type: 'boolean',
                  example: false
                }
              }
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication token is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Authentication required',
                code: 'AUTHENTICATION_ERROR',
                timestamp: '2024-01-01T00:00:00.000Z'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Insufficient permissions to access this resource',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Insufficient permissions',
                code: 'AUTHORIZATION_ERROR',
                timestamp: '2024-01-01T00:00:00.000Z'
              }
            }
          }
        },
        NotFoundError: {
          description: 'The requested resource was not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Resource not found',
                code: 'NOT_FOUND',
                timestamp: '2024-01-01T00:00:00.000Z'
              }
            }
          }
        },
        ValidationError: {
          description: 'Request validation failed',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ValidationError'
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                message: 'Internal server error',
                code: 'INTERNAL_ERROR',
                timestamp: '2024-01-01T00:00:00.000Z'
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints'
      },
      {
        name: 'Batches',
        description: 'Batch management operations'
      },
      {
        name: 'Employees',
        description: 'Employee data management'
      },
      {
        name: 'Vault',
        description: 'Vault integration and configuration'
      },
      {
        name: 'Files',
        description: 'File upload and processing'
      }
    ]
  },
  apis: [
    './src/routes/*.ts',
    './src/routes/**/*.ts'
  ]
};

const specs = swaggerJSDoc(options);

export const setupSwagger = (app: Express): void => {
  // Swagger UI setup
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 50px 0 }
      .swagger-ui .scheme-container { background: #fafafa; padding: 30px 0 }
    `,
    customSiteTitle: 'Face ID Harmonizer Suite API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      docExpansion: 'none',
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2
    }
  }));

  // JSON endpoint for the OpenAPI specification
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
};

export { specs };
export default setupSwagger;