import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  motion,
} from "motion/react";

import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Check,
  CircleAlert,
  KeyRound,
  Mail,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X,
} from "lucide-react";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import {
  SYSTEM_PERMISSIONS,
  createRole,
  createSystemUser,
  deleteRole,
  saveBusinessConfig,
  subscribeToBusinessConfig,
  subscribeToRoles,
  subscribeToSystemUsers,
  toggleSystemUser,
  updateRole,
  updateSystemUserRole,
} from "../../services/configuracion.service.js";

import {
  notify,
} from "../../services/notifications.js";

import "./Configuracion.css";

const EMPTY_BUSINESS = {
  nombre: "",
  cuit: "",
  telefono: "",
  correo: "",
  direccion: "",
  impuesto: "21",
  presupuestoValidezDias: "15",
  garantiaDias: "30",
};

const EMPTY_USER = {
  nombre: "",
  email: "",
  rol: "",
  password: "",
  confirmPassword: "",
};

const EMPTY_ROLE = {
  nombre: "",
  desc: "",
  permisos: [],
};

function initials(name) {
  return String(name || "U")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function errorMessage(error) {
  const map = {
    BUSINESS_NAME_REQUIRED:
      "Ingresá el nombre del negocio.",

    BUSINESS_EMAIL_INVALID:
      "El correo del negocio no es válido.",

    USER_NAME_REQUIRED:
      "Ingresá el nombre del usuario.",

    USER_EMAIL_INVALID:
      "Ingresá un correo electrónico válido.",

    USER_ROLE_REQUIRED:
      "Seleccioná un rol.",

    USER_PASSWORD_TOO_SHORT:
      "La contraseña temporal debe tener al menos 6 caracteres.",

    USER_PASSWORD_MISMATCH:
      "Las contraseñas no coinciden.",

    USER_AUTH_EMAIL_EXISTS:
      "Ese correo ya existe en Firebase Authentication. Si ya era un usuario anterior, hacé que inicie sesión una vez para vincular su perfil por UID.",

    USER_AUTH_UID_REQUIRED:
      "El perfil todavía no está vinculado a un UID de Firebase Authentication.",

    USER_EMAIL_EXISTS:
      "Ya existe un perfil interno con ese correo.",

    USER_ROLE_NOT_FOUND:
      "El rol seleccionado ya no existe.",

    USER_ID_REQUIRED:
      "No pudimos identificar al usuario.",

    USER_NOT_FOUND:
      "El perfil del usuario ya no existe.",

    USER_SELF_DEACTIVATE:
      "No podés desactivar tu propio usuario mientras tenés la sesión iniciada.",

    USER_SELF_ROLE_CHANGE:
      "No podés quitarte tu propio rol Administrador.",

    ROLE_ID_REQUIRED:
      "No pudimos identificar el rol.",

    ROLE_NAME_REQUIRED:
      "Ingresá un nombre para el rol.",

    ROLE_PERMISSION_REQUIRED:
      "Seleccioná al menos un permiso.",

    ROLE_NAME_EXISTS:
      "Ya existe un rol con ese nombre.",

    ROLE_NOT_FOUND:
      "El rol ya no existe.",

    ROLE_ADMIN_PROTECTED:
      "El rol Administrador está protegido y no se puede eliminar.",

    ROLE_ADMIN_RENAME_PROTECTED:
      "El rol Administrador está protegido y no puede cambiar de nombre.",

    ROLE_ADMIN_PERMISSION_PROTECTED:
      "El rol Administrador debe conservar el permiso Acceso total al sistema.",

    ROLE_IN_USE:
      `Ese rol está asignado a ${error?.assignedUsers || 1} usuario(s). Cambiá sus roles antes de eliminarlo.`,
  };

  return (
    map[error?.message] ||
    error?.message ||
    "Ocurrió un error inesperado."
  );
}

export default function Configuracion() {
  const navigate = useNavigate();

  const {
    profile,
    user,
    hasPermission,
  } = useAuth();

  const author =
    profile?.nombre ||
    profile?.name ||
    user?.email ||
    "Sistema";

  const [business, setBusiness] =
    useState(EMPTY_BUSINESS);

  const [users, setUsers] =
    useState([]);

  const [roles, setRoles] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [savingBusiness, setSavingBusiness] =
    useState(false);

  const [userModalOpen, setUserModalOpen] =
    useState(false);

  const [userForm, setUserForm] =
    useState(EMPTY_USER);

  const [savingUser, setSavingUser] =
    useState(false);

  const [roleModalOpen, setRoleModalOpen] =
    useState(false);

  const [editingRole, setEditingRole] =
    useState(null);

  const [roleForm, setRoleForm] =
    useState(EMPTY_ROLE);

  const [savingRole, setSavingRole] =
    useState(false);

  const [processingUserId, setProcessingUserId] =
    useState(null);

  const [deletingRoleId, setDeletingRoleId] =
    useState(null);

  /* =======================================
     FIRESTORE
  ======================================= */

  useEffect(() => {
    let businessReady = false;
    let usersReady = false;
    let rolesReady = false;

    const updateLoading = () => {
      if (
        businessReady &&
        usersReady &&
        rolesReady
      ) {
        setLoading(false);
      }
    };

    const unsubscribeBusiness =
      subscribeToBusinessConfig(
        (data) => {
          setBusiness({
            nombre: data.nombre || "",
            cuit: data.cuit || "",
            telefono: data.telefono || "",
            correo: data.correo || "",
            direccion: data.direccion || "",
            impuesto: String(data.impuesto ?? 21),
            presupuestoValidezDias: String(
              data.presupuestoValidezDias ?? 15
            ),
            garantiaDias: String(
              data.garantiaDias ?? 30
            ),
          });

          businessReady = true;
          updateLoading();
        },

        (error) => {
          console.error(error);
          businessReady = true;
          updateLoading();

          notify.error(
            "Configuración",
            "No se pudo cargar la configuración del negocio."
          );
        }
      );

    const unsubscribeUsers =
      subscribeToSystemUsers(
        (rows) => {
          setUsers(rows);
          usersReady = true;
          updateLoading();
        },

        (error) => {
          console.error(error);
          usersReady = true;
          updateLoading();

          notify.error(
            "Configuración",
            "No se pudieron cargar los usuarios."
          );
        }
      );

    const unsubscribeRoles =
      subscribeToRoles(
        (rows) => {
          setRoles(rows);
          rolesReady = true;
          updateLoading();
        },

        (error) => {
          console.error(error);
          rolesReady = true;
          updateLoading();

          notify.error(
            "Configuración",
            "No se pudieron cargar los roles."
          );
        }
      );

    return () => {
      unsubscribeBusiness();
      unsubscribeUsers();
      unsubscribeRoles();
    };
  }, []);

  /* =======================================
     PERMISOS DEL USUARIO ACTUAL
  ======================================= */

  const currentRoleName =
    profile?.rol ||
    profile?.role ||
    "";

  const canManageSecurity =
    hasPermission(
      "Gestionar usuarios y roles"
    );

  const activeUsers =
    useMemo(
      () =>
        users.filter(
          (item) =>
            item.activo !== false
        ).length,
      [users]
    );

  const currentUid =
    user?.uid ||
    "";

  const currentEmail =
    String(
      user?.email ||
      ""
    )
      .trim()
      .toLowerCase();

  const isCurrentSystemUser =
    (systemUser) =>
      Boolean(
        systemUser &&
        (
          systemUser.id === currentUid ||
          (
            currentEmail &&
            String(
              systemUser.email ||
              ""
            )
              .trim()
              .toLowerCase() === currentEmail
          )
        )
      );

  /* =======================================
     NEGOCIO
  ======================================= */

  const handleSaveBusiness =
    async () => {
      try {
        setSavingBusiness(true);

        await saveBusinessConfig({
          ...business,
          author,
        });

        notify.success(
          "Configuración guardada",
          "Los datos del negocio se actualizaron."
        );
      } catch (error) {
        console.error(error);

        notify.error(
          "No se pudo guardar",
          errorMessage(error)
        );
      } finally {
        setSavingBusiness(false);
      }
    };

  /* =======================================
     USUARIOS
  ======================================= */

  const openNewUser =
    () => {
      setUserForm({
        ...EMPTY_USER,
        rol:
          roles[0]?.nombre ||
          "",
      });

      setUserModalOpen(true);
    };

  const handleCreateUser =
    async () => {
      try {
        setSavingUser(true);

        if (
          userForm.password !==
          userForm.confirmPassword
        ) {
          throw new Error(
            "USER_PASSWORD_MISMATCH"
          );
        }

        const created =
          await createSystemUser({
            nombre: userForm.nombre,
            email: userForm.email,
            rol: userForm.rol,
            password: userForm.password,
            author,
          });

        setUserModalOpen(false);
        setUserForm(EMPTY_USER);

        notify.success(
          "Usuario creado",
          `${created.nombre} ya puede iniciar sesión con su correo y la contraseña temporal.`
        );
      } catch (error) {
        console.error(error);

        notify.error(
          "No se pudo crear",
          errorMessage(error)
        );
      } finally {
        setSavingUser(false);
      }
    };

  const handleToggleUser =
    async (systemUser) => {
      try {
        setProcessingUserId(systemUser.id);

        const active =
          await toggleSystemUser(
            systemUser,
            author
          );

        notify.success(
          active
            ? "Usuario activado"
            : "Usuario desactivado",
          systemUser.nombre || systemUser.email
        );
      } catch (error) {
        console.error(error);

        notify.error(
          "No se pudo actualizar",
          errorMessage(error)
        );
      } finally {
        setProcessingUserId(null);
      }
    };

  const handleUserRole =
    async (
      systemUser,
      roleName
    ) => {
      try {
        setProcessingUserId(systemUser.id);

        await updateSystemUserRole(
          systemUser.id,
          roleName,
          author
        );

        notify.success(
          "Rol actualizado",
          `${systemUser.nombre || systemUser.email} ahora tiene el rol ${roleName}.`
        );
      } catch (error) {
        console.error(error);

        notify.error(
          "No se pudo cambiar el rol",
          errorMessage(error)
        );
      } finally {
        setProcessingUserId(null);
      }
    };

  /* =======================================
     ROLES
  ======================================= */

  const openNewRole =
    () => {
      setEditingRole(null);
      setRoleForm(EMPTY_ROLE);
      setRoleModalOpen(true);
    };

  const openEditRole =
    (role) => {
      setEditingRole(role);

      setRoleForm({
        nombre: role.nombre || "",
        desc: role.desc || "",
        permisos: Array.isArray(role.permisos)
          ? role.permisos
          : [],
      });

      setRoleModalOpen(true);
    };

  const togglePermission =
    (permission) => {
      setRoleForm(
        (current) => {
          const exists =
            current.permisos.includes(
              permission
            );

          return {
            ...current,

            permisos:
              exists
                ? current.permisos.filter(
                    (item) =>
                      item !==
                      permission
                  )
                : [
                    ...current.permisos,
                    permission,
                  ],
          };
        }
      );
    };

  const handleSaveRole =
    async () => {
      try {
        setSavingRole(true);

        if (editingRole) {
          await updateRole(
            editingRole.id,
            {
              ...roleForm,
              author,
            }
          );

          notify.success(
            "Rol actualizado",
            "Los permisos se guardaron correctamente."
          );
        } else {
          await createRole({
            ...roleForm,
            author,
          });

          notify.success(
            "Rol creado",
            "El nuevo rol ya puede asignarse a usuarios."
          );
        }

        setRoleModalOpen(false);
        setEditingRole(null);
        setRoleForm(EMPTY_ROLE);
      } catch (error) {
        console.error(error);

        notify.error(
          "No se pudo guardar el rol",
          errorMessage(error)
        );
      } finally {
        setSavingRole(false);
      }
    };

  const handleDeleteRole =
    async (role) => {
      const confirmed =
        window.confirm(
          `¿Eliminar el rol "${role.nombre}"?\n\nSolo se puede eliminar si no está asignado a ningún usuario.`
        );

      if (!confirmed) {
        return;
      }

      try {
        setDeletingRoleId(role.id);

        await deleteRole(
          role,
          author
        );

        notify.success(
          "Rol eliminado",
          "El rol fue eliminado correctamente."
        );
      } catch (error) {
        console.error(error);

        notify.error(
          "No se pudo eliminar",
          errorMessage(error)
        );
      } finally {
        setDeletingRoleId(null);
      }
    };

  if (loading) {
    return (
      <main className="config-page">
        <div className="config-loading">
          Cargando configuración...
        </div>
      </main>
    );
  }

  return (
    <main className="config-page">
      <div className="config-shell">

        <header className="config-header">
          <div>
            <button
              type="button"
              className="config-back"
              onClick={() =>
                navigate(
                  "/dashboard"
                )
              }
            >
              <ArrowLeft size={17} />
              Dashboard
            </button>

            <span className="config-eyebrow">
              Sistema / Administración
            </span>

            <h1>
              Configuración
            </h1>

            <p>
              Datos del negocio, perfiles internos, roles y parámetros operativos.
            </p>
          </div>

          <div className="config-status">
            <ShieldCheck size={17} />
            <div>
              <span>Tu perfil</span>
              <strong>
                {currentRoleName || "Usuario"}
              </strong>
            </div>
          </div>
        </header>

        {!canManageSecurity && (
          <div className="config-warning">
            <CircleAlert size={18} />
            <div>
              <strong>
                Acceso de solo lectura
              </strong>
              <span>
                Tu perfil no tiene el permiso “Gestionar usuarios y roles”. Las reglas de Firestore deben seguir siendo la protección principal.
              </span>
            </div>
          </div>
        )}

        <section className="config-summary">
          <article>
            <Building2 size={18} />
            <div>
              <span>Negocio</span>
              <strong>
                {business.nombre || "Sin configurar"}
              </strong>
            </div>
          </article>

          <article>
            <Users size={18} />
            <div>
              <span>Usuarios activos</span>
              <strong>
                {activeUsers} / {users.length}
              </strong>
            </div>
          </article>

          <article>
            <KeyRound size={18} />
            <div>
              <span>Roles</span>
              <strong>
                {roles.length}
              </strong>
            </div>
          </article>

          <article>
            <BadgeCheck size={18} />
            <div>
              <span>IVA configurado</span>
              <strong>
                {Number(business.impuesto || 0)}%
              </strong>
            </div>
          </article>
        </section>

        <section className="config-panel">
          <div className="config-panel-head">
            <div>
              <span>Negocio</span>
              <h2>Datos y parámetros generales</h2>
              <p>
                Esta información se guarda en negocio/configuracion.
              </p>
            </div>

            <button
              type="button"
              className="config-primary"
              disabled={
                savingBusiness ||
                !canManageSecurity
              }
              onClick={handleSaveBusiness}
            >
              <Save size={16} />
              {savingBusiness
                ? "Guardando..."
                : "Guardar cambios"}
            </button>
          </div>

          <div className="config-business-grid">
            <label>
              <span>Nombre del negocio *</span>
              <input
                value={business.nombre}
                disabled={!canManageSecurity}
                onChange={(event) =>
                  setBusiness(
                    (current) => ({
                      ...current,
                      nombre: event.target.value,
                    })
                  )
                }
              />
            </label>

            <label>
              <span>CUIT</span>
              <input
                value={business.cuit}
                disabled={!canManageSecurity}
                placeholder="20-12345678-9"
                onChange={(event) =>
                  setBusiness(
                    (current) => ({
                      ...current,
                      cuit: event.target.value,
                    })
                  )
                }
              />
            </label>

            <label>
              <span>Teléfono</span>
              <input
                value={business.telefono}
                disabled={!canManageSecurity}
                onChange={(event) =>
                  setBusiness(
                    (current) => ({
                      ...current,
                      telefono: event.target.value,
                    })
                  )
                }
              />
            </label>

            <label>
              <span>Correo</span>
              <input
                type="email"
                value={business.correo}
                disabled={!canManageSecurity}
                onChange={(event) =>
                  setBusiness(
                    (current) => ({
                      ...current,
                      correo: event.target.value,
                    })
                  )
                }
              />
            </label>

            <label className="wide">
              <span>Dirección</span>
              <input
                value={business.direccion}
                disabled={!canManageSecurity}
                onChange={(event) =>
                  setBusiness(
                    (current) => ({
                      ...current,
                      direccion: event.target.value,
                    })
                  )
                }
              />
            </label>

            <label>
              <span>IVA / Impuesto (%)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={business.impuesto}
                disabled={!canManageSecurity}
                onChange={(event) =>
                  setBusiness(
                    (current) => ({
                      ...current,
                      impuesto: event.target.value,
                    })
                  )
                }
              />
            </label>

            <label>
              <span>Validez presupuesto (días)</span>
              <input
                type="number"
                min="1"
                value={business.presupuestoValidezDias}
                disabled={!canManageSecurity}
                onChange={(event) =>
                  setBusiness(
                    (current) => ({
                      ...current,
                      presupuestoValidezDias: event.target.value,
                    })
                  )
                }
              />
            </label>

            <label>
              <span>Garantía predeterminada (días)</span>
              <input
                type="number"
                min="0"
                value={business.garantiaDias}
                disabled={!canManageSecurity}
                onChange={(event) =>
                  setBusiness(
                    (current) => ({
                      ...current,
                      garantiaDias: event.target.value,
                    })
                  )
                }
              />
            </label>
          </div>
        </section>

        <section className="config-panel">
          <div className="config-panel-head">
            <div>
              <span>Seguridad</span>
              <h2>Usuarios internos</h2>
              <p>
                Perfiles utilizados por la app para nombre, rol y estado.
              </p>
            </div>

            <button
              type="button"
              className="config-primary"
              disabled={
                !canManageSecurity ||
                !roles.length
              }
              onClick={openNewUser}
            >
              <Plus size={16} />
              Nuevo usuario
            </button>
          </div>

          <div className="config-auth-note">
            <CircleAlert size={18} />
            <div>
              <strong>
                Perfil + Authentication vinculados por UID
              </strong>
              <span>
                Los usuarios nuevos se crean en Firebase Authentication y en Firestore al mismo tiempo. Los perfiles antiguos se migran automáticamente al UID cuando inician sesión.
              </span>
            </div>
          </div>

          <div className="config-table-wrap">
            <table className="config-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Authentication</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {users.map(
                  (systemUser) => {
                    const isProcessing =
                      processingUserId ===
                      systemUser.id;

                    const isCurrentUser =
                      isCurrentSystemUser(
                        systemUser
                      );

                    const isCurrentAdmin =
                      isCurrentUser &&
                      String(
                        systemUser.rol ||
                        ""
                      ).toLowerCase() ===
                        "administrador";

                    return (
                      <tr key={systemUser.id}>
                        <td>
                          <div className="config-user">
                            <div className="config-avatar">
                              {initials(systemUser.nombre)}
                            </div>

                            <section>
                              <strong>
                                {systemUser.nombre || "Sin nombre"}
                              </strong>

                              <span>
                                <Mail size={12} />
                                {systemUser.email || "—"}
                              </span>
                            </section>
                          </div>
                        </td>

                        <td>
                          <select
                            value={systemUser.rol || ""}
                            disabled={
                              !canManageSecurity ||
                              isProcessing ||
                              isCurrentAdmin
                            }
                            onChange={(event) =>
                              handleUserRole(
                                systemUser,
                                event.target.value
                              )
                            }
                          >
                            <option value="">
                              Sin rol
                            </option>

                            {roles.map(
                              (role) => (
                                <option
                                  key={role.id}
                                  value={role.nombre}
                                >
                                  {role.nombre}
                                </option>
                              )
                            )}

                            {systemUser.rol === "Administrador" &&
                              !roles.some(
                                (role) =>
                                  role.nombre ===
                                  "Administrador"
                              ) && (
                                <option value="Administrador">
                                  Administrador
                                </option>
                              )}
                          </select>
                        </td>

                        <td>
                          {
                            systemUser.uid ||
                            systemUser.authUid
                          ? (
                            <span className="config-auth-ready">
                              <Check size={14} />
                              Vinculado
                            </span>
                          ) : (
                            <span
                              className="config-auth-pending"
                              title="El usuario debe iniciar sesión una vez para migrar el perfil al UID"
                            >
                              <CircleAlert size={14} />
                              Pendiente login
                            </span>
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              systemUser.activo !== false
                                ? "config-user-status active"
                                : "config-user-status inactive"
                            }
                          >
                            {systemUser.activo !== false
                              ? "Activo"
                              : "Desactivado"}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className={
                              systemUser.activo !== false
                                ? "config-toggle on"
                                : "config-toggle"
                            }
                            disabled={
                              !canManageSecurity ||
                              isProcessing ||
                              (
                                isCurrentUser &&
                                systemUser.activo !== false
                              )
                            }
                            title={
                              isCurrentUser &&
                              systemUser.activo !== false
                                ? "No podés desactivar tu propio usuario"
                                : systemUser.activo !== false
                                  ? "Desactivar usuario"
                                  : "Activar usuario"
                            }
                            onClick={() =>
                              handleToggleUser(
                                systemUser
                              )
                            }
                            aria-label={
                              systemUser.activo !== false
                                ? "Desactivar usuario"
                                : "Activar usuario"
                            }
                          >
                            <span />
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )}

                {!users.length && (
                  <tr>
                    <td colSpan="5">
                      <div className="config-empty">
                        No hay perfiles de usuario registrados.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="config-panel">
          <div className="config-panel-head">
            <div>
              <span>Autorización</span>
              <h2>Roles y permisos</h2>
              <p>
                Mantenemos los permisos compatibles con el sistema anterior.
              </p>
            </div>

            <button
              type="button"
              className="config-primary"
              disabled={!canManageSecurity}
              onClick={openNewRole}
            >
              <Plus size={16} />
              Nuevo rol
            </button>
          </div>

          <div className="config-roles-grid">
            {roles.map(
              (role) => (
                <motion.article
                  key={role.id}
                  className="config-role-card"
                  layout
                  initial={{
                    opacity: 0,
                    y: 8,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                >
                  <div className="config-role-head">
                    <div className="config-role-icon">
                      <ShieldCheck size={18} />
                    </div>

                    <div>
                      <strong>
                        {role.nombre}
                      </strong>

                      <span>
                        {role.desc || "Sin descripción"}
                      </span>
                    </div>

                    {canManageSecurity && (
                      <div className="config-role-actions">
                        <button
                          type="button"
                          title="Editar rol"
                          onClick={() =>
                            openEditRole(
                              role
                            )
                          }
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          type="button"
                          title={
                            String(role.nombre || "").toLowerCase() ===
                            "administrador"
                              ? "El rol Administrador está protegido"
                              : "Eliminar rol"
                          }
                          className="danger"
                          disabled={
                            deletingRoleId ===
                              role.id ||
                            String(role.nombre || "").toLowerCase() ===
                              "administrador"
                          }
                          onClick={() =>
                            handleDeleteRole(
                              role
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="config-permission-list">
                    {(role.permisos || []).map(
                      (permission) => (
                        <div key={permission}>
                          <Check size={13} />
                          <span>
                            {permission}
                          </span>
                        </div>
                      )
                    )}

                    {!role.permisos?.length && (
                      <small>
                        Sin permisos configurados.
                      </small>
                    )}
                  </div>
                </motion.article>
              )
            )}

            {!roles.length && (
              <div className="config-empty roles">
                No hay roles configurados todavía.
              </div>
            )}
          </div>
        </section>
      </div>

      {userModalOpen && (
        <div
          className="config-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !savingUser
            ) {
              setUserModalOpen(false);
            }
          }}
        >
          <motion.div
            className="config-modal"
            initial={{
              opacity: 0,
              scale: 0.98,
              y: 8,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
          >
            <header>
              <div>
                <span>Usuarios</span>
                <h3>Nuevo usuario</h3>
              </div>

              <button
                type="button"
                disabled={savingUser}
                onClick={() =>
                  setUserModalOpen(false)
                }
              >
                <X size={18} />
              </button>
            </header>

            <div className="config-modal-form">
              <label>
                <span>Nombre completo *</span>
                <input
                  value={userForm.nombre}
                  onChange={(event) =>
                    setUserForm(
                      (current) => ({
                        ...current,
                        nombre: event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label>
                <span>Correo electrónico *</span>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(event) =>
                    setUserForm(
                      (current) => ({
                        ...current,
                        email: event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label>
                <span>Rol *</span>
                <select
                  value={userForm.rol}
                  onChange={(event) =>
                    setUserForm(
                      (current) => ({
                        ...current,
                        rol: event.target.value,
                      })
                    )
                  }
                >
                  <option value="">
                    Seleccionar rol
                  </option>

                  {roles.map(
                    (role) => (
                      <option
                        key={role.id}
                        value={role.nombre}
                      >
                        {role.nombre}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                <span>Contraseña temporal *</span>
                <input
                  type="password"
                  minLength="6"
                  autoComplete="new-password"
                  value={userForm.password}
                  onChange={(event) =>
                    setUserForm(
                      (current) => ({
                        ...current,
                        password: event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label>
                <span>Repetir contraseña *</span>
                <input
                  type="password"
                  minLength="6"
                  autoComplete="new-password"
                  value={userForm.confirmPassword}
                  onChange={(event) =>
                    setUserForm(
                      (current) => ({
                        ...current,
                        confirmPassword: event.target.value,
                      })
                    )
                  }
                />
              </label>

              <div className="config-modal-info">
                <CircleAlert size={16} />
                <span>
                  La contraseña se usa solo para crear la cuenta en Firebase Authentication y no se guarda en Firestore. El usuario puede cambiarla después con “Olvidé mi contraseña”.
                </span>
              </div>
            </div>

            <footer>
              <button
                type="button"
                className="ghost"
                disabled={savingUser}
                onClick={() =>
                  setUserModalOpen(false)
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="primary"
                disabled={savingUser}
                onClick={handleCreateUser}
              >
                {savingUser
                  ? "Guardando..."
                  : "Crear usuario"}
              </button>
            </footer>
          </motion.div>
        </div>
      )}

      {roleModalOpen && (
        <div
          className="config-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !savingRole
            ) {
              setRoleModalOpen(false);
            }
          }}
        >
          <motion.div
            className="config-modal role"
            initial={{
              opacity: 0,
              scale: 0.98,
              y: 8,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
          >
            <header>
              <div>
                <span>Seguridad</span>
                <h3>
                  {editingRole
                    ? "Editar rol"
                    : "Nuevo rol"}
                </h3>
              </div>

              <button
                type="button"
                disabled={savingRole}
                onClick={() =>
                  setRoleModalOpen(false)
                }
              >
                <X size={18} />
              </button>
            </header>

            <div className="config-modal-form">
              <label>
                <span>Nombre del rol *</span>
                <input
                  value={roleForm.nombre}
                  disabled={
                    String(editingRole?.nombre || "").toLowerCase() ===
                    "administrador"
                  }
                  onChange={(event) =>
                    setRoleForm(
                      (current) => ({
                        ...current,
                        nombre: event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label>
                <span>Descripción</span>
                <input
                  value={roleForm.desc}
                  onChange={(event) =>
                    setRoleForm(
                      (current) => ({
                        ...current,
                        desc: event.target.value,
                      })
                    )
                  }
                />
              </label>

              <div className="config-permission-picker">
                <span className="config-permission-title">
                  Permisos de acceso
                </span>

                {SYSTEM_PERMISSIONS.map(
                  (permission) => {
                    const checked =
                      roleForm.permisos.includes(
                        permission
                      );

                    return (
                      <button
                        key={permission}
                        type="button"
                        className={
                          checked
                            ? "selected"
                            : ""
                        }
                        disabled={
                          String(editingRole?.nombre || "").toLowerCase() ===
                            "administrador" &&
                          permission ===
                            "Acceso total al sistema"
                        }
                        onClick={() =>
                          togglePermission(
                            permission
                          )
                        }
                      >
                        <span className="config-check">
                          {checked && (
                            <Check size={13} />
                          )}
                        </span>

                        {permission}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <footer>
              <button
                type="button"
                className="ghost"
                disabled={savingRole}
                onClick={() =>
                  setRoleModalOpen(false)
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="primary"
                disabled={savingRole}
                onClick={handleSaveRole}
              >
                {savingRole
                  ? "Guardando..."
                  : editingRole
                    ? "Guardar rol"
                    : "Crear rol"}
              </button>
            </footer>
          </motion.div>
        </div>
      )}
    </main>
  );
}
