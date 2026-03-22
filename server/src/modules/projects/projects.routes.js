import { Router } from 'express';
import { ok } from '../../utils/http.js';
import { projectsService } from './projects.service.js';

const router = Router();

router.get('/', (req, res, next) => {
  try {
    return ok(res, projectsService.listProjects());
  } catch (error) {
    return next(error);
  }
});

router.post('/', (req, res, next) => {
  try {
    return ok(res, projectsService.createProject(req.body), 201);
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    return ok(res, projectsService.updateProject(req.params.id, req.body));
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    return ok(res, projectsService.deleteProject(req.params.id));
  } catch (error) {
    return next(error);
  }
});

export default router;