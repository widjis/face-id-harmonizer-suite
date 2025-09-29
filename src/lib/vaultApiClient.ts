/**
 * Vault API Client for Card Management
 * 
 * This client handles SOAP API operations for the Vault system including:
 * - Adding new cards (AddCard API)
 * - Retrieving card information (GetCard API)
 * - Deleting cards (DeleteCard API)
 * 
 * Based on the Python vault_updater.py implementation
 */

export interface VaultConfig {
  host: string;
  addCardEndpoint: string;
  getCardEndpoint: string;
  timeout?: number;
}

export interface CardProfile {
  CardNo: string;
  Name: string;
  CardPinNo?: string;
  CardType?: string;
  Department?: string;
  Company?: string;
  Gentle?: string;
  AccessLevel?: string;
  FaceAccessLevel?: string;
  LiftAccessLevel?: string;
  BypassAP?: boolean;
  ActiveStatus?: boolean;
  NonExpired?: boolean;
  ExpiredDate?: string;
  VehicleNo?: string;
  FloorNo?: string;
  UnitNo?: string;
  ParkingNo?: string;
  StaffNo?: string;
  Title?: string;
  Position?: string;
  NRIC?: string;
  Passport?: string;
  Race?: string;
  DOB?: string;
  JoiningDate?: string;
  ResignDate?: string;
  Address1?: string;
  Address2?: string;
  PostalCode?: string;
  City?: string;
  State?: string;
  Email?: string;
  MobileNo?: string;
  Photo?: string;
  DownloadCard?: boolean;
}

export interface VaultApiResponse {
  success: boolean;
  ErrCode: string;
  ErrMessage: string;
  MediaID?: string;
}

export interface GetCardResponse {
  success: boolean;
  cards: Array<Record<string, string>>;
  count: number;
  error?: string;
}

export class VaultAPIClient {
  private config: VaultConfig;

  constructor(config: VaultConfig) {
    this.config = {
      timeout: 30000,
      ...config
    };
  }

  /**
   * Create SOAP envelope for AddCard request
   */
  private createAddCardSoapEnvelope(cardProfile: CardProfile): string {
    // Default values for required fields
    const defaults: Partial<CardProfile> = {
      CardPinNo: '',
      CardType: 'Standard',
      Department: '',
      Company: '',
      Gentle: 'Mr',
      AccessLevel: '1',
      FaceAccessLevel: '00',
      LiftAccessLevel: '00',
      BypassAP: false,
      ActiveStatus: true,
      NonExpired: false,
      ExpiredDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      VehicleNo: '',
      FloorNo: '',
      UnitNo: '',
      ParkingNo: '',
      StaffNo: '',
      Title: '',
      Position: '',
      NRIC: '',
      Passport: '',
      Race: '',
      DOB: '',
      JoiningDate: new Date().toISOString().split('T')[0],
      ResignDate: '',
      Address1: '',
      Address2: '',
      PostalCode: '',
      City: '',
      State: '',
      Email: '',
      MobileNo: '',
      Photo: '',
      DownloadCard: true
    };

    // Merge provided profile with defaults
    const profile = { ...defaults, ...cardProfile };

    return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
                 xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <AddCard xmlns="WebAPI">
      <CardProfile>
        <CardNo>${profile.CardNo}</CardNo>
        <Name>${profile.Name}</Name>
        <CardPinNo>${profile.CardPinNo}</CardPinNo>
        <CardType>${profile.CardType}</CardType>
        <Department>${profile.Department}</Department>
        <Company>${profile.Company}</Company>
        <Gentle>${profile.Gentle}</Gentle>
        <AccessLevel>${profile.AccessLevel}</AccessLevel>
        <FaceAccessLevel>${profile.FaceAccessLevel}</FaceAccessLevel>
        <LiftAccessLevel>${profile.LiftAccessLevel}</LiftAccessLevel>
        <BypassAP>${profile.BypassAP?.toString().toLowerCase()}</BypassAP>
        <ActiveStatus>${profile.ActiveStatus?.toString().toLowerCase()}</ActiveStatus>
        <NonExpired>${profile.NonExpired?.toString().toLowerCase()}</NonExpired>
        <ExpiredDate>${profile.ExpiredDate}</ExpiredDate>
        <VehicleNo>${profile.VehicleNo}</VehicleNo>
        <FloorNo>${profile.FloorNo}</FloorNo>
        <UnitNo>${profile.UnitNo}</UnitNo>
        <ParkingNo>${profile.ParkingNo}</ParkingNo>
        <StaffNo>${profile.StaffNo}</StaffNo>
        <Title>${profile.Title}</Title>
        <Position>${profile.Position}</Position>
        <NRIC>${profile.NRIC}</NRIC>
        <Passport>${profile.Passport}</Passport>
        <Race>${profile.Race}</Race>
        <DOB>${profile.DOB}</DOB>
        <JoiningDate>${profile.JoiningDate}</JoiningDate>
        <ResignDate>${profile.ResignDate}</ResignDate>
        <Address1>${profile.Address1}</Address1>
        <Address2>${profile.Address2}</Address2>
        <PostalCode>${profile.PostalCode}</PostalCode>
        <City>${profile.City}</City>
        <State>${profile.State}</State>
        <Email>${profile.Email}</Email>
        <MobileNo>${profile.MobileNo}</MobileNo>
        <Photo>${profile.Photo}</Photo>
        <DownloadCard>${profile.DownloadCard?.toString().toLowerCase()}</DownloadCard>
      </CardProfile>
    </AddCard>
  </soap12:Body>
</soap12:Envelope>`;
  }

  /**
   * Create SOAP envelope for GetCard request
   */
  private createGetCardSoapEnvelope(cardNo: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetCard xmlns="WebAPI">
      <CardNo>${cardNo}</CardNo>
    </GetCard>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * Create SOAP envelope for DeleteCard request
   */
  private createDeleteCardSoapEnvelope(cardNo: string, deleteFromDevice: boolean = true): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <DeleteCard xmlns="WebAPI">
      <CardNo>${cardNo}</CardNo>
      <DeleteFromDevice>${deleteFromDevice.toString().toLowerCase()}</DeleteFromDevice>
    </DeleteCard>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * Parse AddCard SOAP response
   */
  private parseAddCardResponse(responseXml: string): VaultApiResponse {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(responseXml, 'text/xml');

      // Check for parsing errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        return {
          success: false,
          ErrCode: 'XML_PARSE_ERROR',
          ErrMessage: `Failed to parse XML response: ${parseError.textContent}`,
        };
      }

      // Find AddCardResult element
      const resultElement = xmlDoc.querySelector('AddCardResult');
      
      if (resultElement) {
        const errCode = resultElement.querySelector('ErrCode')?.textContent || '';
        const errMessage = resultElement.querySelector('ErrMessage')?.textContent || '';
        const mediaId = resultElement.querySelector('MediaID')?.textContent || '';

        return {
          success: errCode === '' || errCode === '0',
          ErrCode: errCode,
          ErrMessage: errMessage,
          MediaID: mediaId,
        };
      } else {
        // Fallback parsing
        const errCode = xmlDoc.querySelector('ErrCode')?.textContent || 'PARSE_ERROR';
        const errMessage = xmlDoc.querySelector('ErrMessage')?.textContent || 'Could not parse response';
        const mediaId = xmlDoc.querySelector('MediaID')?.textContent || '';

        return {
          success: errCode === '' || errCode === '0',
          ErrCode: errCode,
          ErrMessage: errMessage,
          MediaID: mediaId,
        };
      }
    } catch (error) {
      return {
        success: false,
        ErrCode: 'UNKNOWN_ERROR',
        ErrMessage: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Parse GetCard SOAP response
   */
  private parseGetCardResponse(responseXml: string): GetCardResponse {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(responseXml, 'text/xml');

      // Check for parsing errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        return {
          success: false,
          cards: [],
          count: 0,
          error: `Failed to parse XML response: ${parseError.textContent}`,
        };
      }

      // Find GetCardResult element
      const resultElement = xmlDoc.querySelector('GetCardResult');
      
      if (!resultElement) {
        return {
          success: false,
          cards: [],
          count: 0,
          error: 'No GetCardResult element found',
        };
      }

      // Look for diffgram and DocumentElement
      const documentElement = resultElement.querySelector('DocumentElement');
      
      if (!documentElement) {
        return {
          success: false,
          cards: [],
          count: 0,
          error: 'No DocumentElement found',
        };
      }

      // Parse Card elements
      const cardElements = documentElement.querySelectorAll('Card');
      const cards: Array<Record<string, string>> = [];

      cardElements.forEach(cardElement => {
        const cardData: Record<string, string> = {};
        
        // Extract all child elements as card fields
        Array.from(cardElement.children).forEach(field => {
          const fieldName = field.tagName;
          const fieldValue = field.textContent || '';
          cardData[fieldName] = fieldValue;
        });

        if (Object.keys(cardData).length > 0) {
          cards.push(cardData);
        }
      });

      return {
        success: true,
        cards,
        count: cards.length,
      };
    } catch (error) {
      return {
        success: false,
        cards: [],
        count: 0,
        error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Add a new card to the vault system
   */
  async addCard(cardProfile: CardProfile): Promise<VaultApiResponse> {
    try {
      const soapEnvelope = this.createAddCardSoapEnvelope(cardProfile);
      const url = `http://${this.config.host}${this.config.addCardEndpoint}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'Content-Length': soapEnvelope.length.toString(),
        },
        body: soapEnvelope,
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!response.ok) {
        return {
          success: false,
          ErrCode: `HTTP_${response.status}`,
          ErrMessage: `HTTP error ${response.status}: ${response.statusText}`,
        };
      }

      const responseText = await response.text();
      return this.parseAddCardResponse(responseText);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          ErrCode: 'TIMEOUT_ERROR',
          ErrMessage: 'Request timed out',
        };
      }

      return {
        success: false,
        ErrCode: 'NETWORK_ERROR',
        ErrMessage: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get card information by card number
   */
  async getCard(cardNo: string): Promise<GetCardResponse> {
    try {
      const soapEnvelope = this.createGetCardSoapEnvelope(cardNo);
      const url = `http://${this.config.host}${this.config.getCardEndpoint}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'WebAPI/GetCard',
        },
        body: soapEnvelope,
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!response.ok) {
        return {
          success: false,
          cards: [],
          count: 0,
          error: `HTTP error ${response.status}: ${response.statusText}`,
        };
      }

      const responseText = await response.text();
      return this.parseGetCardResponse(responseText);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          cards: [],
          count: 0,
          error: 'Request timed out',
        };
      }

      return {
        success: false,
        cards: [],
        count: 0,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check if a card exists in the system
   */
  async cardExists(cardNo: string): Promise<boolean> {
    const result = await this.getCard(cardNo);
    return result.success && result.count > 0;
  }

  /**
   * Delete a card from the vault system
   */
  async deleteCard(cardNo: string, deleteFromDevice: boolean = true): Promise<VaultApiResponse> {
    try {
      const soapEnvelope = this.createDeleteCardSoapEnvelope(cardNo, deleteFromDevice);
      const url = `http://${this.config.host}${this.config.getCardEndpoint}`; // Uses same endpoint as GetCard

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'WebAPI/DeleteCard',
        },
        body: soapEnvelope,
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!response.ok) {
        return {
          success: false,
          ErrCode: `HTTP_${response.status}`,
          ErrMessage: `HTTP error ${response.status}: ${response.statusText}`,
        };
      }

      const responseText = await response.text();
      return this.parseAddCardResponse(responseText); // Same parsing logic
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          ErrCode: 'TIMEOUT_ERROR',
          ErrMessage: 'Request timed out',
        };
      }

      return {
        success: false,
        ErrCode: 'NETWORK_ERROR',
        ErrMessage: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Process multiple cards in batch
   */
  async addCardsBatch(cardProfiles: CardProfile[]): Promise<Array<{ cardNo: string; result: VaultApiResponse }>> {
    const results: Array<{ cardNo: string; result: VaultApiResponse }> = [];

    for (const profile of cardProfiles) {
      const result = await this.addCard(profile);
      results.push({
        cardNo: profile.CardNo,
        result,
      });

      // Add small delay between requests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }
}

// Default configuration for MTI Vault system
export const DEFAULT_VAULT_CONFIG: VaultConfig = {
  host: '10.60.10.6',
  addCardEndpoint: '/Vaultsite/APIwebservice.asmx',
  getCardEndpoint: '/Vaultsite/APIwebservice2.asmx',
  timeout: 30000,
};

// SQL Server configuration for direct database access
export interface SqlServerConfig {
  server: string;
  user: string;
  password: string;
  database?: string;
  port?: number;
}

export const DEFAULT_SQL_CONFIG: SqlServerConfig = {
  server: '10.60.10.47',
  user: 'sa',
  password: 'Bl4ck3y34dmin',
  database: 'VaultIDCardProcessor',
  port: 1433,
};