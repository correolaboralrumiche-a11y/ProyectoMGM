import { Router } from 'express';
import { ok } from '../../utils/http.js';
import { requirePermission } from '../../middleware/authorize.js';
import { auditService } from './audit.service.js';

const router = Router();

router.get('/', requirePermission('audit.read'), async (req, res, next) => {
  try {
    return ok(res, await auditService.listAuditLogs(req.query));
  } catch (error) {
    return next(error);
  }
});

export default router;
