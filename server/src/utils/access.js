function normalizeCode(value) {
  return String(value || '').trim().toLowerCase();
}

function getUserLike(actor) {
  return actor?.user || actor || null;
}

export function actorHasRole(actor, roleCode) {
  const expected = normalizeCode(roleCode);
  if (!expected) return false;

  const roles = new Set((getUserLike(actor)?.roles || []).map(normalizeCode).filter(Boolean));
  return roles.has(expected);
}

export function isAdminActor(actor) {
  return actorHasRole(actor, 'admin');
}

export function actorHasPermission(actor, permissionCode) {
  if (isAdminActor(actor)) return true;

  const expected = normalizeCode(permissionCode);
  if (!expected) return false;

  const permissions = new Set(
    (getUserLike(actor)?.permissions || []).map(normalizeCode).filter(Boolean)
  );

  return permissions.has(expected);
}
