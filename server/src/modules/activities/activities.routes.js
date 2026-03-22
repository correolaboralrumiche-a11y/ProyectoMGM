import { Router } from 'express';
import { ok } from '../../utils/http.js';
import { activitiesService } from './activities.service.js';

const router = Router();

router.get('/', (req, res, next) => {
  try {
    return ok(res, activitiesService.listActivities(req.query.projectId));
  } catch (error) {
    return next(error);
  }
});

router.post('/', (req, res, next) => {
  try {
    return ok(res, activitiesService.createActivity(req.body), 201);
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    return ok(res, activitiesService.updateActivity(req.params.id, req.body));
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    return ok(res, activitiesService.deleteActivity(req.params.id));
  } catch (error) {
    return next(error);
  }
});

export default router;