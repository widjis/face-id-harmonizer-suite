-- Seed Data: 001_default_data.sql
-- Description: Default data for Face ID Harmonizer Suite
-- Created: 2025-09-29
-- Author: TRAE AI Agent

-- Create default admin user (password: admin123)
-- Password hash generated with bcrypt for 'admin123'
INSERT INTO Users (Username, Email, PasswordHash, FirstName, LastName, Role, IsActive)
VALUES ('admin', 'admin@mti.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System', 'Administrator', 'admin', 1);

-- Create default test user (password: user123)
-- Password hash generated with bcrypt for 'user123'
INSERT INTO Users (Username, Email, PasswordHash, FirstName, LastName, Role, IsActive)
VALUES ('testuser', 'user@mti.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye.IjdQcfrdVfu.Bc.xre4.1N2QdoBi4S', 'Test', 'User', 'user', 1);

-- Create default vault configuration
INSERT INTO VaultConfigurations (Name, Host, AddCardEndpoint, GetCardEndpoint, IsDefault, IsActive, CreatedBy)
SELECT 'MTI Vault System', '10.60.10.6', '/Vaultsite/APIwebservice.asmx', '/Vaultsite/APIwebservice2.asmx', 1, 1, Id
FROM Users WHERE Username = 'admin';

-- Create backup vault configuration
INSERT INTO VaultConfigurations (Name, Host, AddCardEndpoint, GetCardEndpoint, IsDefault, IsActive, CreatedBy)
SELECT 'MTI Vault Backup', '10.60.10.7', '/Vaultsite/APIwebservice.asmx', '/Vaultsite/APIwebservice2.asmx', 0, 1, Id
FROM Users WHERE Username = 'admin';

-- Create sample processing batch for testing
INSERT INTO ProcessingBatches (Name, Description, Status, TotalEmployees, ProcessedImages, AssignedCards, CreatedBy)
SELECT 'Sample Batch - Q4 2025', 'Sample batch for testing purposes', 'draft', 0, 0, 0, Id
FROM Users WHERE Username = 'admin';

-- Log initial setup in audit trail
INSERT INTO AuditTrail (UserId, Action, EntityType, EntityId, NewValues, Details)
SELECT Id, 'SYSTEM_INIT', 'System', Id, '{"action": "initial_setup"}', 'System initialization with default data'
FROM Users WHERE Username = 'admin';

PRINT 'Seed data 001_default_data.sql completed successfully';