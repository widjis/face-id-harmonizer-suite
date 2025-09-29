import sql from 'mssql';
import { DatabaseConfig } from '../types';
import logger from '../utils/logger';

const config: DatabaseConfig = {
  server: process.env.DB_SERVER || '10.60.10.47',
  database: process.env.DB_DATABASE || 'VaultIDCardProcessor',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Bl4ck3y34dmin',
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true,
    connectionTimeout: 30000,
    requestTimeout: 30000
  }
};

class DatabaseManager {
  private pool: sql.ConnectionPool | null = null;
  private connecting = false;

  async connect(): Promise<sql.ConnectionPool> {
    if (this.pool && this.pool.connected) {
      return this.pool;
    }

    if (this.connecting) {
      // Wait for existing connection attempt
      while (this.connecting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.pool && this.pool.connected) {
        return this.pool;
      }
    }

    try {
      this.connecting = true;
      logger.info('Connecting to SQL Server database...');
      
      this.pool = new sql.ConnectionPool(config);
      await this.pool.connect();
      
      logger.info('Successfully connected to SQL Server database');
      
      // Handle connection events
      this.pool.on('error', (err: Error) => {
        logger.error('Database connection error:', err);
        this.pool = null;
      });

      return this.pool;
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      this.pool = null;
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.close();
        logger.info('Database connection closed');
      } catch (error) {
        logger.error('Error closing database connection:', error);
      } finally {
        this.pool = null;
      }
    }
  }

  async getConnection(): Promise<sql.ConnectionPool> {
    if (!this.pool || !this.pool.connected) {
      return await this.connect();
    }
    return this.pool;
  }

  async executeQuery<T = any>(query: string, params?: Record<string, any>): Promise<sql.IResult<T>> {
    const pool = await this.getConnection();
    const request = pool.request();

    // Add parameters if provided
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        request.input(key, value);
      });
    }

    try {
      const result = await request.query(query);
      return result;
    } catch (error) {
      logger.error('Database query error:', { query, params, error });
      throw error;
    }
  }

  async executeStoredProcedure<T = any>(
    procedureName: string, 
    params?: Record<string, any>
  ): Promise<sql.IProcedureResult<T>> {
    const pool = await this.getConnection();
    const request = pool.request();

    // Add parameters if provided
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        request.input(key, value);
      });
    }

    try {
      const result = await request.execute(procedureName);
      return result;
    } catch (error) {
      logger.error('Stored procedure execution error:', { procedureName, params, error });
      throw error;
    }
  }

  async beginTransaction(): Promise<sql.Transaction> {
    const pool = await this.getConnection();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    return transaction;
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      await this.executeQuery('SELECT 1 as health');
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  // Get database info
  async getDatabaseInfo(): Promise<any> {
    try {
      const result = await this.executeQuery(`
        SELECT 
          DB_NAME() as DatabaseName,
          @@VERSION as ServerVersion,
          GETUTCDATE() as ServerTime
      `);
      return result.recordset[0];
    } catch (error) {
      logger.error('Failed to get database info:', error);
      throw error;
    }
  }
}

// Create singleton instance
const database = new DatabaseManager();

// Initialize connection on startup
database.connect().catch((error) => {
  logger.error('Failed to initialize database connection:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, closing database connection...');
  await database.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, closing database connection...');
  await database.disconnect();
  process.exit(0);
});

export default database;