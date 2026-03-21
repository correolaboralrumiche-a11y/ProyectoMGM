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
}) {
  return (
    <>
      <div className="grid grid-cols-[120px_1fr_420px] items-center gap-3 border-b border-slate-100 px-3 py-2 text-sm">
        <div className="font-mono text-slate-500">{node.code}</div>
        <div style={{ paddingLeft: `${level * 18}px` }}>
          <input
            defaultValue={node.name}
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value && value !== node.name) onRename(node, value);
            }}
            className="w-full rounded-md border border-slate-300 px-2 py-1"
          />
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button onClick={() => onAddChild(node)} className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white">
            Agregar hijo
          </button>
          <button onClick={() => onMoveUp(node)} className="rounded-md bg-slate-100 px-2 py-1 text-xs">
            Subir fila
          </button>
          <button onClick={() => onMoveDown(node)} className="rounded-md bg-slate-100 px-2 py-1 text-xs">
            Bajar fila
          </button>
          <button onClick={() => onIndent(node)} className="rounded-md bg-slate-100 px-2 py-1 text-xs">
            Bajar nivel
          </button>
          <button onClick={() => onOutdent(node)} className="rounded-md bg-slate-100 px-2 py-1 text-xs">
            Subir nivel
          </button>
          <button onClick={() => onDelete(node)} className="rounded-md bg-red-100 px-2 py-1 text-xs text-red-700">
            Eliminar
          </button>
        </div>
      </div>
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
        />
      ))}
    </>
  );
}

export default function WBSTree(props) {
  const { tree } = props;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="grid grid-cols-[120px_1fr_420px] gap-3 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
        <div>Código</div>
        <div>Nombre</div>
        <div className="text-right">Acciones</div>
      </div>
      <div>
        {tree.length === 0 ? (
          <div className="px-3 py-6 text-center text-slate-500">No hay nodos WBS para este proyecto.</div>
        ) : (
          tree.map((node) => <NodeRow key={node.id} node={node} level={0} {...props} />)
        )}
      </div>
    </div>
  );
}
