import { Router } from 'express';
import { baselinesService } from './baselines.service.js';

const router = Router();

router.get('/', (req, res, next) => {
  try {
    const data = baselinesService.listBaselines(req.query.projectId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/', (req, res, next) => {
  try {
    const data = baselinesService.createBaseline(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const data = baselinesService.getBaseline(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const data = baselinesService.deleteBaseline(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
