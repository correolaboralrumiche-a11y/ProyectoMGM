import { Router } from 'express';
import { ok } from '../../utils/http.js';
import { wbsService } from './wbs.service.js';

const router = Router();

router.get('/', (req, res, next) => {
  try {
    return ok(res, wbsService.listTree(req.query.projectId));
  } catch (error) {
    return next(error);
  }
});

router.post('/', (req, res, next) => {
  try {
    return ok(res, wbsService.createNode(req.body), 201);
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    return ok(res, wbsService.updateNode(req.params.id, req.body));
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/indent', (req, res, next) => {
  try {
    return ok(res, wbsService.indentNode(req.params.id));
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/outdent', (req, res, next) => {
  try {
    return ok(res, wbsService.outdentNode(req.params.id));
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/move-up', (req, res, next) => {
  try {
    return ok(res, wbsService.moveNode(req.params.id, 'up'));
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/move-down', (req, res, next) => {
  try {
    return ok(res, wbsService.moveNode(req.params.id, 'down'));
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    return ok(res, wbsService.deleteNode(req.params.id));
  } catch (error) {
    return next(error);
  }
});

export default router;