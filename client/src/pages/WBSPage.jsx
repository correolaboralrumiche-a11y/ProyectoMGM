import { useState } from 'react';
import SectionCard from '../components/common/SectionCard.jsx';
import InlineAlert from '../components/common/InlineAlert.jsx';
import WBSTree from '../components/wbs/WBSTree.jsx';
import { wbsApi } from '../services/wbsApi.js';
import { getErrorMessage } from '../utils/error.js';

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

  async function runMutation(action, successMessage = '') {
    if (busy) return;

    setBusy(true);
    setPageError('');
    setPageSuccess('');

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
  }

  async function handleAddRoot() {
    if (!canCreate || readOnly) {
      setPageError('No tienes permiso operativo para crear nodos WBS en este proyecto.');
      return;
    }

    const name = window.prompt('Nombre del nodo raíz');
    const normalized = String(name || '').trim();
    if (!normalized) return;

    await runMutation(
      () =>
        wbsApi.create({
          project_id: activeProject.id,
          parent_id: null,
          name: normalized,
        }),
      'Nodo raíz creado correctamente.'
    );
  }

  async function handleAddChild(node) {
    if (!canCreate || readOnly) {
      setPageError('No tienes permiso operativo para crear nodos WBS en este proyecto.');
      return;
    }

    const name = window.prompt(`Nuevo hijo para ${node.name}`);
    const normalized = String(name || '').trim();
    if (!normalized) return;

    await runMutation(
      () =>
        wbsApi.create({
          project_id: activeProject.id,
          parent_id: node.id,
          name: normalized,
        }),
      'Nodo hijo creado correctamente.'
    );
  }

  async function handleRename(node, name) {
    if (!canUpdate || readOnly) {
      setPageError('No tienes permiso operativo para editar nodos WBS en este proyecto.');
      return;
    }

    const normalized = String(name || '').trim();
    if (!normalized || normalized === node.name) return;

    await runMutation(() => wbsApi.update(node.id, { name: normalized }), 'Nodo WBS actualizado correctamente.');
  }

  async function handleIndent(node) {
    if (!canReorder || readOnly) {
      setPageError('No tienes permiso operativo para reordenar el WBS en este proyecto.');
      return;
    }

    await runMutation(() => wbsApi.indent(node.id), 'Nodo WBS reordenado correctamente.');
  }

  async function handleOutdent(node) {
    if (!canReorder || readOnly) {
      setPageError('No tienes permiso operativo para reordenar el WBS en este proyecto.');
      return;
    }

    await runMutation(() => wbsApi.outdent(node.id), 'Nodo WBS reordenado correctamente.');
  }

  async function handleMoveUp(node) {
    if (!canReorder || readOnly) {
      setPageError('No tienes permiso operativo para reordenar el WBS en este proyecto.');
      return;
    }

    await runMutation(() => wbsApi.moveUp(node.id), 'Nodo WBS movido correctamente.');
  }

  async function handleMoveDown(node) {
    if (!canReorder || readOnly) {
      setPageError('No tienes permiso operativo para reordenar el WBS en este proyecto.');
      return;
    }

    await runMutation(() => wbsApi.moveDown(node.id), 'Nodo WBS movido correctamente.');
  }

  async function handleDelete(node) {
    if (!canDelete || readOnly) {
      setPageError('No tienes permiso operativo para eliminar nodos WBS en este proyecto.');
      return;
    }

    const confirmed = window.confirm(`¿Eliminar "${node.name}" y todo su contenido?`);
    if (!confirmed) return;

    await runMutation(() => wbsApi.remove(node.id), 'Nodo WBS eliminado correctamente.');
  }

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
            onClick={handleAddRoot}
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
          <InlineAlert tone="info">El proyecto activo está en modo solo lectura operativa. El WBS puede consultarse, pero no modificarse.</InlineAlert>
        ) : null}
        {!loading && !tree.length ? (
          <InlineAlert tone="info">Este proyecto todavía no tiene nodos WBS. Crea el primero para comenzar.</InlineAlert>
        ) : null}
      </div>

      <WBSTree
        tree={tree}
        onAddChild={handleAddChild}
        onRename={handleRename}
        onIndent={handleIndent}
        onOutdent={handleOutdent}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onDelete={handleDelete}
        canCreate={canCreate && !readOnly}
        canUpdate={canUpdate && !readOnly}
        canDelete={canDelete && !readOnly}
        canReorder={canReorder && !readOnly}
      />
    </SectionCard>
  );
}
