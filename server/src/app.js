import express from 'express';
import cors from 'cors';
import './config/db.js';
import projectsRoutes from './modules/projects/projects.routes.js';
import wbsRoutes from './modules/wbs/wbs.routes.js';
import activitiesRoutes from './modules/activities/activities.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

app.use('/projects', projectsRoutes);
app.use('/wbs', wbsRoutes);
app.use('/activities', activitiesRoutes);

app.use(errorHandler);

export default app;
