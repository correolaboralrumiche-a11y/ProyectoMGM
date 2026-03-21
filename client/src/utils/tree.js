export function flattenWbsTree(tree, level = 0) {
  const rows = [];

  tree.forEach((node) => {
    rows.push({
      type: 'wbs',
      level,
      ...node,
    });

    if (node.children?.length) {
      rows.push(...flattenWbsTree(node.children, level + 1));
    }
  });

  return rows;
}
