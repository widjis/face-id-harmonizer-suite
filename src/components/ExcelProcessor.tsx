
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

class ExcelProcessor {
  // Define the expected column headers and possible alternatives
  static readonly expectedColumnMappings = {
    'Emp. No': ['emp. no', 'emp no', 'employee no', 'employee number', 'id', 'employee id', 'staff id', 'staff no'],
    'Name': ['name', 'employee name', 'full name', 'staff name'],
    'Department': ['department', 'dept', 'division'],
    'Section': ['section', 'unit', 'team', 'group'],
    'Job Title': ['job title', 'position', 'role', 'designation', 'title'],
    'MessHall': ['messhall', 'mess hall', 'canteen', 'cafeteria', 'dining']
  };

  static async processExcelFiles(excelFiles: File[]): Promise<void> {
    try {
      // First, combine Excel files
      const combinedData = await this.combineExcelFiles(excelFiles);
      
      if (combinedData.length === 0) {
        throw new Error("No valid data found in Excel files");
      }
      
      // Process the combined data to generate the output Excel file
      const outputExcel = await this.generateOutputExcel(combinedData);
      
      // Generate CSV file
      const csvData = await this.generateCSVData(combinedData);
      
      // Format current date for filenames
      const currentDate = new Date();
      const formattedDate = `${currentDate.getDate()}-${currentDate.getMonth() + 1}-${currentDate.getFullYear()}`;
      
      // Create and download the Excel file
      const excelBlob = new Blob([outputExcel], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(excelBlob, `For_Machine_${formattedDate}.xlsx`);
      
      // Create and download the CSV file
      const csvBlob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      saveAs(csvBlob, `CardDatafileformat_${formattedDate}.csv`);
      
      return Promise.resolve();
    } catch (error) {
      console.error("Error processing Excel files:", error);
      return Promise.reject(error);
    }
  }

  static findMatchingStandardHeader(header: string): string | null {
    header = header.trim().toLowerCase();
    
    for (const [standardHeader, alternatives] of Object.entries(this.expectedColumnMappings)) {
      if (alternatives.includes(header)) {
        return standardHeader;
      }
    }
    
    return null;
  }
  
  static mapHeaders(originalHeaders: string[]): Record<string, string> {
    const headerMapping: Record<string, string> = {};
    const standardHeaders = Object.keys(this.expectedColumnMappings);
    const unmappedStandardHeaders = new Set(standardHeaders);
    
    // First pass - look for exact matches and alternative matches
    for (const originalHeader of originalHeaders) {
      // Check if it's a standard header (case insensitive)
      const standardHeader = standardHeaders.find(
        std => std.toLowerCase() === originalHeader.toLowerCase()
      );
      
      if (standardHeader) {
        headerMapping[originalHeader] = standardHeader;
        unmappedStandardHeaders.delete(standardHeader);
        continue;
      }
      
      // Check for alternative matches
      const matchedStandard = this.findMatchingStandardHeader(originalHeader);
      if (matchedStandard) {
        headerMapping[originalHeader] = matchedStandard;
        unmappedStandardHeaders.delete(matchedStandard);
      }
    }
    
    // If we have unmapped standard headers, try to make best guesses
    if (unmappedStandardHeaders.size > 0 && originalHeaders.length > 0) {
      console.warn(`Some headers couldn't be mapped automatically. Making best guesses.`);
      
      // Try to map remaining headers based on similarity
      for (const unmapped of unmappedStandardHeaders) {
        for (const original of originalHeaders) {
          if (!Object.values(headerMapping).includes(unmapped)) {
            // If this original header isn't already mapped to something else
            if (!Object.keys(headerMapping).includes(original)) {
              headerMapping[original] = unmapped;
              break;
            }
          }
        }
      }
    }
    
    return headerMapping;
  }
  
  static async combineExcelFiles(excelFiles: File[]): Promise<any[]> {
    let combinedData: any[] = [];
    let processedFiles = 0;
    
    for (const file of excelFiles) {
      try {
        const rawData = await this.readExcelFile(file);
        
        if (rawData.length === 0) {
          console.warn(`File '${file.name}' appears to be empty.`);
          continue;
        }
        
        // Get headers from the first row
        const fileHeaders = Object.keys(rawData[0]);
        
        // Try to map the headers to our expected format
        const headerMapping = this.mapHeaders(fileHeaders);
        const mappedHeaders = Object.keys(headerMapping).length;
        
        if (mappedHeaders === 0) {
          console.warn(`Skipping file '${file.name}' as no headers could be mapped.`);
          continue;
        }
        
        if (mappedHeaders < 6) {
          console.warn(`File '${file.name}' only has ${mappedHeaders}/6 headers mapped. Attempting to process anyway.`);
        } else {
          console.log(`Successfully mapped all headers for file '${file.name}'.`);
        }
        
        // Transform the data using the header mapping
        const transformedData = rawData.map(row => {
          const newRow: Record<string, any> = {};
          
          // Map each field to the standardized header
          for (const [originalHeader, standardHeader] of Object.entries(headerMapping)) {
            if (row[originalHeader] !== undefined) {
              newRow[standardHeader] = row[originalHeader];
            }
          }
          
          return newRow;
        });
        
        combinedData = [...combinedData, ...transformedData];
        processedFiles++;
      } catch (error) {
        console.error(`Error reading Excel file ${file.name}:`, error);
      }
    }
    
    console.log(`Successfully processed ${processedFiles} out of ${excelFiles.length} files.`);
    return combinedData;
  }
  
  static async readExcelFile(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            return reject(new Error('Failed to read file'));
          }
          
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convert sheet to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
      
      reader.readAsBinaryString(file);
    });
  }
  
  static async generateOutputExcel(data: any[]): Promise<ArrayBuffer> {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Combined Data');
    
    return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  }
  
  static async generateCSVData(inputData: any[]): Promise<string> {
    // Create CSV header row
    const csvHeaders = [
      'Card No #[Max 10]',
      'Card Name [Max 50]',
      'Staff No [Max 15]',
      'Department [Max 50]',
      'Access Level [Max 3]',
      'Company [Max 50]',
      'NRIC/Pass [Max 50]',
      'Remark  [Max 100]',
      'Email [Max 50]',
      'Status [True/False]',
      'Lift Access Level [Max 3]',
      'Vehicle No [Max 15]',
      'ExpiryDate dd/MM/yyyy HH:mm:ss  [Blank for non expired card]',
      'Address [Max 50]',
      'Unit No [Max 15]',
      'Emergency Card [True/False]',
      'Face Access Level [Max 3]'
    ];
    
    // Start with CSV header
    let csvContent = csvHeaders.join(',') + '\n';
    
    // Process each row of input data
    for (const row of inputData) {
      // Determine access level based on MessHall
      let accessLevel = 13; // Default
      if (row.MessHall && typeof row.MessHall === 'string') {
        const messHall = row.MessHall.toLowerCase();
        if (messHall.includes('senior')) {
          accessLevel = 4;
        } else if (messHall.includes('junior')) {
          accessLevel = 2;
        }
      }
      
      // Determine vehicle value based on MessHall
      let vehicleValue = 'No Access!!'; // Default
      if (row.MessHall && typeof row.MessHall === 'string') {
        const messHall = row.MessHall.toLowerCase();
        if (messHall.includes('senior')) {
          vehicleValue = 'Senior Messhall';
        } else if (messHall.includes('junior')) {
          vehicleValue = 'Junior Messhall';
        }
      }
      
      // Create CSV row with transformed data
      const csvRow = [
        '', // Card No
        row.Name || '', // Card Name
        row['Emp. No'] || '', // Staff No
        row.Department || '', // Department
        accessLevel, // Access Level
        'Merdeka Tsingshan Indonesia', // Company
        '', // NRIC/Pass
        '', // Remark
        '', // Email
        'TRUE', // Status
        '', // Lift Access Level
        vehicleValue, // Vehicle No
        '', // ExpiryDate
        '', // Address
        '', // Unit No
        '', // Emergency Card
        '' // Face Access Level
      ]
      .map(value => {
        // Handle string escaping for CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(',');
      
      csvContent += csvRow + '\n';
    }
    
    return csvContent;
  }
}

export default ExcelProcessor;
