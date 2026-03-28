import { Router } from 'express';
import { ok } from '../../utils/http.js';
import { requirePermission } from '../../middleware/authorize.js';
import { buildRequestAuditContext } from '../../utils/audit.js';
import { activitiesService } from './activities.service.js';

const router = Router();

router.get('/', requirePermission('activities.read'), async (req, res, next) => {
  try {
    return ok(res, await activitiesService.listActivities(req.query.projectId));
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/control-data', requirePermission('activities.read'), async (req, res, next) => {
  try {
    return ok(res, await activitiesService.getActivityControlData(req.params.id));
  } catch (error) {
    return next(error);
  }
});

router.post('/', requirePermission('activities.write'), async (req, res, next) => {
  try {
    return ok(res, await activitiesService.createActivity(req.body, req.auth, buildRequestAuditContext(req)), 201);
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', requirePermission('activities.write'), async (req, res, next) => {
  try {
    return ok(
      res,
      await activitiesService.updateActivity(req.params.id, req.body, req.auth, buildRequestAuditContext(req))
    );
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/progress-updates', requirePermission('activities.write'), async (req, res, next) => {
  try {
    return ok(
      res,
      await activitiesService.createProgressUpdate(
        req.params.id,
        req.body,
        req.auth,
        buildRequestAuditContext(req)
      ),
      201
    );
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/actuals', requirePermission('activities.write'), async (req, res, next) => {
  try {
    return ok(
      res,
      await activitiesService.createActualEntry(
        req.params.id,
        req.body,
        req.auth,
        buildRequestAuditContext(req)
      ),
      201
    );
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/move-up', requirePermission('activities.write'), async (req, res, next) => {
  try {
    return ok(
      res,
      await activitiesService.moveActivity(req.params.id, 'up', req.auth, buildRequestAuditContext(req))
    );
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/move-down', requirePermission('activities.write'), async (req, res, next) => {
  try {
    return ok(
      res,
      await activitiesService.moveActivity(req.params.id, 'down', req.auth, buildRequestAuditContext(req))
    );
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requirePermission('activities.delete'), async (req, res, next) => {
  try {
    return ok(
      res,
      await activitiesService.deleteActivity(req.params.id, req.auth, buildRequestAuditContext(req))
    );
  } catch (error) {
    return next(error);
  }
});

export default router;
