import express from 'express';
import cors from 'cors';
import './config/db.js';
import { env } from './config/env.js';
import { healthcheckDatabase } from './config/db.js';
import { authenticate } from './middleware/authenticate.js';
import { requestContext } from './middleware/requestContext.js';
import { requestLogger } from './middleware/requestLogger.js';
import authRoutes from './modules/auth/auth.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import catalogsRoutes from './modules/catalogs/catalogs.routes.js';
import projectsRoutes from './modules/projects/projects.routes.js';
import wbsRoutes from './modules/wbs/wbs.routes.js';
import activitiesRoutes from './modules/activities/activities.routes.js';
import deliverablesRoutes from './modules/deliverables/deliverables.routes.js';
import controlPeriodsRoutes from './modules/controlPeriods/controlPeriods.routes.js';
import baselinesRoutes from './modules/baselines/baselines.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

function buildCorsOptions() {
  const allowed = env.corsOrigins;
  const allowAny = allowed.includes('*');

  return {
    origin(origin, callback) {
      if (allowAny || !origin || allowed.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('CORS origin not allowed'));
    },
  };
}

app.disable('x-powered-by');
app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: '1mb' }));
app.use(requestContext);
app.use(requestLogger);

app.get('/health/live', (req, res) => {
  return res.json({
    success: true,
    data: {
      status: 'ok',
      app: env.appName,
      environment: env.nodeEnv,
      uptime_seconds: Math.round(process.uptime()),
      request_id: req.requestId,
    },
  });
});

app.get('/health/ready', async (req, res, next) => {
  try {
    const database = await healthcheckDatabase();
    return res.json({
      success: true,
      data: {
        status: 'ready',
        app: env.appName,
        environment: env.nodeEnv,
        uptime_seconds: Math.round(process.uptime()),
        database,
        request_id: req.requestId,
      },
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/health', async (req, res, next) => {
  try {
    const database = await healthcheckDatabase();
    return res.json({
      success: true,
      data: {
        status: 'ok',
        app: env.appName,
        environment: env.nodeEnv,
        uptime_seconds: Math.round(process.uptime()),
        database,
        request_id: req.requestId,
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
app.use('/deliverables', deliverablesRoutes);
app.use('/control-periods', controlPeriodsRoutes);
app.use('/baselines', baselinesRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    error: 'Route not found',
    request_id: req.requestId || null,
  });
});

app.use(errorHandler);

export default app;
