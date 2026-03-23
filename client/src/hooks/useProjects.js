import { useCallback, useEffect, useState } from 'react';
import { projectsApi } from '../services/projectsApi';

const STORAGE_KEY = 'mgm.activeProjectId';

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectIdState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [loading, setLoading] = useState(true);

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
      setLoading(true);

      try {
        const data = await projectsApi.list();
        setProjects(data);

        const preferred =
          preferredProjectId !== null ? preferredProjectId : activeProjectId;

        if (data.length === 0) {
          setActiveProjectId('');
          return data;
        }

        if (preferred && data.some((p) => p.id === preferred)) {
          if (preferred !== activeProjectId) {
            setActiveProjectId(preferred);
          }
          return data;
        }

        const fallbackId = data[0]?.id || '';
        setActiveProjectId(fallbackId);
        return data;
      } finally {
        setLoading(false);
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
    reloadProjects: loadProjects,
  };
}
