function NodeRow({
  node,
  level,
  onAddChild,
  onRename,
  onIndent,
  onOutdent,
  onMoveUp,
  onMoveDown,
  onDelete,
  canCreate,
  canUpdate,
  canDelete,
  canReorder,
}) {
  return (
    <>
      <tr className="border-b border-slate-100 align-top">
        <td className="px-3 py-2 text-xs font-mono text-slate-700">{node.code}</td>
        <td className="px-3 py-2">
          <div style={{ paddingLeft: `${level * 16}px` }}>
            <input
              defaultValue={node.name}
              disabled={!canUpdate}
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value && value !== node.name) onRename(node, value);
              }}
              className="w-full rounded-md border border-slate-300 px-2 py-1 disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>
        </td>
        <td className="px-3 py-2">
          <div className="flex flex-wrap gap-2">
            {canCreate ? (
              <button type="button" onClick={() => onAddChild(node)} className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white">
                Agregar hijo
              </button>
            ) : null}
            {canReorder ? (
              <>
                <button type="button" onClick={() => onMoveUp(node)} className="rounded-md bg-slate-100 px-2 py-1 text-xs">
                  Subir fila
                </button>
                <button type="button" onClick={() => onMoveDown(node)} className="rounded-md bg-slate-100 px-2 py-1 text-xs">
                  Bajar fila
                </button>
                <button type="button" onClick={() => onIndent(node)} className="rounded-md bg-slate-100 px-2 py-1 text-xs">
                  Bajar nivel
                </button>
                <button type="button" onClick={() => onOutdent(node)} className="rounded-md bg-slate-100 px-2 py-1 text-xs">
                  Subir nivel
                </button>
              </>
            ) : null}
            {canDelete ? (
              <button type="button" onClick={() => onDelete(node)} className="rounded-md bg-red-100 px-2 py-1 text-xs text-red-700">
                Eliminar
              </button>
            ) : null}
            {!canCreate && !canUpdate && !canDelete && !canReorder ? (
              <span className="text-xs text-slate-400">Solo lectura</span>
            ) : null}
          </div>
        </td>
      </tr>
      {node.children?.map((child) => (
        <NodeRow
          key={child.id}
          node={child}
          level={level + 1}
          onAddChild={onAddChild}
          onRename={onRename}
          onIndent={onIndent}
          onOutdent={onOutdent}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDelete={onDelete}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canDelete={canDelete}
          canReorder={canReorder}
        />
      ))}
    </>
  );
}

export default function WBSTree(props) {
  const { tree } = props;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-3 py-2 font-medium">Código</th>
            <th className="px-3 py-2 font-medium">Nombre</th>
            <th className="px-3 py-2 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {tree.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-3 py-4 text-sm text-slate-500">
                No hay nodos WBS para este proyecto.
              </td>
            </tr>
          ) : (
            tree.map((node) => <NodeRow key={node.id} node={node} level={0} {...props} />)
          )}
        </tbody>
      </table>
    </div>
  );
}
