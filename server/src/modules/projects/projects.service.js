import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../errors/AppError.js';
import { projectsRepository } from './projects.repository.js';

export const projectsService = {
  listProjects() {
    return projectsRepository.list();
  },

  createProject(payload) {
    const name = String(payload?.name || '').trim();
    const description = String(payload?.description || '').trim();

    if (!name) {
      throw new AppError('Project name is required', 400);
    }

    return projectsRepository.create({
      id: uuidv4(),
      name,
      description,
      created_at: new Date().toISOString(),
    });
  },

  updateProject(id, payload) {
    const existing = projectsRepository.findById(id);

    if (!existing) {
      throw new AppError('Project not found', 404);
    }

    const name = String(payload?.name ?? existing.name).trim();
    const description = String(payload?.description ?? existing.description).trim();

    if (!name) {
      throw new AppError('Project name is required', 400);
    }

    return projectsRepository.update(id, { name, description });
  },

  deleteProject(id) {
    const existing = projectsRepository.findById(id);

    if (!existing) {
      throw new AppError('Project not found', 404);
    }

    projectsRepository.remove(id);
    return { id };
  },
};