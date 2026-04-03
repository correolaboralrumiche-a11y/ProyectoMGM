import { useCallback, useMemo, useState } from 'react';
import SectionCard from '../components/common/SectionCard.jsx';
import InlineAlert from '../components/common/InlineAlert.jsx';
import WBSTree from '../components/wbs/WBSTree.jsx';
import { wbsApi } from '../services/wbsApi.js';
import { getErrorMessage } from '../utils/error.js';

const LOCKED_MESSAGE = 'No tienes permiso operativo para modificar el WBS en este proyecto.';
const REORDER_LOCKED_MESSAGE = 'No tienes permiso operativo para reordenar el WBS en este proyecto.';

export default function WBSPage({
  activeProject,
  tree,
  reloadWBS,
  loading = false,
  error = '',
  canCreate = false,
  canUpdate = false,
  canDelete = false,
  canReorder = false,
  operationallyLocked = false,
}) {
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');

  const readOnly = operationallyLocked;

  const clearFeedback = useCallback(() => {
    setPageError('');
    setPageSuccess('');
  }, []);

  const runMutation = useCallback(
    async (action, successMessage = '') => {
      if (busy) return;

      setBusy(true);
      clearFeedback();

      try {
        await action();
        await reloadWBS();
        if (successMessage) {
          setPageSuccess(successMessage);
        }
      } catch (err) {
        setPageError(getErrorMessage(err, 'No se pudo completar la operación sobre el WBS.'));
      } finally {
        setBusy(false);
      }
    },
    [busy, clearFeedback, reloadWBS],
  );

  const guardMutation = useCallback(
    async ({ allowed, deniedMessage, action, successMessage }) => {
      if (!allowed) {
        setPageError(deniedMessage);
        return;
      }

      await runMutation(action, successMessage);
    },
    [runMutation],
  );

  const handlers = useMemo(
    () => ({
      addRoot: async () => {
        const name = window.prompt('Nombre del nodo raíz');
        const normalized = String(name || '').trim();
        if (!normalized) return;

        await guardMutation({
          allowed: canCreate && !readOnly,
          deniedMessage: LOCKED_MESSAGE,
          action: () =>
            wbsApi.create({
              project_id: activeProject.id,
              parent_id: null,
              name: normalized,
            }),
          successMessage: 'Nodo raíz creado correctamente.',
        });
      },
      addChild: async (node) => {
        const name = window.prompt(`Nuevo hijo para ${node.name}`);
        const normalized = String(name || '').trim();
        if (!normalized) return;

        await guardMutation({
          allowed: canCreate && !readOnly,
          deniedMessage: LOCKED_MESSAGE,
          action: () =>
            wbsApi.create({
              project_id: activeProject.id,
              parent_id: node.id,
              name: normalized,
            }),
          successMessage: 'Nodo hijo creado correctamente.',
        });
      },
      rename: async (node, name) => {
        const normalized = String(name || '').trim();
        if (!normalized || normalized === node.name) return;

        await guardMutation({
          allowed: canUpdate && !readOnly,
          deniedMessage: 'No tienes permiso operativo para editar nodos WBS en este proyecto.',
          action: () => wbsApi.update(node.id, { name: normalized }),
          successMessage: 'Nodo WBS actualizado correctamente.',
        });
      },
      indent: async (node) => {
        await guardMutation({
          allowed: canReorder && !readOnly,
          deniedMessage: REORDER_LOCKED_MESSAGE,
          action: () => wbsApi.indent(node.id),
          successMessage: 'Nodo WBS reordenado correctamente.',
        });
      },
      outdent: async (node) => {
        await guardMutation({
          allowed: canReorder && !readOnly,
          deniedMessage: REORDER_LOCKED_MESSAGE,
          action: () => wbsApi.outdent(node.id),
          successMessage: 'Nodo WBS reordenado correctamente.',
        });
      },
      moveUp: async (node) => {
        await guardMutation({
          allowed: canReorder && !readOnly,
          deniedMessage: REORDER_LOCKED_MESSAGE,
          action: () => wbsApi.moveUp(node.id),
          successMessage: 'Nodo WBS movido correctamente.',
        });
      },
      moveDown: async (node) => {
        await guardMutation({
          allowed: canReorder && !readOnly,
          deniedMessage: REORDER_LOCKED_MESSAGE,
          action: () => wbsApi.moveDown(node.id),
          successMessage: 'Nodo WBS movido correctamente.',
        });
      },
      remove: async (node) => {
        const confirmed = window.confirm(`¿Eliminar "${node.name}" y todo su contenido?`);
        if (!confirmed) return;

        await guardMutation({
          allowed: canDelete && !readOnly,
          deniedMessage: 'No tienes permiso operativo para eliminar nodos WBS en este proyecto.',
          action: () => wbsApi.remove(node.id),
          successMessage: 'Nodo WBS eliminado correctamente.',
        });
      },
    }),
    [activeProject?.id, canCreate, canDelete, canReorder, canUpdate, guardMutation, readOnly],
  );

  if (!activeProject) {
    return <SectionCard title="WBS">No hay proyecto activo.</SectionCard>;
  }

  return (
    <SectionCard
      title={`WBS · ${activeProject.name}`}
      subtitle="Estructura jerárquica del proyecto"
      actions={
        canCreate ? (
          <button
            type="button"
            onClick={handlers.addRoot}
            disabled={busy || loading || readOnly}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Procesando...' : 'Nuevo nodo raíz'}
          </button>
        ) : null
      }
    >
      <div className="mb-3 space-y-3">
        {loading ? <InlineAlert tone="info">Actualizando estructura WBS...</InlineAlert> : null}
        {error ? <InlineAlert tone="warning">{error}</InlineAlert> : null}
        {pageError ? <InlineAlert tone="danger">{pageError}</InlineAlert> : null}
        {pageSuccess ? <InlineAlert tone="success">{pageSuccess}</InlineAlert> : null}
        {readOnly ? (
          <InlineAlert tone="warning">
            El proyecto activo está en modo solo lectura operativa. El WBS queda bloqueado para perfiles no administradores.
          </InlineAlert>
        ) : null}
        {!loading && tree.length === 0 ? (
          <InlineAlert tone="info">Este proyecto todavía no tiene nodos WBS. Crea el primero para comenzar.</InlineAlert>
        ) : null}
      </div>

      <WBSTree
        tree={tree}
        onAddChild={handlers.addChild}
        onRename={handlers.rename}
        onIndent={handlers.indent}
        onOutdent={handlers.outdent}
        onMoveUp={handlers.moveUp}
        onMoveDown={handlers.moveDown}
        onDelete={handlers.remove}
        canCreate={canCreate && !readOnly}
        canUpdate={canUpdate && !readOnly}
        canDelete={canDelete && !readOnly}
        canReorder={canReorder && !readOnly}
      />
    </SectionCard>
  );
}
