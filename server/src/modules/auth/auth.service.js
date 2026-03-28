import { AppError } from '../../errors/AppError.js';
import { withTransaction } from '../../config/db.js';
import { securityConfig } from '../../config/security.js';
import { createSessionToken, hashSessionToken } from '../../utils/sessionToken.js';
import { verifyPassword } from '../../utils/password.js';
import { authRepository } from './auth.repository.js';
import { auditRepository } from '../audit/audit.repository.js';
import { extractActorId } from '../../utils/audit.js';

function normalizeIdentifier(value) {
  return String(value || '').trim();
}

function normalizePassword(value) {
  return String(value || '');
}

function mapAuthenticatedUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    status: user.status,
    last_login_at: user.last_login_at,
    created_at: user.created_at,
    updated_at: user.updated_at,
    roles: Array.isArray(user.roles) ? user.roles : [],
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  };
}

function computeExpiry(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

async function safeAudit(entry) {
  try {
    await auditRepository.create(entry);
  } catch (error) {
    console.error('Audit write failed:', error);
  }
}

export const authService = {
  async login(payload, context = {}) {
    const identifier = normalizeIdentifier(payload?.identifier || payload?.username || payload?.email);
    const password = normalizePassword(payload?.password);

    if (!identifier || !password) {
      throw new AppError('Username/email and password are required', 400);
    }

    const user = await authRepository.findUserForLogin(identifier);
    if (!user || !verifyPassword(password, user.password_hash)) {
      await safeAudit({
        actor_user_id: user?.id || null,
        entity_type: 'auth.session',
        entity_id: null,
        action: 'login_failed',
        summary: 'Failed login attempt',
        metadata: { identifier },
        ip_address: context.ipAddress,
        user_agent: context.userAgent,
      });
      throw new AppError('Invalid credentials', 401);
    }

    if (user.status !== 'active') {
      await safeAudit({
        actor_user_id: user.id,
        entity_type: 'auth.session',
        entity_id: null,
        action: 'login_blocked',
        summary: 'Login blocked for inactive user',
        metadata: { identifier },
        ip_address: context.ipAddress,
        user_agent: context.userAgent,
      });
      throw new AppError('User is inactive', 403);
    }

    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = computeExpiry(securityConfig.sessionHours);

    await withTransaction(async (client) => {
      const session = await authRepository.createSession(
        {
          user_id: user.id,
          token_hash: tokenHash,
          expires_at: expiresAt,
          user_agent: context.userAgent,
          ip_address: context.ipAddress,
        },
        client
      );

      await authRepository.updateLastLoginAt(user.id, client);

      await auditRepository.create(
        {
          actor_user_id: user.id,
          entity_type: 'auth.session',
          entity_id: session?.id || null,
          action: 'login',
          summary: 'User logged in',
          metadata: {
            session_expires_at: expiresAt,
          },
          ip_address: context.ipAddress,
          user_agent: context.userAgent,
        },
        client
      );
    });

    const access = await authRepository.getUserAccessById(user.id);

    return {
      token,
      session_expires_at: expiresAt,
      user: mapAuthenticatedUser(access),
    };
  },

  async getCurrentUser(sessionContext) {
    if (!sessionContext?.user) {
      throw new AppError('Authentication required', 401);
    }

    return {
      session_expires_at: sessionContext.session_expires_at,
      user: mapAuthenticatedUser(sessionContext.user),
    };
  },

  async logout(rawToken, sessionContext, context = {}) {
    const token = String(rawToken || '').trim();
    if (!token) {
      return { success: true };
    }

    const tokenHash = hashSessionToken(token);
    await withTransaction(async (client) => {
      await authRepository.revokeSessionByTokenHash(tokenHash, client);

      await auditRepository.create(
        {
          actor_user_id: extractActorId(sessionContext),
          entity_type: 'auth.session',
          entity_id: sessionContext?.session_id || null,
          action: 'logout',
          summary: 'User logged out',
          metadata: {
            session_expires_at: sessionContext?.session_expires_at || null,
          },
          ip_address: context.ipAddress,
          user_agent: context.userAgent,
        },
        client
      );
    });

    return { success: true };
  },
};
