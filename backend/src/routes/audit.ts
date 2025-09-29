import express from 'express';
import database from '@/config/database';
import logger from '@/utils/logger';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '@/middleware/auth';
import { 
  AuditTrailEntry, 
  ApiResponse, 
  PaginatedResponse,
  QueryParams 
} from '@/types';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/audit - Get audit trail entries with pagination and filtering
router.get('/', requireAdmin, async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      sortBy = 'CreatedAt',
      sortOrder = 'desc',
      filter
    }: QueryParams = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    
    // Build WHERE clause
    const whereConditions: string[] = [];
    const params: any = { limit: Number(limit), offset };

    if (search) {
      whereConditions.push(`(
        a.Action LIKE @search OR 
        a.EntityType LIKE @search OR 
        a.Details LIKE @search OR
        u.Username LIKE @search OR
        u.Email LIKE @search
      )`);
      params.search = `%${search}%`;
    }

    if (filter) {
      if (filter.action) {
        whereConditions.push('a.Action = @action');
        params.action = filter.action;
      }
      if (filter.entityType) {
        whereConditions.push('a.EntityType = @entityType');
        params.entityType = filter.entityType;
      }
      if (filter.userId) {
        whereConditions.push('a.UserId = @userId');
        params.userId = filter.userId;
      }
      if (filter.dateFrom) {
        whereConditions.push('a.CreatedAt >= @dateFrom');
        params.dateFrom = filter.dateFrom;
      }
      if (filter.dateTo) {
        whereConditions.push('a.CreatedAt <= @dateTo');
        params.dateTo = filter.dateTo;
      }
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Validate sort column
    const allowedSortColumns = ['CreatedAt', 'Action', 'EntityType', 'Username'];
    const validSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'CreatedAt';
    const validSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = await database.executeQuery(`
      SELECT COUNT(*) as total
      FROM AuditTrail a
      LEFT JOIN Users u ON a.UserId = u.Id
      ${whereClause}
    `, params);

    const total = countResult.recordset[0].total;

    // Get audit entries
    const result = await database.executeQuery(`
      SELECT 
        a.Id,
        a.UserId,
        a.Action,
        a.EntityType,
        a.EntityId,
        a.OldValues,
        a.NewValues,
        a.IpAddress,
        a.UserAgent,
        a.Details,
        a.CreatedAt,
        u.Username,
        u.Email,
        u.FirstName,
        u.LastName
      FROM AuditTrail a
      LEFT JOIN Users u ON a.UserId = u.Id
      ${whereClause}
      ORDER BY ${validSortBy === 'Username' ? 'u.Username' : 'a.' + validSortBy} ${validSortOrder}
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `, params);

    const auditEntries: (AuditTrailEntry & { username?: string; userEmail?: string; userFullName?: string })[] = 
      result.recordset.map(row => ({
        id: row.Id,
        userId: row.UserId,
        action: row.Action,
        entityType: row.EntityType,
        entityId: row.EntityId,
        oldValues: row.OldValues ? JSON.parse(row.OldValues) : undefined,
        newValues: row.NewValues ? JSON.parse(row.NewValues) : undefined,
        ipAddress: row.IpAddress,
        userAgent: row.UserAgent,
        details: row.Details,
        createdAt: row.CreatedAt,
        username: row.Username,
        userEmail: row.Email,
        userFullName: row.FirstName && row.LastName 
          ? `${row.FirstName} ${row.LastName}` 
          : row.FirstName || row.LastName || undefined
      }));

    const totalPages = Math.ceil(total / Number(limit));

    const response: PaginatedResponse<typeof auditEntries[0]> = {
      success: true,
      data: auditEntries,
      message: 'Audit trail retrieved successfully',
      timestamp: new Date().toISOString(),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Error retrieving audit trail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit trail',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/audit/:id - Get specific audit entry
router.get('/:id', requireAdmin, async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await database.executeQuery(`
      SELECT 
        a.Id,
        a.UserId,
        a.Action,
        a.EntityType,
        a.EntityId,
        a.OldValues,
        a.NewValues,
        a.IpAddress,
        a.UserAgent,
        a.Details,
        a.CreatedAt,
        u.Username,
        u.Email,
        u.FirstName,
        u.LastName
      FROM AuditTrail a
      LEFT JOIN Users u ON a.UserId = u.Id
      WHERE a.Id = @id
    `, { id });

    if (result.recordset.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Audit entry not found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const row = result.recordset[0];
    const auditEntry = {
      id: row.Id,
      userId: row.UserId,
      action: row.Action,
      entityType: row.EntityType,
      entityId: row.EntityId,
      oldValues: row.OldValues ? JSON.parse(row.OldValues) : undefined,
      newValues: row.NewValues ? JSON.parse(row.NewValues) : undefined,
      ipAddress: row.IpAddress,
      userAgent: row.UserAgent,
      details: row.Details,
      createdAt: row.CreatedAt,
      username: row.Username,
      userEmail: row.Email,
      userFullName: row.FirstName && row.LastName 
        ? `${row.FirstName} ${row.LastName}` 
        : row.FirstName || row.LastName || undefined
    };

    const response: ApiResponse<typeof auditEntry> = {
      success: true,
      data: auditEntry,
      message: 'Audit entry retrieved successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error retrieving audit entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit entry',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/audit/entity/:entityType/:entityId - Get audit trail for specific entity
router.get('/entity/:entityType/:entityId', requireAdmin, async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const { entityType, entityId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    // Get total count
    const countResult = await database.executeQuery(`
      SELECT COUNT(*) as total
      FROM AuditTrail a
      WHERE a.EntityType = @entityType AND a.EntityId = @entityId
    `, { entityType, entityId });

    const total = countResult.recordset[0].total;

    // Get audit entries
    const result = await database.executeQuery(`
      SELECT 
        a.Id,
        a.UserId,
        a.Action,
        a.EntityType,
        a.EntityId,
        a.OldValues,
        a.NewValues,
        a.IpAddress,
        a.UserAgent,
        a.Details,
        a.CreatedAt,
        u.Username,
        u.Email,
        u.FirstName,
        u.LastName
      FROM AuditTrail a
      LEFT JOIN Users u ON a.UserId = u.Id
      WHERE a.EntityType = @entityType AND a.EntityId = @entityId
      ORDER BY a.CreatedAt DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `, { entityType, entityId, offset, limit: Number(limit) });

    const auditEntries = result.recordset.map(row => ({
      id: row.Id,
      userId: row.UserId,
      action: row.Action,
      entityType: row.EntityType,
      entityId: row.EntityId,
      oldValues: row.OldValues ? JSON.parse(row.OldValues) : undefined,
      newValues: row.NewValues ? JSON.parse(row.NewValues) : undefined,
      ipAddress: row.IpAddress,
      userAgent: row.UserAgent,
      details: row.Details,
      createdAt: row.CreatedAt,
      username: row.Username,
      userEmail: row.Email,
      userFullName: row.FirstName && row.LastName 
        ? `${row.FirstName} ${row.LastName}` 
        : row.FirstName || row.LastName || undefined
    }));

    const totalPages = Math.ceil(total / Number(limit));

    const response: PaginatedResponse<typeof auditEntries[0]> = {
      success: true,
      data: auditEntries,
      message: `Audit trail for ${entityType} retrieved successfully`,
      timestamp: new Date().toISOString(),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Error retrieving entity audit trail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve entity audit trail',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/audit/stats - Get audit statistics
router.get('/stats', requireAdmin, async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  try {
    const { days = 30 } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - Number(days));

    // Get action statistics
    const actionStatsResult = await database.executeQuery(`
      SELECT 
        Action,
        COUNT(*) as count
      FROM AuditTrail
      WHERE CreatedAt >= @daysAgo
      GROUP BY Action
      ORDER BY count DESC
    `, { daysAgo });

    // Get entity type statistics
    const entityStatsResult = await database.executeQuery(`
      SELECT 
        EntityType,
        COUNT(*) as count
      FROM AuditTrail
      WHERE CreatedAt >= @daysAgo
      GROUP BY EntityType
      ORDER BY count DESC
    `, { daysAgo });

    // Get daily activity
    const dailyActivityResult = await database.executeQuery(`
      SELECT 
        CAST(CreatedAt AS DATE) as date,
        COUNT(*) as count
      FROM AuditTrail
      WHERE CreatedAt >= @daysAgo
      GROUP BY CAST(CreatedAt AS DATE)
      ORDER BY date DESC
    `, { daysAgo });

    // Get top users
    const topUsersResult = await database.executeQuery(`
      SELECT 
        u.Username,
        u.Email,
        COUNT(*) as activityCount
      FROM AuditTrail a
      LEFT JOIN Users u ON a.UserId = u.Id
      WHERE a.CreatedAt >= @daysAgo
      GROUP BY u.Username, u.Email
      ORDER BY activityCount DESC
      OFFSET 0 ROWS
      FETCH NEXT 10 ROWS ONLY
    `, { daysAgo });

    const stats = {
      actionStats: actionStatsResult.recordset,
      entityStats: entityStatsResult.recordset,
      dailyActivity: dailyActivityResult.recordset,
      topUsers: topUsersResult.recordset,
      period: {
        days: Number(days),
        from: daysAgo.toISOString(),
        to: new Date().toISOString()
      }
    };

    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
      message: 'Audit statistics retrieved successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error retrieving audit statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit statistics',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;