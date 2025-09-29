import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import database from '../config/database';
import { MulterRequest, ApiResponse, FileUpload, PaginatedResponse } from '../types';
import { authenticateToken } from '../middleware/auth';

/**
 * @swagger
 * components:
 *   schemas:
 *     FileUpload:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the file
 *         batchId:
 *           type: string
 *           format: uuid
 *           description: Optional batch identifier for grouping files
 *           nullable: true
 *         fileName:
 *           type: string
 *           description: Generated filename on server
 *         originalName:
 *           type: string
 *           description: Original filename from upload
 *         fileType:
 *           type: string
 *           enum: [excel, image]
 *           description: Type of file uploaded
 *         fileSize:
 *           type: integer
 *           description: File size in bytes
 *         filePath:
 *           type: string
 *           description: Server file path
 *         mimeType:
 *           type: string
 *           description: MIME type of the file
 *         uploadedBy:
 *           type: string
 *           format: uuid
 *           description: ID of user who uploaded the file
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Upload timestamp
 *       required:
 *         - id
 *         - fileName
 *         - originalName
 *         - fileType
 *         - fileSize
 *         - filePath
 *         - mimeType
 *         - uploadedBy
 *         - createdAt
 *     
 *     FileUploadList:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/FileUpload'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *             limit:
 *               type: integer
 *             total:
 *               type: integer
 *             totalPages:
 *               type: integer
 *         timestamp:
 *           type: string
 *           format: date-time
 */

const router = Router();

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../../uploads');
const excelDir = path.join(uploadDir, 'excel');
const imageDir = path.join(uploadDir, 'images');

// Create directories if they don't exist
const ensureDirectories = async () => {
  try {
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.mkdir(excelDir, { recursive: true });
    await fs.mkdir(imageDir, { recursive: true });
  } catch (error) {
    console.error('Error creating upload directories:', error);
  }
};

ensureDirectories();

// File filter function
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExcelTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  const allowedImageTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ];

  if (file.fieldname === 'excel' && allowedExcelTypes.includes(file.mimetype)) {
    cb(null, true);
  } else if (file.fieldname === 'images' && allowedImageTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${file.fieldname}: ${file.mimetype}`));
  }
};

// Excel file storage configuration
const excelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, excelDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Image file storage configuration
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imageDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Multer configurations
const uploadExcel = multer({
  storage: excelStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for Excel files
  }
});

const uploadImages = multer({
  storage: imageStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit per image
  }
});

// Helper function to save file info to database
const saveFileToDatabase = async (
  file: Express.Multer.File,
  fileType: 'excel' | 'image',
  uploadedBy: string,
  batchId?: string
): Promise<string> => {
  const fileId = uuidv4();
  
  await database.executeQuery(`
    INSERT INTO FileUploads (id, batchId, fileName, originalName, fileType, fileSize, filePath, mimeType, uploadedBy, createdAt)
    VALUES (@fileId, @batchId, @fileName, @originalName, @fileType, @fileSize, @filePath, @mimeType, @uploadedBy, GETDATE())
  `, { fileId, batchId: batchId || null, fileName: file.filename, originalName: file.originalname, fileType, fileSize: file.size, filePath: file.path, mimeType: file.mimetype, uploadedBy });

  // Log audit trail
  await database.executeQuery(`
    INSERT INTO AuditTrail (id, userId, action, entityType, entityId, newValues, ipAddress, userAgent, createdAt)
    VALUES (@auditId, @userId, 'CREATE', 'FileUpload', @entityId, @newValues, @ipAddress, @userAgent, GETDATE())
  `, {
    auditId: uuidv4(),
    userId: uploadedBy,
    entityId: fileId,
    newValues: JSON.stringify({ fileName: file.filename, fileType, fileSize: file.size }),
    ipAddress: null, // IP address would be added by middleware
    userAgent: null  // User agent would be added by middleware
  });

  return fileId;
};

// Upload single Excel file
/**
 * @swagger
 * /api/upload/excel:
 *   post:
 *     summary: Upload Excel file
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               excel:
 *                 type: string
 *                 format: binary
 *                 description: Excel file to upload (.xls, .xlsx)
 *               batchId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional batch identifier for grouping files
 *             required:
 *               - excel
 *     responses:
 *       201:
 *         description: Excel file uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/FileUpload'
 *                 message:
 *                   type: string
 *                   example: "Excel file uploaded successfully"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request - No file uploaded or invalid file type
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       413:
 *         description: Payload too large - File exceeds 10MB limit
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/excel', authenticateToken, uploadExcel.single('excel'), async (req: MulterRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No Excel file uploaded',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    const { batchId } = req.body;
    const fileId = await saveFileToDatabase(req.file, 'excel', req.user.id, batchId);

    const fileInfo: FileUpload = {
      id: fileId,
      batchId: batchId || undefined,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      fileType: 'excel',
      fileSize: req.file.size,
      filePath: req.file.path,
      mimeType: req.file.mimetype,
      uploadedBy: req.user.id,
      createdAt: new Date()
    };

    return res.status(201).json({
      success: true,
      data: fileInfo,
      message: 'Excel file uploaded successfully',
      timestamp: new Date().toISOString()
    } as ApiResponse<FileUpload>);

  } catch (error) {
    console.error('Excel upload error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload Excel file',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// Upload multiple image files
/**
 * @swagger
 * /api/upload/images:
 *   post:
 *     summary: Upload multiple image files
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Image files to upload (jpeg, jpg, png, gif, webp)
 *                 maxItems: 50
 *               batchId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional batch identifier for grouping files
 *             required:
 *               - images
 *     responses:
 *       201:
 *         description: Image files uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FileUpload'
 *                 message:
 *                   type: string
 *                   example: "5 image files uploaded successfully"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request - No files uploaded or invalid file types
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       413:
 *         description: Payload too large - File exceeds 5MB limit per image
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/images', authenticateToken, uploadImages.array('images', 50), async (req: MulterRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No image files uploaded',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    const { batchId } = req.body;
    const uploadedFiles: FileUpload[] = [];

    for (const file of files) {
      const fileId = await saveFileToDatabase(file, 'image', req.user.id, batchId);
      
      uploadedFiles.push({
        id: fileId,
        batchId: batchId || undefined,
        fileName: file.filename,
        originalName: file.originalname,
        fileType: 'image',
        fileSize: file.size,
        filePath: file.path,
        mimeType: file.mimetype,
        uploadedBy: req.user.id,
        createdAt: new Date()
      });
    }

    return res.status(201).json({
      success: true,
      data: uploadedFiles,
      message: `${uploadedFiles.length} image files uploaded successfully`,
      timestamp: new Date().toISOString()
    } as ApiResponse<FileUpload[]>);

  } catch (error) {
    console.error('Images upload error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload image files',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// Get uploaded files with pagination and filtering
/**
 * @swagger
 * /api/upload:
 *   get:
 *     summary: Get uploaded files with pagination and filtering
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of files per page
 *       - in: query
 *         name: fileType
 *         schema:
 *           type: string
 *           enum: [excel, image]
 *         description: Filter by file type
 *       - in: query
 *         name: batchId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by batch ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in original filename or server filename
 *     responses:
 *       200:
 *         description: Files retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileUploadList'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', authenticateToken, async (req: MulterRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const fileType = req.query.fileType as string;
    const batchId = req.query.batchId as string;
    const search = req.query.search as string;

    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    const params: any = {};
    
    if (fileType) {
      whereClause += ' AND fileType = @fileType';
      params.fileType = fileType;
    }
    
    if (batchId) {
      whereClause += ' AND batchId = @batchId';
      params.batchId = batchId;
    }
    
    if (search) {
      whereClause += ' AND (originalName LIKE @search OR fileName LIKE @search)';
      params.search = `%${search}%`;
    }

    // Get total count
    const countResult = await database.executeQuery(`
      SELECT COUNT(*) as total FROM FileUploads ${whereClause}
    `, params);
    
    const total = countResult.recordset[0].total;

    // Get files with pagination
    const filesResult = await database.executeQuery(`
      SELECT * FROM FileUploads ${whereClause}
      ORDER BY createdAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `, { ...params, offset, limit });

    const files = filesResult.recordset;

    return res.json({
      success: true,
      data: files,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      timestamp: new Date().toISOString()
    } as PaginatedResponse<FileUpload>);

  } catch (error) {
    console.error('Get files error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve files',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// Delete uploaded file
/**
 * @swagger
 * /api/upload/{fileId}:
 *   delete:
 *     summary: Delete uploaded file
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the file to delete
 *     responses:
 *       200:
 *         description: File deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "File deleted successfully"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: File not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:fileId', authenticateToken, async (req: MulterRequest, res: Response) => {
  try {
    const { fileId } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    // Get file info
    const fileResult = await database.executeQuery(`
      SELECT * FROM FileUploads WHERE id = @fileId
    `, { fileId });

    if (fileResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    const file = fileResult.recordset[0];

    // Delete physical file
    try {
      await fs.unlink(file.filePath);
    } catch (fsError) {
      console.warn('Could not delete physical file:', fsError);
    }

    // Delete from database
    await database.executeQuery(`
      DELETE FROM FileUploads WHERE id = @fileId
    `, { fileId });

    // Log audit trail
    await database.executeQuery(`
      INSERT INTO AuditTrail (id, userId, action, entityType, entityId, oldValues, ipAddress, userAgent, createdAt)
      VALUES (@auditId, @userId, 'DELETE', 'FileUpload', @entityId, @oldValues, @ipAddress, @userAgent, GETDATE())
    `, {
      auditId: uuidv4(),
      userId: req.user.id,
      entityId: fileId,
      oldValues: JSON.stringify({ fileName: file.fileName, fileType: file.fileType }),
      ipAddress: null,
      userAgent: null
    });

    return res.json({
      success: true,
      message: 'File deleted successfully',
      timestamp: new Date().toISOString()
    } as ApiResponse);

  } catch (error) {
    console.error('Delete file error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete file',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

// Download file
/**
 * @swagger
 * /api/upload/download/{fileId}:
 *   get:
 *     summary: Download uploaded file
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the file to download
 *     responses:
 *       200:
 *         description: File downloaded successfully
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.ms-excel:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *           image/gif:
 *             schema:
 *               type: string
 *               format: binary
 *           image/webp:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *             description: Attachment with original filename
 *           Content-Type:
 *             schema:
 *               type: string
 *             description: MIME type of the file
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: File not found or physical file missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/download/:fileId', authenticateToken, async (req: MulterRequest, res: Response) => {
  try {
    const { fileId } = req.params;

    // Get file info
    const fileResult = await database.executeQuery(`
      SELECT * FROM FileUploads WHERE id = @fileId
    `, { fileId });

    if (fileResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    const file = fileResult.recordset[0];

    // Check if physical file exists
    try {
      await fs.access(file.filePath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Physical file not found',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');

    // Send file
    return res.sendFile(path.resolve(file.filePath));

  } catch (error) {
    console.error('Download file error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to download file',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

export default router;