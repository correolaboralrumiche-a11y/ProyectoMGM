import { Router } from 'express';
import { ok } from '../../utils/http.js';
import { requirePermission } from '../../middleware/authorize.js';
import { buildRequestAuditContext } from '../../utils/audit.js';
import { deliverablesService } from './deliverables.service.js';

const router = Router();

router.get('/', requirePermission('deliverables.read'), async (req, res, next) => {
  try {
    return ok(
      res,
      await deliverablesService.listDeliverables(req.query.projectId, {
        status_code: req.query.status_code,
        discipline_code: req.query.discipline_code,
        deliverable_type_code: req.query.deliverable_type_code,
        search: req.query.search,
      }),
    );
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', requirePermission('deliverables.read'), async (req, res, next) => {
  try {
    return ok(res, await deliverablesService.getDeliverableDetail(req.params.id));
  } catch (error) {
    return next(error);
  }
});

router.post('/', requirePermission('deliverables.write'), async (req, res, next) => {
  try {
    return ok(
      res,
      await deliverablesService.createDeliverable(req.body, req.auth, buildRequestAuditContext(req)),
      201,
    );
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', requirePermission('deliverables.write'), async (req, res, next) => {
  try {
    return ok(
      res,
      await deliverablesService.updateDeliverable(req.params.id, req.body, req.auth, buildRequestAuditContext(req)),
    );
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requirePermission('deliverables.delete'), async (req, res, next) => {
  try {
    return ok(
      res,
      await deliverablesService.deleteDeliverable(req.params.id, req.auth, buildRequestAuditContext(req)),
    );
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/revisions', requirePermission('deliverables.manage_revisions'), async (req, res, next) => {
  try {
    return ok(
      res,
      await deliverablesService.createRevision(req.params.id, req.body, req.auth, buildRequestAuditContext(req)),
      201,
    );
  } catch (error) {
    return next(error);
  }
});

router.put('/:id/revisions/:revisionId', requirePermission('deliverables.manage_revisions'), async (req, res, next) => {
  try {
    return ok(
      res,
      await deliverablesService.updateRevision(
        req.params.id,
        req.params.revisionId,
        req.body,
        req.auth,
        buildRequestAuditContext(req),
      ),
    );
  } catch (error) {
    return next(error);
  }
});

export default router;
