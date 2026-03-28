import { Router } from 'express';
import { ok } from '../../utils/http.js';
import { requirePermission } from '../../middleware/authorize.js';
import { buildRequestAuditContext } from '../../utils/audit.js';
import { catalogsService } from './catalogs.service.js';

const router = Router();

router.get('/', requirePermission('catalogs.read'), async (req, res, next) => {
  try {
    return ok(res, await catalogsService.listCatalogs());
  } catch (error) {
    return next(error);
  }
});

router.get('/:catalogKey', requirePermission('catalogs.read'), async (req, res, next) => {
  try {
    return ok(
      res,
      await catalogsService.listCatalogItems(req.params.catalogKey, req.query.includeInactive !== 'false')
    );
  } catch (error) {
    return next(error);
  }
});

router.post('/:catalogKey', requirePermission('catalogs.manage'), async (req, res, next) => {
  try {
    return ok(
      res,
      await catalogsService.createCatalogItem(
        req.params.catalogKey,
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

router.put('/:catalogKey/:code', requirePermission('catalogs.manage'), async (req, res, next) => {
  try {
    return ok(
      res,
      await catalogsService.updateCatalogItem(
        req.params.catalogKey,
        req.params.code,
        req.body,
        req.auth,
        buildRequestAuditContext(req)
      )
    );
  } catch (error) {
    return next(error);
  }
});

export default router;
