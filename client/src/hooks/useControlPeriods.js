import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { controlPeriodsApi } from '../services/controlPeriodsApi.js';
import { getErrorMessage } from '../utils/error.js';

export function useControlPeriods(projectId) {
  const [periods, setPeriods] = useState([]);
  const [financialPeriods, setFinancialPeriods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [definitionsLoading, setDefinitionsLoading] = useState(false);
  const [error, setError] = useState('');
  const [definitionsError, setDefinitionsError] = useState('');
  const requestRef = useRef(0);
  const definitionRequestRef = useRef(0);

  const reloadPeriods = useCallback(
    async (projectIdOverride = null) => {
      const targetProjectId = projectIdOverride ?? projectId;

      if (!targetProjectId) {
        setPeriods([]);
        setError('');
        setLoading(false);
        return [];
      }

      const requestId = ++requestRef.current;
      setLoading(true);
      setError('');

      try {
        const data = await controlPeriodsApi.list(targetProjectId);
        if (requestRef.current !== requestId) return [];

        const normalized = Array.isArray(data) ? data : [];
        setPeriods(normalized);
        return normalized;
      } catch (err) {
        if (requestRef.current === requestId) {
          setPeriods([]);
          setError(getErrorMessage(err, 'No se pudieron cargar los períodos financieros registrados.'));
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

  const reloadFinancialPeriods = useCallback(
    async (projectIdOverride = null) => {
      const targetProjectId = projectIdOverride ?? projectId;

      if (!targetProjectId) {
        setFinancialPeriods([]);
        setDefinitionsError('');
        setDefinitionsLoading(false);
        return [];
      }

      const requestId = ++definitionRequestRef.current;
      setDefinitionsLoading(true);
      setDefinitionsError('');

      try {
        const data = await controlPeriodsApi.listDefinitions(targetProjectId);
        if (definitionRequestRef.current !== requestId) return [];

        const normalized = Array.isArray(data) ? data : [];
        setFinancialPeriods(normalized);
        return normalized;
      } catch (err) {
        if (definitionRequestRef.current === requestId) {
          setFinancialPeriods([]);
          setDefinitionsError(getErrorMessage(err, 'No se pudieron cargar las definiciones de períodos financieros.'));
        }
        return [];
      } finally {
        if (definitionRequestRef.current === requestId) {
          setDefinitionsLoading(false);
        }
      }
    },
    [projectId],
  );

  const loadPeriodDetail = useCallback(async (periodId) => {
    return controlPeriodsApi.detail(periodId);
  }, []);

  useEffect(() => {
    reloadPeriods();
    reloadFinancialPeriods();
  }, [reloadPeriods, reloadFinancialPeriods]);

  const latestEditablePeriod = useMemo(
    () => periods.find((item) => ['open', 'reopened'].includes(item.status_code)) || null,
    [periods],
  );

  const latestClosedPeriod = useMemo(
    () => periods.find((item) => item.status_code === 'closed') || null,
    [periods],
  );

  const nextPendingFinancialPeriod = useMemo(
    () => financialPeriods.find((item) => !item.has_snapshot) || null,
    [financialPeriods],
  );

  return {
    periods,
    financialPeriods,
    loading,
    definitionsLoading,
    error,
    definitionsError,
    reloadPeriods,
    reloadFinancialPeriods,
    loadPeriodDetail,
    latestEditablePeriod,
    latestClosedPeriod,
    nextPendingFinancialPeriod,
  };
}
