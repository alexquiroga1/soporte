export const PERMISSIONS = Object.freeze({
  ALL: "Acceso total al sistema",
  SECURITY: "Gestionar usuarios y roles",
  REPORTS: "Ver reportes financieros",
  PRODUCTS: "Editar catálogo de productos",
  CREDITS: "Aprobar créditos y descuentos",
  TICKETS: "Ver y actualizar tickets asignados",
  SALES: "Registrar ventas y cobros",
  CASH: "Abrir y cerrar corte de caja",
});

export const SYSTEM_PERMISSIONS = Object.freeze(
  Object.values(PERMISSIONS)
);

export const MODULE_ACCESS = Object.freeze({
  dashboard: [],
  tickets: [PERMISSIONS.TICKETS],
  pos: [PERMISSIONS.SALES],
  caja: [PERMISSIONS.SALES, PERMISSIONS.CASH],
  clientes: [
    PERMISSIONS.TICKETS,
    PERMISSIONS.CREDITS,
    PERMISSIONS.SALES,
  ],
  creditos: [PERMISSIONS.CREDITS],
  productos: [PERMISSIONS.PRODUCTS, PERMISSIONS.SALES],
  facturacion: [PERMISSIONS.TICKETS, PERMISSIONS.SALES],
  presupuestos: [PERMISSIONS.TICKETS, PERMISSIONS.SALES],
  crm: [PERMISSIONS.SALES],
  reportes: [PERMISSIONS.REPORTS],
  configuracion: [PERMISSIONS.SECURITY],
});

export function normalizePermissions(value) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((permission) => String(permission || "").trim())
        .filter((permission) => SYSTEM_PERMISSIONS.includes(permission))
    )
  );
}

export function isAdministratorProfile(profile) {
  return (
    String(profile?.rol || profile?.role || "")
      .trim()
      .toLowerCase() === "administrador"
  );
}

export function profileHasPermission(profile, permission) {
  if (!profile || !permission) return false;

  if (isAdministratorProfile(profile)) return true;

  const permissions = normalizePermissions(profile?.permisos);

  return (
    permissions.includes(PERMISSIONS.ALL) ||
    permissions.includes(permission)
  );
}

export function profileHasAnyPermission(profile, permissions = []) {
  if (!profile) return false;
  if (isAdministratorProfile(profile)) return true;

  const required = Array.isArray(permissions)
    ? permissions.filter(Boolean)
    : [];

  if (!required.length) return true;

  return required.some((permission) =>
    profileHasPermission(profile, permission)
  );
}
