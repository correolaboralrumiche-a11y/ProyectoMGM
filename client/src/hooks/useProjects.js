import { useEffect, useState } from 'react';
import { projectsApi } from '../services/projectsApi';

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadProjects() {
    setLoading(true);
    try {
      const data = await projectsApi.list();
      setProjects(data);
      if (!activeProjectId && data.length > 0) {
        setActiveProjectId(data[0].id);
      } else if (activeProjectId && !data.some((p) => p.id === activeProjectId)) {
        setActiveProjectId(data[0]?.id || '');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  return {
    projects,
    activeProjectId,
    setActiveProjectId,
    loading,
    reloadProjects: loadProjects,
  };
}
