# Face ID Harmonizer Suite - Backend API

A robust Node.js backend API for the Face ID Harmonizer Suite with comprehensive audit trail, file upload management, and Vault integration.

## 🚀 Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **File Upload Management**: Excel and image file uploads with validation
- **Audit Trail**: Comprehensive logging of all system activities
- **Vault Integration**: MTI Vault API client for card management
- **Database Migrations**: Automated schema management and seeding
- **Type Safety**: Full TypeScript implementation
- **Security**: Helmet, CORS, rate limiting, and input validation
- **Logging**: Winston-based structured logging

## 📋 Prerequisites

- Node.js 18+ and npm
- SQL Server 2019+ or Azure SQL Database
- TypeScript knowledge for development

## 🛠️ Installation

1. **Clone and navigate to backend directory**:
   ```bash
   cd backend
   npm install
   ```

2. **Environment Configuration**:
   ```bash
   cp .env.example .env
   ```
   
   Configure your `.env` file:
   ```env
   # Server Configuration
   PORT=3001
   NODE_ENV=development
   
   # Database Configuration
   DB_SERVER=your-sql-server
   DB_DATABASE=FaceIDHarmonizer
   DB_USERNAME=your-username
   DB_PASSWORD=your-password
   DB_PORT=1433
   
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-min-32-chars
   JWT_EXPIRES_IN=24h
   
   # File Upload Configuration
   UPLOAD_DIR=uploads
   MAX_FILE_SIZE=10485760
   MAX_FILES=50
   
   # Vault API Configuration
   VAULT_DEFAULT_HOST=10.60.10.6
   VAULT_ADD_CARD_ENDPOINT=/Vaultsite/APIwebservice.asmx
   VAULT_GET_CARD_ENDPOINT=/Vaultsite/APIwebservice2.asmx
   ```

3. **Database Setup**:
   ```bash
   # Run migrations and seed data
   npm run db:setup
   
   # Or run separately
   npm run db:migrate  # Run migrations only
   npm run db:seed     # Run seed data only
   ```

## 🗄️ Database Management

### Migration Commands

```bash
# Setup database (migrations + seeds)
npm run db:setup

# Run migrations only
npm run db:migrate

# Run seed data only
npm run db:seed

# Reset database (same as setup)
npm run db:reset
```

### Default Users

After running seeds, these users are available:

| Username | Password | Role  | Email |
|----------|----------|-------|-------|
| admin    | admin123 | admin | admin@mti.com |
| testuser | user123  | user  | user@mti.com |

## 🚦 Running the Application

### Development Mode
```bash
npm run dev
```
Server runs on `http://localhost:3001` with hot reload.

### Production Mode
```bash
npm run build
npm start
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user info

### File Upload Management
- `POST /api/upload/excel` - Upload Excel file (single, 10MB max)
- `POST /api/upload/images` - Upload images (multiple, 5MB each, 50 max)
- `GET /api/upload/` - List uploaded files
- `GET /api/upload/download/:fileId` - Download file
- `DELETE /api/upload/:fileId` - Delete file

### Processing Batches
- `GET /api/batches` - List processing batches
- `POST /api/batches` - Create new batch
- `GET /api/batches/:id` - Get batch details
- `PUT /api/batches/:id` - Update batch
- `DELETE /api/batches/:id` - Delete batch

### Employees
- `GET /api/employees` - List employees
- `POST /api/employees` - Create employee
- `GET /api/employees/:id` - Get employee details
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee

### Vault Configuration
- `GET /api/vault/config` - Get vault configurations
- `POST /api/vault/config` - Create vault config
- `PUT /api/vault/config/:id` - Update vault config
- `DELETE /api/vault/config/:id` - Delete vault config

### Audit Trail
- `GET /api/audit` - Get audit logs (admin only)
- `GET /api/audit/user/:userId` - Get user-specific logs

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access**: Admin and user role permissions
- **Rate Limiting**: API endpoint protection
- **Input Validation**: Joi schema validation
- **File Validation**: Type and size restrictions
- **CORS Protection**: Cross-origin request security
- **Helmet Security**: HTTP security headers

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   │   ├── database.ts  # Database connection
│   │   └── multer.ts    # File upload config
│   ├── controllers/     # Route controllers
│   ├── database/        # Database management
│   │   ├── migrations/  # SQL migration files
│   │   ├── seeds/       # Seed data files
│   │   ├── migrate.ts   # Migration runner
│   │   └── schema.sql   # Complete schema
│   ├── middleware/      # Express middleware
│   │   ├── auth.ts      # Authentication
│   │   ├── validation.ts # Input validation
│   │   └── audit.ts     # Audit logging
│   ├── models/          # Data models
│   ├── routes/          # API routes
│   │   ├── auth.ts      # Authentication routes
│   │   ├── upload.ts    # File upload routes
│   │   ├── batches.ts   # Batch processing routes
│   │   ├── employees.ts # Employee management
│   │   └── vault.ts     # Vault configuration
│   ├── services/        # Business logic
│   │   ├── vaultClient.ts # Vault API client
│   │   └── auditService.ts # Audit logging
│   ├── types/           # TypeScript definitions
│   ├── utils/           # Utility functions
│   └── server.ts        # Application entry point
├── uploads/             # File upload directory
├── logs/                # Application logs
├── tests/               # Test files
├── .env.example         # Environment template
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
└── README.md           # This file
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 📊 Logging

Logs are written to:
- Console (development)
- `logs/app.log` (all levels)
- `logs/error.log` (errors only)

Log levels: `error`, `warn`, `info`, `debug`

## 🔧 Development

### TypeScript Compilation
```bash
# Check for TypeScript errors
npx tsc --noEmit

# Build for production
npm run build
```

### Code Quality
- ESLint configuration for code quality
- Prettier for code formatting
- TypeScript strict mode enabled

## 🚀 Deployment

### Environment Variables
Ensure all production environment variables are set:
- Use strong JWT secrets (32+ characters)
- Configure proper database credentials
- Set NODE_ENV=production
- Configure proper CORS origins

### Database
- Run migrations in production: `npm run db:migrate`
- Avoid running seeds in production unless needed

### Security Checklist
- [ ] Strong JWT secret configured
- [ ] Database credentials secured
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] File upload limits set
- [ ] Audit logging enabled

## 📝 API Documentation

Detailed API documentation is available at `/api/docs` when running the server (Swagger/OpenAPI).

## 🤝 Contributing

1. Follow TypeScript best practices
2. Add tests for new features
3. Update documentation
4. Follow existing code patterns
5. Run `npx tsc --noEmit` before committing

## 📄 License

MIT License - see LICENSE file for details.

---

**Face ID Harmonizer Suite Backend** - Built with ❤️ by TRAE AI Agent