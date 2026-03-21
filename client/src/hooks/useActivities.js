import { useEffect, useState } from 'react';
import { activitiesApi } from '../services/activitiesApi';

export function useActivities(projectId) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadActivities() {
    if (!projectId) {
      setActivities([]);
      return;
    }

    setLoading(true);
    try {
      const data = await activitiesApi.list(projectId);
      setActivities(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivities();
  }, [projectId]);

  return {
    activities,
    loading,
    reloadActivities: loadActivities,
  };
}
