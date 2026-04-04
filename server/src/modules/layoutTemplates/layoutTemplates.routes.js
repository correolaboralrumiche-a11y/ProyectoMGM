import { Router } from 'express';
import { ok } from '../../utils/http.js';
import { requirePermission } from '../../middleware/authorize.js';
import { buildRequestAuditContext } from '../../utils/audit.js';
import { layoutTemplatesService } from './layoutTemplates.service.js';

const router = Router();

router.get('/meta/catalog', requirePermission('layout_templates.read'), async (req, res, next) => {
  try {
    return ok(res, layoutTemplatesService.getCatalog());
  } catch (error) {
    return next(error);
  }
});

router.get('/', requirePermission('layout_templates.read'), async (req, res, next) => {
  try {
    return ok(res, await layoutTemplatesService.listTemplates(req.query.projectId));
  } catch (error) {
    return next(error);
  }
});

router.post('/', requirePermission('layout_templates.create'), async (req, res, next) => {
  try {
    return ok(res, await layoutTemplatesService.createTemplate(req.body, req.auth, buildRequestAuditContext(req)), 201);
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', requirePermission('layout_templates.read'), async (req, res, next) => {
  try {
    return ok(res, await layoutTemplatesService.getTemplate(req.params.id));
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/preview-context', requirePermission('layout_templates.read'), async (req, res, next) => {
  try {
    return ok(res, await layoutTemplatesService.getPreviewContext(req.params.id));
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/viewer-data', requirePermission('layout_templates.read'), async (req, res, next) => {
  try {
    return ok(res, await layoutTemplatesService.getViewerData(req.params.id));
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', requirePermission('layout_templates.update'), async (req, res, next) => {
  try {
    return ok(res, await layoutTemplatesService.updateTemplate(req.params.id, req.body, req.auth, buildRequestAuditContext(req)));
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', requirePermission('layout_templates.update'), async (req, res, next) => {
  try {
    return ok(res, await layoutTemplatesService.updateTemplate(req.params.id, req.body, req.auth, buildRequestAuditContext(req)));
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requirePermission('layout_templates.delete'), async (req, res, next) => {
  try {
    return ok(res, await layoutTemplatesService.deleteTemplate(req.params.id, req.auth, buildRequestAuditContext(req)));
  } catch (error) {
    return next(error);
  }
});

export default router;
