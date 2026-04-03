import { useCallback, useEffect, useRef, useState } from 'react';
import { wbsApi } from '../services/wbsApi.js';
import { getErrorMessage } from '../utils/error.js';

export function useWBS(projectId) {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  const reloadWBS = useCallback(
    async (projectIdOverride = null) => {
      const targetProjectId = projectIdOverride ?? projectId;

      if (!targetProjectId) {
        setTree([]);
        setError('');
        setLoading(false);
        return [];
      }

      const requestId = ++requestRef.current;
      setLoading(true);
      setError('');

      try {
        const data = await wbsApi.list(targetProjectId);

        if (requestRef.current !== requestId) {
          return [];
        }

        const normalized = Array.isArray(data) ? data : [];
        setTree(normalized);
        return normalized;
      } catch (err) {
        if (requestRef.current === requestId) {
          setTree([]);
          setError(getErrorMessage(err, 'No se pudo cargar el WBS del proyecto.'));
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

  useEffect(() => {
    reloadWBS();
  }, [reloadWBS]);

  return {
    tree,
    loading,
    error,
    reloadWBS,
  };
}
