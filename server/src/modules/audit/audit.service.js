import { AppError } from '../../errors/AppError.js';
import { auditRepository } from './audit.repository.js';

function normalizeText(value) {
  return String(value || '').trim();
}

export const auditService = {
  async listAuditLogs(query = {}) {
    const filters = {
      project_id: normalizeText(query.projectId),
      entity_type: normalizeText(query.entityType),
      entity_id: normalizeText(query.entityId),
      action: normalizeText(query.action),
      actor_user_id: normalizeText(query.actorUserId),
      limit: query.limit,
    };

    return auditRepository.list(filters);
  },

  async writeAuditLog(entry, executor) {
    if (!entry?.entity_type || !entry?.action) {
      throw new AppError('Invalid audit log payload', 500);
    }

    return auditRepository.create(entry, executor);
  },
};
