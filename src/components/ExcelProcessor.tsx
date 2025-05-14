
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

class ExcelProcessor {
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
  
  static async combineExcelFiles(excelFiles: File[]): Promise<any[]> {
    // Expected columns to validate Excel structure
    const expectedColumns = ['Emp. No', 'Name', 'Department', 'Section', 'Job Title', 'MessHall'];
    let combinedData: any[] = [];
    
    for (const file of excelFiles) {
      try {
        const data = await this.readExcelFile(file);
        
        // Check if the Excel file has the expected columns
        const fileColumns = Object.keys(data[0] || {});
        const hasExpectedColumns = expectedColumns.every(col => fileColumns.includes(col));
        
        if (hasExpectedColumns) {
          combinedData = [...combinedData, ...data];
        } else {
          console.warn(`Skipping file '${file.name}' as it does not match the expected columns format.`);
        }
      } catch (error) {
        console.error(`Error reading Excel file ${file.name}:`, error);
      }
    }
    
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
        'Merdeka Tsingsan Indonesia', // Company
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
