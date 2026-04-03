import { Router } from 'express';
import { ok } from '../../utils/http.js';
import { requirePermission } from '../../middleware/authorize.js';
import { buildRequestAuditContext } from '../../utils/audit.js';
import { controlPeriodsService } from './controlPeriods.service.js';

const router = Router();

router.get('/definitions', requirePermission('control_periods.read'), async (req, res, next) => {
  try {
    return ok(res, await controlPeriodsService.listFinancialPeriods(req.query.projectId));
  } catch (error) {
    return next(error);
  }
});

router.post('/definitions', requirePermission('control_periods.create'), async (req, res, next) => {
  try {
    return ok(
      res,
      await controlPeriodsService.createFinancialPeriod(req.body, req.auth, buildRequestAuditContext(req)),
      201,
    );
  } catch (error) {
    return next(error);
  }
});

router.patch('/definitions/:id', requirePermission('control_periods.create'), async (req, res, next) => {
  try {
    return ok(
      res,
      await controlPeriodsService.updateFinancialPeriod(req.params.id, req.body, req.auth, buildRequestAuditContext(req)),
    );
  } catch (error) {
    return next(error);
  }
});

router.delete('/definitions/:id', requirePermission('control_periods.delete'), async (req, res, next) => {
  try {
    return ok(
      res,
      await controlPeriodsService.deleteFinancialPeriod(req.params.id, req.auth, buildRequestAuditContext(req)),
    );
  } catch (error) {
    return next(error);
  }
});

router.post('/capture', requirePermission('control_periods.close'), async (req, res, next) => {
  try {
    return ok(
      res,
      await controlPeriodsService.capturePeriod(req.body, req.auth, buildRequestAuditContext(req)),
      201,
    );
  } catch (error) {
    return next(error);
  }
});

router.get('/', requirePermission('control_periods.read'), async (req, res, next) => {
  try {
    return ok(res, await controlPeriodsService.listPeriods(req.query.projectId));
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', requirePermission('control_periods.read'), async (req, res, next) => {
  try {
    return ok(res, await controlPeriodsService.getPeriodDetail(req.params.id));
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/close', requirePermission('control_periods.close'), async (req, res, next) => {
  try {
    return ok(
      res,
      await controlPeriodsService.closePeriod(req.params.id, req.body, req.auth, buildRequestAuditContext(req)),
    );
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/reopen', requirePermission('control_periods.reopen'), async (req, res, next) => {
  try {
    return ok(
      res,
      await controlPeriodsService.reopenPeriod(req.params.id, req.body, req.auth, buildRequestAuditContext(req)),
    );
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requirePermission('control_periods.delete'), async (req, res, next) => {
  try {
    return ok(
      res,
      await controlPeriodsService.deletePeriod(req.params.id, req.auth, buildRequestAuditContext(req)),
    );
  } catch (error) {
    return next(error);
  }
});

export default router;
