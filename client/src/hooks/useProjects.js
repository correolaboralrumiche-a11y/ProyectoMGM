import { useCallback, useEffect, useRef, useState } from 'react';
import { projectsApi } from '../services/projectsApi.js';
import { getErrorMessage } from '../utils/error.js';

const STORAGE_KEY = 'mgm.activeProjectId';

function readStoredProjectId() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectIdState] = useState(() => readStoredProjectId());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  const setActiveProjectId = useCallback((projectId) => {
    const nextId = projectId || '';
    setActiveProjectIdState(nextId);

    try {
      if (nextId) {
        localStorage.setItem(STORAGE_KEY, nextId);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // no-op
    }
  }, []);

  const loadProjects = useCallback(
    async (preferredProjectId = null) => {
      const requestId = ++requestRef.current;
      setLoading(true);
      setError('');

      try {
        const data = await projectsApi.list();
        if (requestRef.current !== requestId) return [];

        const normalized = Array.isArray(data) ? data : [];
        setProjects(normalized);

        const preferred = preferredProjectId !== null ? preferredProjectId : activeProjectId;

        if (!normalized.length) {
          setActiveProjectId('');
          return normalized;
        }

        if (preferred && normalized.some((item) => item.id === preferred)) {
          if (preferred !== activeProjectId) {
            setActiveProjectId(preferred);
          }
          return normalized;
        }

        const fallbackId = normalized[0]?.id || '';
        setActiveProjectId(fallbackId);
        return normalized;
      } catch (err) {
        if (requestRef.current === requestId) {
          setError(getErrorMessage(err, 'No se pudieron cargar los proyectos.'));
        }
        return [];
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [activeProjectId, setActiveProjectId]
  );

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return {
    projects,
    activeProjectId,
    setActiveProjectId,
    loading,
    error,
    reloadProjects: loadProjects,
  };
}
