import { useCallback, useEffect, useRef, useState } from 'react';
import { baselinesApi } from '../services/baselinesApi.js';
import { getErrorMessage } from '../utils/error.js';

export function useBaselines(projectId) {
  const [baselines, setBaselines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  const reloadBaselines = useCallback(async (projectIdOverride = null) => {
    const targetProjectId = projectIdOverride || projectId;

    if (!targetProjectId) {
      setBaselines([]);
      setError('');
      return [];
    }

    const requestId = ++requestRef.current;
    setLoading(true);
    setError('');

    try {
      const data = await baselinesApi.list(targetProjectId);
      if (requestRef.current !== requestId) return [];

      const normalized = Array.isArray(data) ? data : [];
      setBaselines(normalized);
      return normalized;
    } catch (err) {
      if (requestRef.current === requestId) {
        setBaselines([]);
        setError(getErrorMessage(err, 'No se pudieron cargar las líneas base.'));
      }
      return [];
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [projectId]);

  useEffect(() => {
    reloadBaselines();
  }, [reloadBaselines]);

  return {
    baselines,
    loading,
    error,
    reloadBaselines,
  };
}
