import { Router } from 'express';
import { ok } from '../../utils/http.js';
import { requirePermission } from '../../middleware/authorize.js';
import { buildRequestAuditContext } from '../../utils/audit.js';
import { projectsService } from './projects.service.js';

const router = Router();

router.get('/', requirePermission('projects.read'), async (req, res, next) => {
  try {
    return ok(res, await projectsService.listProjects());
  } catch (error) {
    return next(error);
  }
});

router.post('/', requirePermission('projects.create'), async (req, res, next) => {
  try {
    return ok(res, await projectsService.createProject(req.body, req.auth, buildRequestAuditContext(req)), 201);
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', requirePermission('projects.update'), async (req, res, next) => {
  try {
    return ok(
      res,
      await projectsService.updateProject(req.params.id, req.body, req.auth, buildRequestAuditContext(req))
    );
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requirePermission('projects.delete'), async (req, res, next) => {
  try {
    return ok(res, await projectsService.deleteProject(req.params.id, req.auth, buildRequestAuditContext(req)));
  } catch (error) {
    return next(error);
  }
});

export default router;
