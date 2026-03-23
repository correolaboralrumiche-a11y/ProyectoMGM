import { useCallback, useEffect, useState } from 'react';
import { baselinesApi } from '../services/baselinesApi.js';

export function useBaselines(projectId) {
  const [baselines, setBaselines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reloadBaselines = useCallback(async () => {
    if (!projectId) {
      setBaselines([]);
      setError('');
      return [];
    }

    setLoading(true);
    setError('');

    try {
      const data = await baselinesApi.list(projectId);
      setBaselines(Array.isArray(data) ? data : []);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      setBaselines([]);
      setError(err.message || 'No se pudieron cargar las líneas base');
      return [];
    } finally {
      setLoading(false);
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
