-- Face ID Harmonizer Suite Database Schema
-- SQL Server Database Schema with Audit Trail

-- Create Database (run separately if needed)
-- CREATE DATABASE FaceIDHarmonizer;
-- USE FaceIDHarmonizer;

-- Users table for authentication and audit trail
CREATE TABLE Users (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Username NVARCHAR(50) NOT NULL UNIQUE,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    FirstName NVARCHAR(100),
    LastName NVARCHAR(100),
    Department NVARCHAR(100),
    Role NVARCHAR(50) NOT NULL DEFAULT 'user', -- 'admin', 'user', 'viewer'
    IsActive BIT NOT NULL DEFAULT 1,
    LastLoginAt DATETIME2,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);

-- Processing Batches table
CREATE TABLE ProcessingBatches (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX),
    Status NVARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'processing', 'completed', 'error'
    TotalEmployees INT NOT NULL DEFAULT 0,
    ProcessedImages INT NOT NULL DEFAULT 0,
    AssignedCards INT NOT NULL DEFAULT 0,
    ExcelFiles NVARCHAR(MAX), -- JSON array of file names
    ImageFiles NVARCHAR(MAX), -- JSON array of file names
    CreatedBy UNIQUEIDENTIFIER NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CompletedAt DATETIME2,
    FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
);

-- Employees table
CREATE TABLE Employees (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    BatchId UNIQUEIDENTIFIER NOT NULL,
    EmployeeId NVARCHAR(50) NOT NULL,
    Name NVARCHAR(255) NOT NULL,
    Department NVARCHAR(100),
    Section NVARCHAR(100),
    JobTitle NVARCHAR(100),
    MessHall NVARCHAR(100),
    Email NVARCHAR(255),
    ImageFileName NVARCHAR(255),
    ProcessedImageUrl NVARCHAR(500),
    CardNumber NVARCHAR(50),
    CardAssigned BIT NOT NULL DEFAULT 0,
    VaultCardCreated BIT NOT NULL DEFAULT 0,
    VaultCardId NVARCHAR(100),
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    FOREIGN KEY (BatchId) REFERENCES ProcessingBatches(Id) ON DELETE CASCADE,
    INDEX IX_Employees_BatchId (BatchId),
    INDEX IX_Employees_EmployeeId (EmployeeId),
    INDEX IX_Employees_CardNumber (CardNumber)
);

-- Vault Configurations table
CREATE TABLE VaultConfigurations (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL,
    Host NVARCHAR(255) NOT NULL,
    AddCardEndpoint NVARCHAR(255) NOT NULL,
    GetCardEndpoint NVARCHAR(255) NOT NULL,
    IsDefault BIT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedBy UNIQUEIDENTIFIER NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
);

-- Audit Trail table
CREATE TABLE AuditTrail (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserId UNIQUEIDENTIFIER NOT NULL,
    Action NVARCHAR(100) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT'
    EntityType NVARCHAR(50) NOT NULL, -- 'User', 'Batch', 'Employee', 'VaultConfig'
    EntityId UNIQUEIDENTIFIER,
    OldValues NVARCHAR(MAX), -- JSON of old values
    NewValues NVARCHAR(MAX), -- JSON of new values
    IpAddress NVARCHAR(45),
    UserAgent NVARCHAR(500),
    Details NVARCHAR(MAX), -- Additional context
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    FOREIGN KEY (UserId) REFERENCES Users(Id),
    INDEX IX_AuditTrail_UserId (UserId),
    INDEX IX_AuditTrail_Action (Action),
    INDEX IX_AuditTrail_EntityType (EntityType),
    INDEX IX_AuditTrail_CreatedAt (CreatedAt)
);

-- File Uploads table (for tracking uploaded files)
CREATE TABLE FileUploads (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    BatchId UNIQUEIDENTIFIER,
    FileName NVARCHAR(255) NOT NULL,
    OriginalName NVARCHAR(255) NOT NULL,
    FileType NVARCHAR(50) NOT NULL, -- 'excel', 'image'
    FileSize BIGINT NOT NULL,
    FilePath NVARCHAR(500) NOT NULL,
    MimeType NVARCHAR(100),
    UploadedBy UNIQUEIDENTIFIER NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    FOREIGN KEY (BatchId) REFERENCES ProcessingBatches(Id) ON DELETE CASCADE,
    FOREIGN KEY (UploadedBy) REFERENCES Users(Id),
    INDEX IX_FileUploads_BatchId (BatchId)
);

-- Vault API Logs table (for tracking API calls)
CREATE TABLE VaultApiLogs (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    BatchId UNIQUEIDENTIFIER,
    EmployeeId UNIQUEIDENTIFIER,
    ApiEndpoint NVARCHAR(255) NOT NULL,
    RequestMethod NVARCHAR(10) NOT NULL,
    RequestPayload NVARCHAR(MAX),
    ResponseStatus INT,
    ResponseBody NVARCHAR(MAX),
    ExecutionTimeMs INT,
    Success BIT NOT NULL DEFAULT 0,
    ErrorMessage NVARCHAR(MAX),
    CreatedBy UNIQUEIDENTIFIER NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    FOREIGN KEY (BatchId) REFERENCES ProcessingBatches(Id),
    FOREIGN KEY (EmployeeId) REFERENCES Employees(Id),
    FOREIGN KEY (CreatedBy) REFERENCES Users(Id),
    INDEX IX_VaultApiLogs_BatchId (BatchId),
    INDEX IX_VaultApiLogs_CreatedAt (CreatedAt)
);

-- Create default admin user (password: admin123)
INSERT INTO Users (Username, Email, PasswordHash, FirstName, LastName, Role)
VALUES ('admin', 'admin@mti.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System', 'Administrator', 'admin');

-- Create default vault configuration
INSERT INTO VaultConfigurations (Name, Host, AddCardEndpoint, GetCardEndpoint, IsDefault, CreatedBy)
SELECT 'MTI Vault System', '10.60.10.6', '/Vaultsite/APIwebservice.asmx', '/Vaultsite/APIwebservice2.asmx', 1, Id
FROM Users WHERE Username = 'admin';

-- Create triggers for UpdatedAt columns
CREATE TRIGGER TR_Users_UpdatedAt ON Users
AFTER UPDATE AS
BEGIN
    UPDATE Users 
    SET UpdatedAt = GETUTCDATE() 
    WHERE Id IN (SELECT Id FROM inserted);
END;

CREATE TRIGGER TR_ProcessingBatches_UpdatedAt ON ProcessingBatches
AFTER UPDATE AS
BEGIN
    UPDATE ProcessingBatches 
    SET UpdatedAt = GETUTCDATE() 
    WHERE Id IN (SELECT Id FROM inserted);
END;

CREATE TRIGGER TR_Employees_UpdatedAt ON Employees
AFTER UPDATE AS
BEGIN
    UPDATE Employees 
    SET UpdatedAt = GETUTCDATE() 
    WHERE Id IN (SELECT Id FROM inserted);
END;

CREATE TRIGGER TR_VaultConfigurations_UpdatedAt ON VaultConfigurations
AFTER UPDATE AS
BEGIN
    UPDATE VaultConfigurations 
    SET UpdatedAt = GETUTCDATE() 
    WHERE Id IN (SELECT Id FROM inserted);
END;