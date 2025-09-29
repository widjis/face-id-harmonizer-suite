import axios, { AxiosResponse } from 'axios';
import { parseStringPromise, Builder } from 'xml2js';
import database from '@/config/database';
import logger from '@/utils/logger';
import { VaultCardProfile, VaultApiResponse, VaultConfiguration } from '@/types';

export interface VaultApiLogEntry {
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
}

export class VaultApiService {
  private static instance: VaultApiService;
  private activeConfig: VaultConfiguration | null = null;
  private configLastFetched: Date | null = null;
  private readonly CONFIG_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): VaultApiService {
    if (!VaultApiService.instance) {
      VaultApiService.instance = new VaultApiService();
    }
    return VaultApiService.instance;
  }

  /**
   * Get the active vault configuration with caching
   */
  private async getActiveVaultConfig(): Promise<VaultConfiguration> {
    const now = new Date();
    
    // Check if we need to refresh the config
    if (!this.activeConfig || !this.configLastFetched || 
        (now.getTime() - this.configLastFetched.getTime()) > this.CONFIG_CACHE_DURATION) {
      
      try {
        const result = await database.executeQuery(`
          SELECT Id, Name, Host, Port, IsSecure, ApiVersion, IsActive, CreatedAt, UpdatedAt
          FROM VaultConfigurations
          WHERE IsActive = 1
        `);

        if (result.recordset.length === 0) {
          throw new Error('No active vault configuration found');
        }

        const config = result.recordset[0];
        this.activeConfig = {
          id: config.Id,
          name: config.Name,
          host: config.Host,
          port: config.Port,
          isSecure: config.IsSecure,
          apiVersion: config.ApiVersion,
          isActive: config.IsActive,
          createdAt: config.CreatedAt,
          updatedAt: config.UpdatedAt
        };
        this.configLastFetched = now;
        
        logger.info(`Vault configuration loaded: ${this.activeConfig.name} at ${this.activeConfig.host}:${this.activeConfig.port}`);
      } catch (error) {
        logger.error('Failed to load active vault configuration:', error);
        throw new Error('Failed to load vault configuration');
      }
    }

    return this.activeConfig!;
  }

  /**
   * Build the base URL for vault API calls
   */
  private async getBaseUrl(): Promise<string> {
    const config = await this.getActiveVaultConfig();
    const protocol = config.isSecure ? 'https' : 'http';
    return `${protocol}://${config.host}:${config.port}`;
  }

  /**
   * Log API call to database
   */
  private async logApiCall(logEntry: VaultApiLogEntry): Promise<void> {
    try {
      await database.executeQuery(`
        INSERT INTO VaultApiLogs (
          BatchId, EmployeeId, ApiEndpoint, RequestMethod, RequestPayload,
          ResponseStatus, ResponseBody, ExecutionTimeMs, Success, ErrorMessage, CreatedBy
        ) VALUES (
          @batchId, @employeeId, @apiEndpoint, @requestMethod, @requestPayload,
          @responseStatus, @responseBody, @executionTimeMs, @success, @errorMessage, @createdBy
        )
      `, {
        batchId: logEntry.batchId || null,
        employeeId: logEntry.employeeId || null,
        apiEndpoint: logEntry.apiEndpoint,
        requestMethod: logEntry.requestMethod,
        requestPayload: logEntry.requestPayload || null,
        responseStatus: logEntry.responseStatus || null,
        responseBody: logEntry.responseBody || null,
        executionTimeMs: logEntry.executionTimeMs || null,
        success: logEntry.success,
        errorMessage: logEntry.errorMessage || null,
        createdBy: logEntry.createdBy
      });
    } catch (error) {
      logger.error('Failed to log API call:', error);
      // Don't throw here as it shouldn't break the main operation
    }
  }

  /**
   * Create SOAP envelope for API calls
   */
  private createSoapEnvelope(methodName: string, parameters: Record<string, any>): string {
    const builder = new Builder({
      xmldec: { version: '1.0', encoding: 'utf-8' },
      rootName: 'soap:Envelope',
      renderOpts: { pretty: false }
    });

    const envelope = {
      $: {
        'xmlns:soap': 'http://schemas.xmlsoap.org/soap/envelope/',
        'xmlns:tem': 'http://tempuri.org/'
      },
      'soap:Header': {},
      'soap:Body': {
        [`tem:${methodName}`]: parameters
      }
    };

    return builder.buildObject(envelope);
  }

  /**
   * Parse SOAP response
   */
  private async parseSoapResponse(responseXml: string): Promise<any> {
    try {
      const result = await parseStringPromise(responseXml, {
        explicitArray: false,
        ignoreAttrs: true,
        tagNameProcessors: [(name: string) => name.replace(/^.*:/, '')] // Remove namespace prefixes
      });

      return result;
    } catch (error) {
      logger.error('Failed to parse SOAP response:', error);
      throw new Error('Invalid SOAP response format');
    }
  }

  /**
   * Make SOAP API call
   */
  private async makeSoapCall(
    endpoint: string,
    methodName: string,
    parameters: Record<string, any>,
    userId: string,
    batchId?: string,
    employeeId?: string
  ): Promise<any> {
    const startTime = Date.now();
    const baseUrl = await this.getBaseUrl();
    const fullUrl = `${baseUrl}${endpoint}`;
    
    const soapEnvelope = this.createSoapEnvelope(methodName, parameters);
    
    const logEntry: VaultApiLogEntry = {
      batchId,
      employeeId,
      apiEndpoint: fullUrl,
      requestMethod: 'POST',
      requestPayload: soapEnvelope,
      success: false,
      createdBy: userId
    };

    try {
      const response: AxiosResponse = await axios.post(fullUrl, soapEnvelope, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': `http://tempuri.org/${methodName}`
        },
        timeout: 30000 // 30 second timeout
      });

      const executionTime = Date.now() - startTime;
      const parsedResponse = await this.parseSoapResponse(response.data);

      logEntry.responseStatus = response.status;
      logEntry.responseBody = JSON.stringify(parsedResponse);
      logEntry.executionTimeMs = executionTime;
      logEntry.success = true;

      await this.logApiCall(logEntry);

      logger.info(`SOAP call successful: ${methodName} (${executionTime}ms)`);
      return parsedResponse;

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      logEntry.executionTimeMs = executionTime;
      logEntry.errorMessage = error.message;
      
      if (error.response) {
        logEntry.responseStatus = error.response.status;
        logEntry.responseBody = error.response.data;
      }

      await this.logApiCall(logEntry);

      logger.error(`SOAP call failed: ${methodName}`, error);
      throw error;
    }
  }

  /**
   * Add a new card to the Vault system
   */
  public async addCard(
    cardProfile: VaultCardProfile,
    userId: string,
    batchId?: string,
    employeeId?: string
  ): Promise<VaultApiResponse> {
    try {
      logger.info(`Adding card for employee: ${cardProfile.EmployeeId}`);

      const parameters = {
        'tem:CardNumber': cardProfile.CardNumber,
        'tem:FirstName': cardProfile.FirstName,
        'tem:LastName': cardProfile.LastName,
        'tem:MiddleName': cardProfile.MiddleName || '',
        'tem:Department': cardProfile.Department,
        'tem:Section': cardProfile.Section || '',
        'tem:JobTitle': cardProfile.JobTitle || '',
        'tem:MessHall': cardProfile.MessHall || '',
        'tem:Email': cardProfile.Email || '',
        'tem:EmployeeId': cardProfile.EmployeeId
      };

      const response = await this.makeSoapCall(
        '/Vaultsite/APIwebservice.asmx',
        'AddCard',
        parameters,
        userId,
        batchId,
        employeeId
      );

      // Parse the response to extract card ID and success status
      const envelope = response.Envelope || response;
      const body = envelope.Body || envelope;
      const addCardResponse = body.AddCardResponse || body;
      const result = addCardResponse.AddCardResult || addCardResponse;

      if (result && result.Success !== false) {
        return {
          success: true,
          cardId: result.CardId || cardProfile.CardNumber,
          message: result.Message || 'Card added successfully'
        };
      } else {
        return {
          success: false,
          error: result?.Message || 'Failed to add card to Vault system'
        };
      }

    } catch (error: any) {
      logger.error('Add card operation failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to communicate with Vault system'
      };
    }
  }

  /**
   * Retrieve card information from the Vault system
   */
  public async getCard(
    cardNumber: string,
    userId: string,
    batchId?: string,
    employeeId?: string
  ): Promise<VaultApiResponse & { cardProfile?: VaultCardProfile }> {
    try {
      logger.info(`Retrieving card: ${cardNumber}`);

      const parameters = {
        'tem:CardNumber': cardNumber
      };

      const response = await this.makeSoapCall(
        '/Vaultsite/APIwebservice2.asmx',
        'GetCard',
        parameters,
        userId,
        batchId,
        employeeId
      );

      // Parse the response
      const envelope = response.Envelope || response;
      const body = envelope.Body || envelope;
      const getCardResponse = body.GetCardResponse || body;
      const result = getCardResponse.GetCardResult || getCardResponse;

      if (result && result.Success !== false) {
        const cardProfile: VaultCardProfile = {
          CardNumber: result.CardNumber || cardNumber,
          FirstName: result.FirstName || '',
          LastName: result.LastName || '',
          MiddleName: result.MiddleName || '',
          Department: result.Department || '',
          Section: result.Section || '',
          JobTitle: result.JobTitle || '',
          MessHall: result.MessHall || '',
          Email: result.Email || '',
          EmployeeId: result.EmployeeId || ''
        };

        return {
          success: true,
          cardId: cardNumber,
          message: 'Card retrieved successfully',
          cardProfile
        };
      } else {
        return {
          success: false,
          error: result?.Message || 'Card not found in Vault system'
        };
      }

    } catch (error: any) {
      logger.error('Get card operation failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to communicate with Vault system'
      };
    }
  }

  /**
   * Delete a card from the Vault system
   */
  public async deleteCard(
    cardNumber: string,
    userId: string,
    batchId?: string,
    employeeId?: string
  ): Promise<VaultApiResponse> {
    try {
      logger.info(`Deleting card: ${cardNumber}`);

      const parameters = {
        'tem:CardNumber': cardNumber
      };

      const response = await this.makeSoapCall(
        '/Vaultsite/APIwebservice.asmx',
        'DeleteCard',
        parameters,
        userId,
        batchId,
        employeeId
      );

      // Parse the response
      const envelope = response.Envelope || response;
      const body = envelope.Body || envelope;
      const deleteCardResponse = body.DeleteCardResponse || body;
      const result = deleteCardResponse.DeleteCardResult || deleteCardResponse;

      if (result && result.Success !== false) {
        return {
          success: true,
          cardId: cardNumber,
          message: result.Message || 'Card deleted successfully'
        };
      } else {
        return {
          success: false,
          error: result?.Message || 'Failed to delete card from Vault system'
        };
      }

    } catch (error: any) {
      logger.error('Delete card operation failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to communicate with Vault system'
      };
    }
  }

  /**
   * Test connection to the Vault system
   */
  public async testConnection(userId: string): Promise<VaultApiResponse> {
    try {
      logger.info('Testing Vault system connection');

      const parameters = {};

      const response = await this.makeSoapCall(
        '/Vaultsite/APIwebservice.asmx',
        'TestConnection',
        parameters,
        userId
      );

      return {
        success: true,
        message: 'Connection to Vault system successful'
      };

    } catch (error: any) {
      logger.error('Vault connection test failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to connect to Vault system'
      };
    }
  }

  /**
   * Batch process multiple card operations
   */
  public async batchProcessCards(
    operations: Array<{
      operation: 'add' | 'update' | 'delete';
      cardProfile?: VaultCardProfile;
      cardNumber?: string;
    }>,
    userId: string,
    batchId?: string
  ): Promise<Array<VaultApiResponse & { operation: string; cardNumber?: string }>> {
    const results: Array<VaultApiResponse & { operation: string; cardNumber?: string }> = [];

    for (const op of operations) {
      try {
        let result: VaultApiResponse;
        
        switch (op.operation) {
          case 'add':
            if (!op.cardProfile) {
              throw new Error('Card profile required for add operation');
            }
            result = await this.addCard(op.cardProfile, userId, batchId);
            break;
            
          case 'delete':
            if (!op.cardNumber) {
              throw new Error('Card number required for delete operation');
            }
            result = await this.deleteCard(op.cardNumber, userId, batchId);
            break;
            
          default:
            throw new Error(`Unsupported operation: ${op.operation}`);
        }

        results.push({
          ...result,
          operation: op.operation,
          cardNumber: op.cardProfile?.CardNumber || op.cardNumber
        });

      } catch (error: any) {
        results.push({
          success: false,
          error: error.message,
          operation: op.operation,
          cardNumber: op.cardProfile?.CardNumber || op.cardNumber
        });
      }
    }

    return results;
  }

  /**
   * Clear cached configuration (useful for testing or when config changes)
   */
  public clearConfigCache(): void {
    this.activeConfig = null;
    this.configLastFetched = null;
    logger.info('Vault configuration cache cleared');
  }
}

export default VaultApiService.getInstance();