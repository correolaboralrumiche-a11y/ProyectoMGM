import { useCallback, useEffect, useRef, useState } from 'react';
import { activitiesApi } from '../services/activitiesApi.js';
import { getErrorMessage } from '../utils/error.js';

export function useActivities(projectId) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  const loadActivities = useCallback(
    async (projectIdOverride = null) => {
      const targetProjectId = projectIdOverride || projectId;

      if (!targetProjectId) {
        setActivities([]);
        setError('');
        return [];
      }

      const requestId = ++requestRef.current;
      setLoading(true);
      setError('');

      try {
        const data = await activitiesApi.list(targetProjectId);
        if (requestRef.current !== requestId) return [];

        const normalized = Array.isArray(data) ? data : [];
        setActivities(normalized);
        return normalized;
      } catch (err) {
        if (requestRef.current === requestId) {
          setActivities([]);
          setError(getErrorMessage(err, 'No se pudieron cargar las actividades.'));
        }
        return [];
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [projectId]
  );

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  return {
    activities,
    loading,
    error,
    reloadActivities: loadActivities,
  };
}
