import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { baselinesApi } from '../services/baselinesApi.js';
import { getErrorMessage } from '../utils/error.js';

function sortBaselines(items) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a?.created_at || 0).getTime();
    const bTime = new Date(b?.created_at || 0).getTime();
    return bTime - aTime;
  });
}

export function useBaselines(projectId) {
  const [baselines, setBaselines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  const reloadBaselines = useCallback(
    async (projectIdOverride = null) => {
      const targetProjectId = projectIdOverride ?? projectId;

      if (!targetProjectId) {
        setBaselines([]);
        setError('');
        setLoading(false);
        return [];
      }

      const requestId = ++requestRef.current;
      setLoading(true);
      setError('');

      try {
        const data = await baselinesApi.list(targetProjectId);

        if (requestRef.current !== requestId) {
          return [];
        }

        const normalized = Array.isArray(data) ? data : [];
        const sorted = sortBaselines(normalized);
        setBaselines(sorted);
        return sorted;
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
    },
    [projectId],
  );

  const loadBaselineDetail = useCallback(async (baselineId) => {
    if (!baselineId) return null;
    return baselinesApi.get(baselineId);
  }, []);

  useEffect(() => {
    reloadBaselines();
  }, [reloadBaselines]);

  const latestBaseline = useMemo(() => baselines[0] || null, [baselines]);

  return {
    baselines,
    latestBaseline,
    loading,
    error,
    reloadBaselines,
    loadBaselineDetail,
  };
}
