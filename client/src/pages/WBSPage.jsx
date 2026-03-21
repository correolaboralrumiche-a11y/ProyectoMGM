import SectionCard from '../components/common/SectionCard.jsx';
import WBSTree from '../components/wbs/WBSTree.jsx';
import { wbsApi } from '../services/wbsApi.js';

export default function WBSPage({ activeProject, tree, reloadWBS }) {
  async function handleAddRoot() {
    const name = prompt('Nombre del nodo raíz');
    if (!name) return;
    await wbsApi.create({
      project_id: activeProject.id,
      parent_id: null,
      name,
    });
    await reloadWBS();
  }

  async function handleAddChild(node) {
    const name = prompt(`Nuevo hijo para ${node.name}`);
    if (!name) return;
    await wbsApi.create({
      project_id: activeProject.id,
      parent_id: node.id,
      name,
    });
    await reloadWBS();
  }

  async function handleRename(node, name) {
    await wbsApi.update(node.id, { name });
    await reloadWBS();
  }

  async function handleIndent(node) {
    try {
      await wbsApi.indent(node.id);
      await reloadWBS();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleOutdent(node) {
    try {
      await wbsApi.outdent(node.id);
      await reloadWBS();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleMoveUp(node) {
    try {
      await wbsApi.moveUp(node.id);
      await reloadWBS();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleMoveDown(node) {
    try {
      await wbsApi.moveDown(node.id);
      await reloadWBS();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleDelete(node) {
    const confirmed = confirm(`¿Eliminar "${node.name}" y todo su contenido?`);
    if (!confirmed) return;
    await wbsApi.remove(node.id);
    await reloadWBS();
  }

  if (!activeProject) {
    return (
      <SectionCard title="WBS" subtitle="Selecciona primero un proyecto">
        <div className="text-sm text-slate-500">No hay proyecto activo.</div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={`WBS - ${activeProject.name}`}
      subtitle="Estructura jerárquica del proyecto con orden entre hermanos"
      actions={
        <button
          onClick={handleAddRoot}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          Nuevo nodo raíz
        </button>
      }
    >
      <WBSTree
        tree={tree}
        onAddChild={handleAddChild}
        onRename={handleRename}
        onIndent={handleIndent}
        onOutdent={handleOutdent}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onDelete={handleDelete}
      />
    </SectionCard>
  );
}
