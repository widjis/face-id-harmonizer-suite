import fs from 'fs/promises';
import path from 'path';
import database from '../config/database';

interface MigrationFile {
  filename: string;
  filepath: string;
  version: string;
}

class DatabaseMigrator {
  private migrationsDir: string;
  private seedsDir: string;

  constructor() {
    this.migrationsDir = path.join(__dirname, 'migrations');
    this.seedsDir = path.join(__dirname, 'seeds');
  }

  /**
   * Create migrations tracking table if it doesn't exist
   */
  private async createMigrationsTable(): Promise<void> {
    const createTableQuery = `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DatabaseMigrations' AND xtype='U')
      CREATE TABLE DatabaseMigrations (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        Version NVARCHAR(50) NOT NULL UNIQUE,
        Filename NVARCHAR(255) NOT NULL,
        ExecutedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        ExecutionTimeMs INT,
        Success BIT NOT NULL DEFAULT 1,
        ErrorMessage NVARCHAR(MAX)
      );
    `;

    await database.executeQuery(createTableQuery, {});
    console.log('✅ Migrations tracking table ready');
  }

  /**
   * Get list of migration files sorted by version
   */
  private async getMigrationFiles(): Promise<MigrationFile[]> {
    try {
      const files = await fs.readdir(this.migrationsDir);
      const migrationFiles: MigrationFile[] = [];

      for (const filename of files) {
        if (filename.endsWith('.sql')) {
          const version = filename.split('_')[0];
          migrationFiles.push({
            filename,
            filepath: path.join(this.migrationsDir, filename),
            version
          });
        }
      }

      return migrationFiles.sort((a, b) => a.version.localeCompare(b.version));
    } catch (error) {
      console.error('❌ Error reading migrations directory:', error);
      return [];
    }
  }

  /**
   * Get list of seed files sorted by version
   */
  private async getSeedFiles(): Promise<MigrationFile[]> {
    try {
      const files = await fs.readdir(this.seedsDir);
      const seedFiles: MigrationFile[] = [];

      for (const filename of files) {
        if (filename.endsWith('.sql')) {
          const version = filename.split('_')[0];
          seedFiles.push({
            filename,
            filepath: path.join(this.seedsDir, filename),
            version
          });
        }
      }

      return seedFiles.sort((a, b) => a.version.localeCompare(b.version));
    } catch (error) {
      console.error('❌ Error reading seeds directory:', error);
      return [];
    }
  }

  /**
   * Check if migration has already been executed
   */
  private async isMigrationExecuted(version: string): Promise<boolean> {
    const result = await database.executeQuery(
      'SELECT COUNT(*) as count FROM DatabaseMigrations WHERE Version = @version AND Success = 1',
      { version }
    );
    return result.recordset[0].count > 0;
  }

  /**
   * Execute a single migration file
   */
  private async executeMigration(migrationFile: MigrationFile): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Executing migration: ${migrationFile.filename}`);
      
      const sqlContent = await fs.readFile(migrationFile.filepath, 'utf-8');
      
      // Split SQL content by GO statements and execute each batch
      const batches = sqlContent.split(/^\s*GO\s*$/gim).filter(batch => batch.trim());
      
      for (const batch of batches) {
        if (batch.trim()) {
          await database.executeQuery(batch, {});
        }
      }

      const executionTime = Date.now() - startTime;

      // Record successful migration
      await database.executeQuery(`
        INSERT INTO DatabaseMigrations (Version, Filename, ExecutionTimeMs, Success)
        VALUES (@version, @filename, @executionTime, 1)
      `, {
        version: migrationFile.version,
        filename: migrationFile.filename,
        executionTime
      });

      console.log(`✅ Migration ${migrationFile.filename} completed in ${executionTime}ms`);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Record failed migration
      await database.executeQuery(`
        INSERT INTO DatabaseMigrations (Version, Filename, ExecutionTimeMs, Success, ErrorMessage)
        VALUES (@version, @filename, @executionTime, 0, @errorMessage)
      `, {
        version: migrationFile.version,
        filename: migrationFile.filename,
        executionTime,
        errorMessage
      });

      console.error(`❌ Migration ${migrationFile.filename} failed:`, errorMessage);
      throw error;
    }
  }

  /**
   * Execute a single seed file
   */
  private async executeSeed(seedFile: MigrationFile): Promise<void> {
    try {
      console.log(`🌱 Executing seed: ${seedFile.filename}`);
      
      const sqlContent = await fs.readFile(seedFile.filepath, 'utf-8');
      
      // Split SQL content by GO statements and execute each batch
      const batches = sqlContent.split(/^\s*GO\s*$/gim).filter(batch => batch.trim());
      
      for (const batch of batches) {
        if (batch.trim()) {
          await database.executeQuery(batch, {});
        }
      }

      console.log(`✅ Seed ${seedFile.filename} completed`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Seed ${seedFile.filename} failed:`, errorMessage);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      console.log('🚀 Starting database migrations...');
      
      await this.createMigrationsTable();
      const migrationFiles = await this.getMigrationFiles();

      if (migrationFiles.length === 0) {
        console.log('📝 No migration files found');
        return;
      }

      let executedCount = 0;
      for (const migrationFile of migrationFiles) {
        const isExecuted = await this.isMigrationExecuted(migrationFile.version);
        
        if (!isExecuted) {
          await this.executeMigration(migrationFile);
          executedCount++;
        } else {
          console.log(`⏭️  Migration ${migrationFile.filename} already executed`);
        }
      }

      console.log(`🎉 Migrations completed! Executed ${executedCount} new migrations`);
    } catch (error) {
      console.error('💥 Migration process failed:', error);
      throw error;
    }
  }

  /**
   * Run all seed files
   */
  async runSeeds(): Promise<void> {
    try {
      console.log('🌱 Starting database seeding...');
      
      const seedFiles = await this.getSeedFiles();

      if (seedFiles.length === 0) {
        console.log('📝 No seed files found');
        return;
      }

      for (const seedFile of seedFiles) {
        await this.executeSeed(seedFile);
      }

      console.log('🎉 Database seeding completed!');
    } catch (error) {
      console.error('💥 Seeding process failed:', error);
      throw error;
    }
  }

  /**
   * Run migrations and seeds
   */
  async runAll(): Promise<void> {
    await this.runMigrations();
    await this.runSeeds();
  }
}

// CLI interface
async function main() {
  const migrator = new DatabaseMigrator();
  const command = process.argv[2];

  try {
    switch (command) {
      case 'migrate':
        await migrator.runMigrations();
        break;
      case 'seed':
        await migrator.runSeeds();
        break;
      case 'all':
      default:
        await migrator.runAll();
        break;
    }
    
    console.log('✨ Database operations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Database operations failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export default DatabaseMigrator;