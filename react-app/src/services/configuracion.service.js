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
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signOut,
} from "firebase/auth";

import {
  deleteApp,
  initializeApp,
} from "firebase/app";

import {
  auth,
  db,
  firebaseConfig,
} from "./firebase.js";

import {
  PERMISSIONS,
  SYSTEM_PERMISSIONS,
  normalizePermissions,
} from "../security/permissions.js";

export { SYSTEM_PERMISSIONS };

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    normalizeEmail(value)
  );
}

function isAdminRole(roleName) {
  return cleanText(roleName).toLowerCase() === "administrador";
}

async function getRoleByName(roleName) {
  const cleanRole = cleanText(roleName);

  if (!cleanRole) return null;

  const snapshot = await getDocs(
    collection(db, "roles")
  );

  const roleDocument = snapshot.docs.find(
    (snapshotDoc) =>
      cleanText(snapshotDoc.data()?.nombre).toLowerCase() ===
      cleanRole.toLowerCase()
  );

  if (!roleDocument) return null;

  return {
    id: roleDocument.id,
    ...roleDocument.data(),
    permisos: normalizePermissions(
      roleDocument.data()?.permisos
    ),
  };
}

async function getPermissionsForRole(roleName) {
  if (isAdminRole(roleName)) {
    return [PERMISSIONS.ALL];
  }

  const role = await getRoleByName(roleName);

  if (!role) {
    throw new Error("USER_ROLE_NOT_FOUND");
  }

  return normalizePermissions(role.permisos);
}

/* =========================================
   SUSCRIPCIONES
========================================= */

export function subscribeToBusinessConfig(onData, onError) {
  return onSnapshot(
    doc(db, "negocio", "configuracion"),
    (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() : {};

      onData({
        nombre: cleanText(data.nombre),
        cuit: cleanText(data.cuit || data.rfc),
        telefono: cleanText(data.telefono),
        correo: cleanText(data.correo),
        direccion: cleanText(data.direccion),
        impuesto: toNumber(data.impuesto, 21),
        presupuestoValidezDias: Math.max(
          1,
          Math.trunc(
            toNumber(data.presupuestoValidezDias, 15)
          )
        ),
        garantiaDias: Math.max(
          0,
          Math.trunc(toNumber(data.garantiaDias, 30))
        ),
        ...data,
      });
    },
    onError
  );
}

export function subscribeToSystemUsers(onData, onError) {
  return onSnapshot(
    collection(db, "usuarios"),
    (snapshot) => {
      const rows = snapshot.docs
        .map((snapshotDoc) => ({
          id: snapshotDoc.id,
          ...snapshotDoc.data(),
        }))
        .sort((a, b) =>
          cleanText(a.nombre).localeCompare(
            cleanText(b.nombre),
            "es"
          )
        );

      onData(rows);
    },
    onError
  );
}

export function subscribeToRoles(onData, onError) {
  return onSnapshot(
    collection(db, "roles"),
    (snapshot) => {
      const rows = snapshot.docs
        .map((snapshotDoc) => ({
          id: snapshotDoc.id,
          ...snapshotDoc.data(),
          permisos: normalizePermissions(
            snapshotDoc.data()?.permisos
          ),
        }))
        .sort((a, b) =>
          cleanText(a.nombre).localeCompare(
            cleanText(b.nombre),
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
  const cleanName = cleanText(nombre);
  const cleanCuit = cleanText(cuit);
  const cleanEmail = normalizeEmail(correo);

  if (!cleanName) {
    throw new Error("BUSINESS_NAME_REQUIRED");
  }

  if (cleanEmail && !validateEmail(cleanEmail)) {
    throw new Error("BUSINESS_EMAIL_INVALID");
  }

  const data = {
    nombre: cleanName,
    cuit: cleanCuit,
    rfc: cleanCuit,
    telefono: cleanText(telefono),
    correo: cleanEmail,
    direccion: cleanText(direccion),
    impuesto: Math.max(0, toNumber(impuesto, 21)),
    presupuestoValidezDias: Math.max(
      1,
      Math.trunc(toNumber(presupuestoValidezDias, 15))
    ),
    garantiaDias: Math.max(
      0,
      Math.trunc(toNumber(garantiaDias, 30))
    ),
    actualizadoEn: new Date().toISOString(),
    actualizadoPor: cleanText(author) || "Sistema",
  };

  await setDoc(
    doc(db, "negocio", "configuracion"),
    data,
    { merge: true }
  );

  return data;
}

/* =========================================
   USUARIOS + FIREBASE AUTHENTICATION
========================================= */

export async function createSystemUser({
  nombre,
  email,
  rol,
  password,
  author = "Sistema",
}) {
  const cleanName = cleanText(nombre);
  const cleanEmail = normalizeEmail(email);
  const cleanRole = cleanText(rol);
  const cleanPassword = String(password ?? "");

  if (!cleanName) {
    throw new Error("USER_NAME_REQUIRED");
  }

  if (!validateEmail(cleanEmail)) {
    throw new Error("USER_EMAIL_INVALID");
  }

  if (!cleanRole) {
    throw new Error("USER_ROLE_REQUIRED");
  }

  if (cleanPassword.length < 6) {
    throw new Error("USER_PASSWORD_TOO_SHORT");
  }

  const usersSnapshot = await getDocs(
    collection(db, "usuarios")
  );

  const duplicate = usersSnapshot.docs.find(
    (snapshotDoc) =>
      normalizeEmail(snapshotDoc.data()?.email) ===
      cleanEmail
  );

  if (duplicate) {
    const error = new Error("USER_EMAIL_EXISTS");
    error.userId = duplicate.id;
    throw error;
  }

  const permissions = await getPermissionsForRole(
    cleanRole
  );

  const provisioningName =
    `provisioning-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

  const secondaryApp = initializeApp(
    firebaseConfig,
    provisioningName
  );

  const secondaryAuth = getAuth(secondaryApp);
  let createdAuthUser = null;

  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      cleanEmail,
      cleanPassword
    );

    createdAuthUser = credential.user;

    const nowISO = new Date().toISOString();

    const profile = {
      id: createdAuthUser.uid,
      uid: createdAuthUser.uid,
      authUid: createdAuthUser.uid,
      nombre: cleanName,
      email: cleanEmail,
      rol: cleanRole,
      permisos: permissions,
      activo: true,
      authPendiente: false,
      creadoEn: nowISO,
      actualizadoEn: nowISO,
      usuario: cleanText(author) || "Sistema",
    };

    try {
      await setDoc(
        doc(db, "usuarios", createdAuthUser.uid),
        profile
      );
    } catch (firestoreError) {
      try {
        await deleteUser(createdAuthUser);
      } catch (rollbackError) {
        console.error(
          "No se pudo revertir la cuenta Authentication:",
          rollbackError
        );
      }

      throw firestoreError;
    }

    return profile;
  } catch (error) {
    if (error?.code === "auth/email-already-in-use") {
      throw new Error("USER_AUTH_EMAIL_EXISTS");
    }

    if (error?.code === "auth/weak-password") {
      throw new Error("USER_PASSWORD_TOO_SHORT");
    }

    if (error?.code === "auth/invalid-email") {
      throw new Error("USER_EMAIL_INVALID");
    }

    throw error;
  } finally {
    try {
      await signOut(secondaryAuth);
    } catch {
      // La cuenta puede haberse eliminado durante rollback.
    }

    try {
      await deleteApp(secondaryApp);
    } catch (error) {
      console.warn(
        "No se pudo cerrar la app secundaria de Firebase:",
        error
      );
    }
  }
}

export async function toggleSystemUser(
  user,
  author = "Sistema"
) {
  if (!user?.id) {
    throw new Error("USER_ID_REQUIRED");
  }

  const nextState = !Boolean(user.activo);
  const currentAuthUser = auth.currentUser;

  const isCurrentUser = Boolean(
    currentAuthUser &&
      (
        user.id === currentAuthUser.uid ||
        (
          currentAuthUser.email &&
          normalizeEmail(user.email) ===
            normalizeEmail(currentAuthUser.email)
        )
      )
  );

  if (!nextState && isCurrentUser) {
    throw new Error("USER_SELF_DEACTIVATE");
  }

  await updateDoc(
    doc(db, "usuarios", user.id),
    {
      activo: nextState,
      actualizadoEn: new Date().toISOString(),
      actualizadoPor: cleanText(author) || "Sistema",
    }
  );

  return nextState;
}

export async function updateSystemUserRole(
  userId,
  roleName,
  author = "Sistema"
) {
  const id = cleanText(userId);
  const role = cleanText(roleName);

  if (!id) {
    throw new Error("USER_ID_REQUIRED");
  }

  if (!role) {
    throw new Error("USER_ROLE_REQUIRED");
  }

  const userRef = doc(db, "usuarios", id);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {
    throw new Error("USER_NOT_FOUND");
  }

  const permissions = await getPermissionsForRole(role);

  const currentAuthUser = auth.currentUser;
  const targetUser = {
    id: userSnapshot.id,
    ...userSnapshot.data(),
  };

  const isCurrentUser = Boolean(
    currentAuthUser &&
      (
        targetUser.id === currentAuthUser.uid ||
        (
          currentAuthUser.email &&
          normalizeEmail(targetUser.email) ===
            normalizeEmail(currentAuthUser.email)
        )
      )
  );

  if (
    isCurrentUser &&
    isAdminRole(targetUser.rol) &&
    !isAdminRole(role)
  ) {
    throw new Error("USER_SELF_ROLE_CHANGE");
  }

  await updateDoc(userRef, {
    rol: role,
    permisos: permissions,
    actualizadoEn: new Date().toISOString(),
    actualizadoPor: cleanText(author) || "Sistema",
  });

  return role;
}

/*
 * Compatibilidad temporal con perfiles antiguos.
 * Los perfiles nuevos ya se crean vinculados por UID.
 */
export async function markSystemUserAuthReady(
  userId,
  author = "Sistema"
) {
  const id = cleanText(userId);

  if (!id) {
    throw new Error("USER_ID_REQUIRED");
  }

  const snapshot = await getDoc(
    doc(db, "usuarios", id)
  );

  if (!snapshot.exists()) {
    throw new Error("USER_NOT_FOUND");
  }

  if (!snapshot.data()?.uid && !snapshot.data()?.authUid) {
    throw new Error("USER_AUTH_UID_REQUIRED");
  }

  await updateDoc(
    doc(db, "usuarios", id),
    {
      authPendiente: false,
      actualizadoEn: new Date().toISOString(),
      actualizadoPor: cleanText(author) || "Sistema",
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
  const cleanName = cleanText(nombre);
  let normalizedPermissions = normalizePermissions(
    permisos
  );

  if (!cleanName) {
    throw new Error("ROLE_NAME_REQUIRED");
  }

  if (isAdminRole(cleanName)) {
    normalizedPermissions = [PERMISSIONS.ALL];
  }

  if (!normalizedPermissions.length) {
    throw new Error("ROLE_PERMISSION_REQUIRED");
  }

  const rolesSnapshot = await getDocs(
    collection(db, "roles")
  );

  const duplicate = rolesSnapshot.docs.find(
    (snapshotDoc) =>
      cleanText(snapshotDoc.data()?.nombre).toLowerCase() ===
      cleanName.toLowerCase()
  );

  if (duplicate) {
    throw new Error("ROLE_NAME_EXISTS");
  }

  const roleRef = doc(collection(db, "roles"));
  const nowISO = new Date().toISOString();

  const role = {
    id: roleRef.id,
    nombre: cleanName,
    desc: cleanText(desc),
    permisos: normalizedPermissions,
    creadoEn: nowISO,
    actualizadoEn: nowISO,
    usuario: cleanText(author) || "Sistema",
  };

  await setDoc(roleRef, role);
  return role;
}

export async function updateRole(
  roleId,
  {
    nombre,
    desc = "",
    permisos = [],
    author = "Sistema",
  }
) {
  const id = cleanText(roleId);
  const cleanName = cleanText(nombre);
  let normalizedPermissions = normalizePermissions(
    permisos
  );

  if (!id) {
    throw new Error("ROLE_ID_REQUIRED");
  }

  if (!cleanName) {
    throw new Error("ROLE_NAME_REQUIRED");
  }

  const [roleSnapshot, rolesSnapshot, usersSnapshot] =
    await Promise.all([
      getDoc(doc(db, "roles", id)),
      getDocs(collection(db, "roles")),
      getDocs(collection(db, "usuarios")),
    ]);

  if (!roleSnapshot.exists()) {
    throw new Error("ROLE_NOT_FOUND");
  }

  const previousRole = {
    id: roleSnapshot.id,
    ...roleSnapshot.data(),
  };

  const previousName = cleanText(previousRole.nombre);
  const isAdministrator = isAdminRole(previousName);

  if (
    isAdministrator &&
    !isAdminRole(cleanName)
  ) {
    throw new Error("ROLE_ADMIN_RENAME_PROTECTED");
  }

  if (isAdministrator) {
    normalizedPermissions = [PERMISSIONS.ALL];
  }

  if (!normalizedPermissions.length) {
    throw new Error("ROLE_PERMISSION_REQUIRED");
  }

  const duplicate = rolesSnapshot.docs.find(
    (snapshotDoc) =>
      snapshotDoc.id !== id &&
      cleanText(snapshotDoc.data()?.nombre).toLowerCase() ===
        cleanName.toLowerCase()
  );

  if (duplicate) {
    throw new Error("ROLE_NAME_EXISTS");
  }

  const nowISO = new Date().toISOString();
  const authorName = cleanText(author) || "Sistema";

  const updates = {
    nombre: cleanName,
    desc: cleanText(desc),
    permisos: normalizedPermissions,
    actualizadoEn: nowISO,
    actualizadoPor: authorName,
  };

  const batch = writeBatch(db);

  batch.update(
    doc(db, "roles", id),
    updates
  );

  usersSnapshot.docs
    .filter(
      (snapshotDoc) =>
        cleanText(snapshotDoc.data()?.rol).toLowerCase() ===
        previousName.toLowerCase()
    )
    .forEach((snapshotDoc) => {
      batch.update(snapshotDoc.ref, {
        rol: cleanName,
        permisos: normalizedPermissions,
        actualizadoEn: nowISO,
        actualizadoPor: authorName,
      });
    });

  await batch.commit();

  return {
    ...updates,
    nombreAnterior: previousName,
  };
}

export async function deleteRole(
  role,
  author = "Sistema"
) {
  if (!role?.id) {
    throw new Error("ROLE_ID_REQUIRED");
  }

  if (isAdminRole(role.nombre)) {
    throw new Error("ROLE_ADMIN_PROTECTED");
  }

  const usersSnapshot = await getDocs(
    collection(db, "usuarios")
  );

  const assignedUsers = usersSnapshot.docs.filter(
    (snapshotDoc) =>
      cleanText(snapshotDoc.data()?.rol).toLowerCase() ===
      cleanText(role.nombre).toLowerCase()
  );

  if (assignedUsers.length) {
    const error = new Error("ROLE_IN_USE");
    error.assignedUsers = assignedUsers.length;
    throw error;
  }

  await deleteDoc(
    doc(db, "roles", role.id)
  );

  return {
    id: role.id,
    deletedBy: cleanText(author) || "Sistema",
  };
}
