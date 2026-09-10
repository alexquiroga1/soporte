import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import {
  auth,
  db,
} from "./firebase.js";

export const SYSTEM_PERMISSIONS = [
  "Acceso total al sistema",
  "Gestionar usuarios y roles",
  "Ver reportes financieros",
  "Editar catálogo de productos",
  "Aprobar créditos y descuentos",
  "Ver y actualizar tickets asignados",
  "Registrar ventas y cobros",
  "Abrir y cerrar corte de caja",
];

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    normalizeEmail(value)
  );
}

/* =========================================
   SUSCRIPCIONES
========================================= */

export function subscribeToBusinessConfig(
  onData,
  onError
) {
  return onSnapshot(
    doc(
      db,
      "negocio",
      "configuracion"
    ),

    (snapshot) => {
      const data =
        snapshot.exists()
          ? snapshot.data()
          : {};

      onData({
        nombre:
          cleanText(
            data.nombre
          ),

        cuit:
          cleanText(
            data.cuit ||
              data.rfc
          ),

        telefono:
          cleanText(
            data.telefono
          ),

        correo:
          cleanText(
            data.correo
          ),

        direccion:
          cleanText(
            data.direccion
          ),

        impuesto:
          toNumber(
            data.impuesto,
            21
          ),

        presupuestoValidezDias:
          Math.max(
            1,
            Math.trunc(
              toNumber(
                data.presupuestoValidezDias,
                15
              )
            )
          ),

        garantiaDias:
          Math.max(
            0,
            Math.trunc(
              toNumber(
                data.garantiaDias,
                30
              )
            )
          ),

        ...data,
      });
    },

    onError
  );
}

export function subscribeToSystemUsers(
  onData,
  onError
) {
  return onSnapshot(
    collection(
      db,
      "usuarios"
    ),

    (snapshot) => {
      const rows =
        snapshot.docs.map(
          (snapshotDoc) => ({
            id:
              snapshotDoc.id,

            ...snapshotDoc.data(),
          })
        );

      rows.sort(
        (a, b) =>
          cleanText(
            a.nombre
          ).localeCompare(
            cleanText(
              b.nombre
            ),
            "es"
          )
      );

      onData(rows);
    },

    onError
  );
}

export function subscribeToRoles(
  onData,
  onError
) {
  return onSnapshot(
    collection(
      db,
      "roles"
    ),

    (snapshot) => {
      const rows =
        snapshot.docs.map(
          (snapshotDoc) => ({
            id:
              snapshotDoc.id,

            ...snapshotDoc.data(),

            permisos:
              Array.isArray(
                snapshotDoc.data()
                  ?.permisos
              )
                ? snapshotDoc.data()
                    .permisos
                : [],
          })
        );

      rows.sort(
        (a, b) =>
          cleanText(
            a.nombre
          ).localeCompare(
            cleanText(
              b.nombre
            ),
            "es"
          )
      );

      onData(rows);
    },

    onError
  );
}

/* =========================================
   NEGOCIO
========================================= */

export async function saveBusinessConfig({
  nombre,
  cuit = "",
  telefono = "",
  correo = "",
  direccion = "",
  impuesto = 21,
  presupuestoValidezDias = 15,
  garantiaDias = 30,
  author = "Sistema",
}) {
  const cleanName =
    cleanText(nombre);

  const cleanCuit =
    cleanText(cuit);

  const cleanEmail =
    normalizeEmail(correo);

  if (!cleanName) {
    throw new Error(
      "BUSINESS_NAME_REQUIRED"
    );
  }

  if (
    cleanEmail &&
    !validateEmail(
      cleanEmail
    )
  ) {
    throw new Error(
      "BUSINESS_EMAIL_INVALID"
    );
  }

  const numericTax =
    Math.max(
      0,
      toNumber(
        impuesto,
        21
      )
    );

  const budgetDays =
    Math.max(
      1,
      Math.trunc(
        toNumber(
          presupuestoValidezDias,
          15
        )
      )
    );

  const warrantyDays =
    Math.max(
      0,
      Math.trunc(
        toNumber(
          garantiaDias,
          30
        )
      )
    );

  const nowISO =
    new Date()
      .toISOString();

  const data = {
    nombre:
      cleanName,

    /*
     * Argentina:
     * cuit es el campo actual.
     * rfc se conserva por compatibilidad
     * con documentos anteriores.
     */
    cuit:
      cleanCuit,

    rfc:
      cleanCuit,

    telefono:
      cleanText(
        telefono
      ),

    correo:
      cleanEmail,

    direccion:
      cleanText(
        direccion
      ),

    impuesto:
      numericTax,

    presupuestoValidezDias:
      budgetDays,

    garantiaDias:
      warrantyDays,

    actualizadoEn:
      nowISO,

    actualizadoPor:
      cleanText(
        author
      ) ||
      "Sistema",
  };

  await setDoc(
    doc(
      db,
      "negocio",
      "configuracion"
    ),

    data,

    {
      merge: true,
    }
  );

  return data;
}

/* =========================================
   USUARIOS / PERFILES LOCALES
========================================= */

export async function createSystemUser({
  nombre,
  email,
  rol,
  author = "Sistema",
}) {
  const cleanName =
    cleanText(nombre);

  const cleanEmail =
    normalizeEmail(email);

  const cleanRole =
    cleanText(rol);

  if (!cleanName) {
    throw new Error(
      "USER_NAME_REQUIRED"
    );
  }

  if (
    !validateEmail(
      cleanEmail
    )
  ) {
    throw new Error(
      "USER_EMAIL_INVALID"
    );
  }

  if (!cleanRole) {
    throw new Error(
      "USER_ROLE_REQUIRED"
    );
  }

  const [
    usersSnapshot,
    rolesSnapshot,
  ] =
    await Promise.all([
      getDocs(
        collection(
          db,
          "usuarios"
        )
      ),

      getDocs(
        collection(
          db,
          "roles"
        )
      ),
    ]);

  const duplicate =
    usersSnapshot.docs.find(
      (snapshotDoc) =>
        normalizeEmail(
          snapshotDoc.data()
            ?.email
        ) === cleanEmail
    );

  if (duplicate) {
    const error =
      new Error(
        "USER_EMAIL_EXISTS"
      );

    error.userId =
      duplicate.id;

    throw error;
  }

  const roleExists =
    rolesSnapshot.docs.some(
      (snapshotDoc) =>
        cleanText(
          snapshotDoc.data()
            ?.nombre
        ) === cleanRole
    );

  if (
    !roleExists &&
    cleanRole !==
      "Administrador"
  ) {
    throw new Error(
      "USER_ROLE_NOT_FOUND"
    );
  }

  const userRef =
    doc(
      collection(
        db,
        "usuarios"
      )
    );

  const nowISO =
    new Date()
      .toISOString();

  const profile = {
    id:
      userRef.id,

    nombre:
      cleanName,

    email:
      cleanEmail,

    rol:
      cleanRole,

    activo:
      true,

    /*
     * Este documento es el perfil
     * interno de la aplicación.
     *
     * NO crea una cuenta
     * de Firebase Authentication.
     */
    authPendiente:
      true,

    creadoEn:
      nowISO,

    actualizadoEn:
      nowISO,

    usuario:
      cleanText(
        author
      ) ||
      "Sistema",
  };

  await setDoc(
    userRef,
    profile
  );

  return profile;
}

/* =========================================
   ACTIVAR / DESACTIVAR USUARIO
========================================= */

export async function toggleSystemUser(
  user,
  author = "Sistema"
) {
  if (!user?.id) {
    throw new Error(
      "USER_ID_REQUIRED"
    );
  }

  const nextState =
    !Boolean(
      user.activo
    );

  /*
   * Evitamos que el usuario autenticado
   * se desactive a sí mismo por accidente.
   */
  const currentAuthUser =
    auth.currentUser;

  const isCurrentUser =
    Boolean(
      currentAuthUser &&
      (
        user.id ===
          currentAuthUser.uid ||
        (
          currentAuthUser.email &&
          normalizeEmail(
            user.email
          ) ===
            normalizeEmail(
              currentAuthUser.email
            )
        )
      )
    );

  if (
    !nextState &&
    isCurrentUser
  ) {
    throw new Error(
      "USER_SELF_DEACTIVATE"
    );
  }

  await updateDoc(
    doc(
      db,
      "usuarios",
      user.id
    ),

    {
      activo:
        nextState,

      actualizadoEn:
        new Date()
          .toISOString(),

      actualizadoPor:
        cleanText(
          author
        ) ||
        "Sistema",
    }
  );

  return nextState;
}

/* =========================================
   CAMBIAR ROL DE USUARIO
========================================= */

export async function updateSystemUserRole(
  userId,
  roleName,
  author = "Sistema"
) {
  const id =
    cleanText(userId);

  const role =
    cleanText(roleName);

  if (!id) {
    throw new Error(
      "USER_ID_REQUIRED"
    );
  }

  if (!role) {
    throw new Error(
      "USER_ROLE_REQUIRED"
    );
  }

  const [
    rolesSnapshot,
    userSnapshot,
  ] =
    await Promise.all([
      getDocs(
        collection(
          db,
          "roles"
        )
      ),

      getDoc(
        doc(
          db,
          "usuarios",
          id
        )
      ),
    ]);

  if (
    !userSnapshot.exists()
  ) {
    throw new Error(
      "USER_NOT_FOUND"
    );
  }

  const roleExists =
    rolesSnapshot.docs.some(
      (snapshotDoc) =>
        cleanText(
          snapshotDoc.data()
            ?.nombre
        )
          .toLowerCase() ===
        role.toLowerCase()
    );

  if (
    !roleExists &&
    role.toLowerCase() !==
      "administrador"
  ) {
    throw new Error(
      "USER_ROLE_NOT_FOUND"
    );
  }

  const currentAuthUser =
    auth.currentUser;

  const targetUser = {
    id:
      userSnapshot.id,

    ...userSnapshot.data(),
  };

  const isCurrentUser =
    Boolean(
      currentAuthUser &&
      (
        targetUser.id ===
          currentAuthUser.uid ||
        (
          currentAuthUser.email &&
          normalizeEmail(
            targetUser.email
          ) ===
            normalizeEmail(
              currentAuthUser.email
            )
        )
      )
    );

  /*
   * No permitimos que el usuario actual
   * se quite su propio rol Administrador.
   */
  if (
    isCurrentUser &&
    cleanText(
      targetUser.rol
    )
      .toLowerCase() ===
      "administrador" &&
    role.toLowerCase() !==
      "administrador"
  ) {
    throw new Error(
      "USER_SELF_ROLE_CHANGE"
    );
  }

  await updateDoc(
    doc(
      db,
      "usuarios",
      id
    ),

    {
      rol:
        role,

      actualizadoEn:
        new Date()
          .toISOString(),

      actualizadoPor:
        cleanText(
          author
        ) ||
        "Sistema",
    }
  );

  return role;
}

/* =========================================
   MARCAR AUTH COMO VINCULADO
========================================= */

export async function markSystemUserAuthReady(
  userId,
  author = "Sistema"
) {
  const id =
    cleanText(userId);

  if (!id) {
    throw new Error(
      "USER_ID_REQUIRED"
    );
  }

  await updateDoc(
    doc(
      db,
      "usuarios",
      id
    ),

    {
      authPendiente:
        false,

      actualizadoEn:
        new Date()
          .toISOString(),

      actualizadoPor:
        cleanText(
          author
        ) ||
        "Sistema",
    }
  );

  return true;
}

/* =========================================
   ROLES
========================================= */

export async function createRole({
  nombre,
  desc = "",
  permisos = [],
  author = "Sistema",
}) {
  const cleanName =
    cleanText(nombre);

  const cleanDescription =
    cleanText(desc);

  const normalizedPermissions =
    Array.from(
      new Set(
        (
          Array.isArray(
            permisos
          )
            ? permisos
            : []
        )
          .map(cleanText)
          .filter(
            (permission) =>
              SYSTEM_PERMISSIONS.includes(
                permission
              )
          )
      )
    );

  if (!cleanName) {
    throw new Error(
      "ROLE_NAME_REQUIRED"
    );
  }

  if (
    !normalizedPermissions.length
  ) {
    throw new Error(
      "ROLE_PERMISSION_REQUIRED"
    );
  }

  const rolesSnapshot =
    await getDocs(
      collection(
        db,
        "roles"
      )
    );

  const duplicate =
    rolesSnapshot.docs.find(
      (snapshotDoc) =>
        cleanText(
          snapshotDoc.data()
            ?.nombre
        )
          .toLowerCase() ===
        cleanName
          .toLowerCase()
    );

  if (duplicate) {
    throw new Error(
      "ROLE_NAME_EXISTS"
    );
  }

  const roleRef =
    doc(
      collection(
        db,
        "roles"
      )
    );

  const nowISO =
    new Date()
      .toISOString();

  const role = {
    id:
      roleRef.id,

    nombre:
      cleanName,

    desc:
      cleanDescription,

    permisos:
      normalizedPermissions,

    creadoEn:
      nowISO,

    actualizadoEn:
      nowISO,

    usuario:
      cleanText(
        author
      ) ||
      "Sistema",
  };

  await setDoc(
    roleRef,
    role
  );

  return role;
}

/* =========================================
   EDITAR ROL
========================================= */

export async function updateRole(
  roleId,
  {
    nombre,
    desc = "",
    permisos = [],
    author = "Sistema",
  }
) {
  const id =
    cleanText(roleId);

  const cleanName =
    cleanText(nombre);

  const normalizedPermissions =
    Array.from(
      new Set(
        (
          Array.isArray(
            permisos
          )
            ? permisos
            : []
        )
          .map(cleanText)
          .filter(
            (permission) =>
              SYSTEM_PERMISSIONS.includes(
                permission
              )
          )
      )
    );

  if (!id) {
    throw new Error(
      "ROLE_ID_REQUIRED"
    );
  }

  if (!cleanName) {
    throw new Error(
      "ROLE_NAME_REQUIRED"
    );
  }

  if (
    !normalizedPermissions.length
  ) {
    throw new Error(
      "ROLE_PERMISSION_REQUIRED"
    );
  }

  const [
    roleSnapshot,
    rolesSnapshot,
    usersSnapshot,
  ] =
    await Promise.all([
      getDoc(
        doc(
          db,
          "roles",
          id
        )
      ),

      getDocs(
        collection(
          db,
          "roles"
        )
      ),

      getDocs(
        collection(
          db,
          "usuarios"
        )
      ),
    ]);

  if (
    !roleSnapshot.exists()
  ) {
    throw new Error(
      "ROLE_NOT_FOUND"
    );
  }

  const previousRole = {
    id:
      roleSnapshot.id,

    ...roleSnapshot.data(),
  };

  const previousName =
    cleanText(
      previousRole.nombre
    );

  const isAdministrator =
    previousName
      .toLowerCase() ===
    "administrador";

  if (
    isAdministrator &&
    cleanName.toLowerCase() !==
      "administrador"
  ) {
    throw new Error(
      "ROLE_ADMIN_RENAME_PROTECTED"
    );
  }

  if (
    isAdministrator &&
    !normalizedPermissions.includes(
      "Acceso total al sistema"
    )
  ) {
    throw new Error(
      "ROLE_ADMIN_PERMISSION_PROTECTED"
    );
  }

  const duplicate =
    rolesSnapshot.docs.find(
      (snapshotDoc) =>
        snapshotDoc.id !==
          id &&
        cleanText(
          snapshotDoc.data()
            ?.nombre
        )
          .toLowerCase() ===
          cleanName
            .toLowerCase()
    );

  if (duplicate) {
    throw new Error(
      "ROLE_NAME_EXISTS"
    );
  }

  const nowISO =
    new Date()
      .toISOString();

  const authorName =
    cleanText(
      author
    ) ||
    "Sistema";

  const updates = {
    nombre:
      cleanName,

    desc:
      cleanText(
        desc
      ),

    permisos:
      normalizedPermissions,

    actualizadoEn:
      nowISO,

    actualizadoPor:
      authorName,
  };

  const batch =
    writeBatch(db);

  batch.update(
    doc(
      db,
      "roles",
      id
    ),

    updates
  );

  /*
   * Si cambia el nombre de un rol normal,
   * migramos automáticamente los perfiles
   * que todavía guardan el nombre anterior.
   */
  if (
    previousName &&
    previousName.toLowerCase() !==
      cleanName.toLowerCase()
  ) {
    usersSnapshot.docs
      .filter(
        (snapshotDoc) =>
          cleanText(
            snapshotDoc.data()
              ?.rol
          )
            .toLowerCase() ===
          previousName
            .toLowerCase()
      )
      .forEach(
        (snapshotDoc) => {
          batch.update(
            snapshotDoc.ref,

            {
              rol:
                cleanName,

              actualizadoEn:
                nowISO,

              actualizadoPor:
                authorName,
            }
          );
        }
      );
  }

  await batch.commit();

  return {
    ...updates,

    nombreAnterior:
      previousName,
  };
}

/* =========================================
   ELIMINAR ROL
========================================= */

export async function deleteRole(
  role,
  author = "Sistema"
) {
  if (!role?.id) {
    throw new Error(
      "ROLE_ID_REQUIRED"
    );
  }

  /*
   * Evitamos eliminar accidentalmente
   * el rol administrador.
   */
  if (
    cleanText(
      role.nombre
    )
      .toLowerCase() ===
    "administrador"
  ) {
    throw new Error(
      "ROLE_ADMIN_PROTECTED"
    );
  }

  const usersSnapshot =
    await getDocs(
      collection(
        db,
        "usuarios"
      )
    );

  const assignedUsers =
    usersSnapshot.docs.filter(
      (snapshotDoc) =>
        cleanText(
          snapshotDoc.data()
            ?.rol
        )
          .toLowerCase() ===
        cleanText(
          role.nombre
        )
          .toLowerCase()
    );

  if (
    assignedUsers.length
  ) {
    const error =
      new Error(
        "ROLE_IN_USE"
      );

    error.assignedUsers =
      assignedUsers.length;

    throw error;
  }

  await deleteDoc(
    doc(
      db,
      "roles",
      role.id
    )
  );

  return {
    id:
      role.id,

    deletedBy:
      cleanText(
        author
      ) ||
      "Sistema",
  };
}