import express from 'express';
import cors from 'cors';
import './config/db.js';
import { healthcheckDatabase } from './config/db.js';
import { authenticate } from './middleware/authenticate.js';
import authRoutes from './modules/auth/auth.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import catalogsRoutes from './modules/catalogs/catalogs.routes.js';
import projectsRoutes from './modules/projects/projects.routes.js';
import wbsRoutes from './modules/wbs/wbs.routes.js';
import activitiesRoutes from './modules/activities/activities.routes.js';
import baselinesRoutes from './modules/baselines/baselines.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (req, res, next) => {
  try {
    const database = await healthcheckDatabase();

    return res.json({
      success: true,
      data: {
        status: 'ok',
        database,
      },
    });
  } catch (error) {
    return next(error);
  }
});

app.use('/auth', authRoutes);

app.use(authenticate);
app.use('/audit-logs', auditRoutes);
app.use('/catalogs', catalogsRoutes);
app.use('/projects', projectsRoutes);
app.use('/wbs', wbsRoutes);
app.use('/activities', activitiesRoutes);
app.use('/baselines', baselinesRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

app.use(errorHandler);

export default app;
