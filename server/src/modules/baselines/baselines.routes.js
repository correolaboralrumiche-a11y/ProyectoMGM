import { Router } from 'express';
import { ok } from '../../utils/http.js';
import { requirePermission } from '../../middleware/authorize.js';
import { buildRequestAuditContext } from '../../utils/audit.js';
import { baselinesService } from './baselines.service.js';

const router = Router();

router.get('/', requirePermission('baselines.read'), async (req, res, next) => {
  try {
    return ok(res, await baselinesService.listBaselines(req.query.projectId));
  } catch (error) {
    return next(error);
  }
});

router.post('/', requirePermission('baselines.create'), async (req, res, next) => {
  try {
    return ok(res, await baselinesService.createBaseline(req.body, req.auth, buildRequestAuditContext(req)), 201);
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', requirePermission('baselines.read'), async (req, res, next) => {
  try {
    return ok(res, await baselinesService.getBaseline(req.params.id));
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requirePermission('baselines.delete'), async (req, res, next) => {
  try {
    return ok(res, await baselinesService.deleteBaseline(req.params.id, req.auth, buildRequestAuditContext(req)));
  } catch (error) {
    return next(error);
  }
});

export default router;
