import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function persistProjectId(projectId) {
  try {
    if (projectId) {
      localStorage.setItem(STORAGE_KEY, projectId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // no-op
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
    persistProjectId(nextId);
  }, []);

  const reloadProjects = useCallback(
    async (preferredProjectId = null) => {
      const requestId = ++requestRef.current;
      setLoading(true);
      setError('');

      try {
        const data = await projectsApi.list();

        if (requestRef.current !== requestId) {
          return [];
        }

        const normalized = Array.isArray(data) ? data : [];
        setProjects(normalized);

        if (!normalized.length) {
          setActiveProjectId('');
          return normalized;
        }

        const requestedProjectId = preferredProjectId !== null ? preferredProjectId : activeProjectId;
        const requestedExists = requestedProjectId && normalized.some((item) => item.id === requestedProjectId);

        if (requestedExists) {
          if (requestedProjectId !== activeProjectId) {
            setActiveProjectId(requestedProjectId);
          }
          return normalized;
        }

        const fallbackId = normalized[0]?.id || '';
        setActiveProjectId(fallbackId);
        return normalized;
      } catch (err) {
        if (requestRef.current === requestId) {
          setProjects([]);
          setError(getErrorMessage(err, 'No se pudieron cargar los proyectos.'));
        }
        return [];
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [activeProjectId, setActiveProjectId],
  );

  useEffect(() => {
    reloadProjects();
  }, [reloadProjects]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [projects, activeProjectId],
  );

  return {
    projects,
    activeProjectId,
    activeProject,
    setActiveProjectId,
    loading,
    error,
    reloadProjects,
  };
}
