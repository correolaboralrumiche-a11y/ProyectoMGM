import { Router } from 'express';
import { ok } from '../../utils/http.js';
import { requirePermission } from '../../middleware/authorize.js';
import { buildRequestAuditContext } from '../../utils/audit.js';
import { wbsService } from './wbs.service.js';

const router = Router();

router.get('/', requirePermission('wbs.read'), async (req, res, next) => {
  try {
    return ok(res, await wbsService.listTree(req.query.projectId));
  } catch (error) {
    return next(error);
  }
});

router.post('/', requirePermission('wbs.create'), async (req, res, next) => {
  try {
    return ok(res, await wbsService.createNode(req.body, req.auth, buildRequestAuditContext(req)), 201);
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', requirePermission('wbs.update'), async (req, res, next) => {
  try {
    return ok(res, await wbsService.updateNode(req.params.id, req.body, req.auth, buildRequestAuditContext(req)));
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/indent', requirePermission('wbs.reorder'), async (req, res, next) => {
  try {
    return ok(res, await wbsService.indentNode(req.params.id, req.auth, buildRequestAuditContext(req)));
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/outdent', requirePermission('wbs.reorder'), async (req, res, next) => {
  try {
    return ok(res, await wbsService.outdentNode(req.params.id, req.auth, buildRequestAuditContext(req)));
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/move-up', requirePermission('wbs.reorder'), async (req, res, next) => {
  try {
    return ok(res, await wbsService.moveNode(req.params.id, 'up', req.auth, buildRequestAuditContext(req)));
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/move-down', requirePermission('wbs.reorder'), async (req, res, next) => {
  try {
    return ok(res, await wbsService.moveNode(req.params.id, 'down', req.auth, buildRequestAuditContext(req)));
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requirePermission('wbs.delete'), async (req, res, next) => {
  try {
    return ok(res, await wbsService.deleteNode(req.params.id, req.auth, buildRequestAuditContext(req)));
  } catch (error) {
    return next(error);
  }
});

export default router;
