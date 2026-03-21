import { useEffect, useState } from 'react';
import { wbsApi } from '../services/wbsApi';

export function useWBS(projectId) {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadWBS() {
    if (!projectId) {
      setTree([]);
      return;
    }

    setLoading(true);
    try {
      const data = await wbsApi.list(projectId);
      setTree(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWBS();
  }, [projectId]);

  return {
    tree,
    loading,
    reloadWBS: loadWBS,
  };
}
