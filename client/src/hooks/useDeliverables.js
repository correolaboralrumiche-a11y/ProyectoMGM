import { useCallback, useEffect, useRef, useState } from 'react';
import { deliverablesApi } from '../services/deliverablesApi.js';
import { getErrorMessage } from '../utils/error.js';

export function useDeliverables(projectId, filters = {}) {
  const [deliverables, setDeliverables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  const reloadDeliverables = useCallback(
    async (projectIdOverride = null, filtersOverride = null) => {
      const targetProjectId = projectIdOverride ?? projectId;
      const targetFilters = filtersOverride ?? filters;

      if (!targetProjectId) {
        setDeliverables([]);
        setError('');
        setLoading(false);
        return [];
      }

      const requestId = ++requestRef.current;
      setLoading(true);
      setError('');

      try {
        const data = await deliverablesApi.list(targetProjectId, targetFilters);

        if (requestRef.current !== requestId) return [];

        const normalized = Array.isArray(data) ? data : [];
        setDeliverables(normalized);
        return normalized;
      } catch (err) {
        if (requestRef.current === requestId) {
          setDeliverables([]);
          setError(getErrorMessage(err, 'No se pudieron cargar los entregables.'));
        }
        return [];
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [projectId, filters],
  );

  useEffect(() => {
    reloadDeliverables();
  }, [reloadDeliverables]);

  return {
    deliverables,
    loading,
    error,
    reloadDeliverables,
  };
}
