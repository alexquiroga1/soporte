import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  browserLocalPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
  writeBatch,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../services/firebase.js";

import {
  PERMISSIONS,
  isAdministratorProfile,
  normalizePermissions,
  profileHasAnyPermission,
  profileHasPermission,
} from "../security/permissions.js";

const AuthContext = createContext(null);

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

/* =========================================
   VALIDAR PERFIL
========================================= */

function validateProfile(profile) {
  if (!profile) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  if (
    profile.activo === false ||
    profile.enabled === false
  ) {
    throw new Error("USER_INACTIVE");
  }

  return profile;
}

/* =========================================
   RESOLVER PERMISOS EFECTIVOS
========================================= */

async function resolveProfilePermissions(profile) {
  if (isAdministratorProfile(profile)) {
    return [PERMISSIONS.ALL];
  }

  const directPermissions = normalizePermissions(
    profile?.permisos
  );

  const roleName = cleanText(
    profile?.rol || profile?.role
  );

  if (!roleName) {
    return directPermissions;
  }

  try {
    const roleQuery = query(
      collection(db, "roles"),
      where("nombre", "==", roleName),
      limit(1)
    );

    const roleSnapshot = await getDocs(roleQuery);

    if (!roleSnapshot.empty) {
      return normalizePermissions(
        roleSnapshot.docs[0].data()?.permisos
      );
    }
  } catch (error) {
    console.warn(
      "No se pudieron refrescar los permisos del rol:",
      error
    );
  }

  return directPermissions;
}

/* =========================================
   PERFIL DE EJECUCIÓN
   El login nunca modifica rol/permisos.
========================================= */

async function buildRuntimeProfile(
  firebaseUser,
  sourceData,
  documentId = firebaseUser.uid
) {
  const permissions = await resolveProfilePermissions(
    sourceData
  );

  return validateProfile({
    ...sourceData,
    id: documentId,
    uid: firebaseUser.uid,
    authUid: firebaseUser.uid,
    email: normalizeEmail(
      firebaseUser.email || sourceData?.email
    ),
    activo: sourceData?.activo !== false,
    permisos: permissions,
  });
}

/* =========================================
   BUSCAR PERFIL LEGACY DEL PROPIO USUARIO

   Esta consulta está deliberadamente limitada
   al email autenticado. Firestore NO permite
   listar el resto de usuarios durante el login.
========================================= */

async function findOwnLegacyProfile(firebaseUser) {
  const authEmail = cleanText(firebaseUser?.email);

  if (!authEmail) {
    return null;
  }

  const usersRef = collection(db, "usuarios");

  const exactQuery = query(
    usersRef,
    where("email", "==", authEmail),
    limit(2)
  );

  const exactSnapshot = await getDocs(exactQuery);

  const exactMatch = exactSnapshot.docs.find(
    (snapshotDoc) =>
      snapshotDoc.id !== firebaseUser.uid
  );

  return exactMatch || null;
}

/* =========================================
   MIGRAR PERFIL LEGACY A UID

   Se ejecuta una sola vez. Las reglas permiten
   únicamente copiar el perfil que pertenece al
   mismo email autenticado y no permiten cambiar
   rol, permisos, estado ni datos de seguridad.
========================================= */

async function migrateOwnLegacyProfile(
  firebaseUser,
  sourceDocument
) {
  const sourceData = sourceDocument.data();
  const uidRef = doc(db, "usuarios", firebaseUser.uid);
  const nowISO = new Date().toISOString();

  const migratedProfile = {
    ...sourceData,
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    authUid: firebaseUser.uid,
    email: cleanText(firebaseUser.email),
    authPendiente: false,
    migradoDesde: sourceDocument.id,
    actualizadoEn: nowISO,
    actualizadoPor: "Migración automática UID",
  };

  const batch = writeBatch(db);

  batch.set(uidRef, migratedProfile);
  batch.delete(sourceDocument.ref);

  await batch.commit();

  return buildRuntimeProfile(
    firebaseUser,
    migratedProfile,
    firebaseUser.uid
  );
}

/* =========================================
   CARGAR PERFIL
========================================= */

async function loadUserProfile(firebaseUser) {
  if (!firebaseUser) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  const uidRef = doc(
    db,
    "usuarios",
    firebaseUser.uid
  );

  const uidSnapshot = await getDoc(uidRef);

  if (uidSnapshot.exists()) {
    return buildRuntimeProfile(
      firebaseUser,
      uidSnapshot.data(),
      uidSnapshot.id
    );
  }

  if (!firebaseUser.email) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  try {
    const legacyDocument =
      await findOwnLegacyProfile(firebaseUser);

    if (!legacyDocument) {
      throw new Error("PROFILE_NOT_FOUND");
    }

    return migrateOwnLegacyProfile(
      firebaseUser,
      legacyDocument
    );
  } catch (error) {
    if (
      error?.message === "PROFILE_NOT_FOUND" ||
      error?.message === "USER_INACTIVE"
    ) {
      throw error;
    }

    if (error?.code === "permission-denied") {
      const migrationError = new Error(
        "LEGACY_PROFILE_MIGRATION_BLOCKED"
      );
      migrationError.cause = error;
      throw migrationError;
    }

    throw error;
  }
}

/* =========================================
   MENSAJES DE PERFIL
========================================= */

function getProfileErrorMessage(error) {
  switch (error?.message) {
    case "PROFILE_NOT_FOUND":
      return (
        "La cuenta existe en Firebase Authentication, " +
        "pero no tiene un perfil habilitado en usuarios."
      );

    case "USER_INACTIVE":
      return "Este usuario se encuentra desactivado.";

    case "LEGACY_PROFILE_MIGRATION_BLOCKED":
      return (
        "Tu cuenta es de una versión anterior y no pudo " +
        "vincularse automáticamente al UID. Un administrador " +
        "debe revisar el perfil legacy antes de volver a ingresar."
      );

    default:
      return "No se pudo validar el perfil del usuario.";
  }
}

/* =========================================
   AUTH PROVIDER
========================================= */

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  /* =======================================
     OBSERVAR AUTHENTICATION
  ======================================= */

  useEffect(() => {
    let disposed = false;
    let unsubscribe = () => {};

    const observeSession = async () => {
      /*
       * Hacemos explícita la persistencia local antes de
       * resolver la primera ruta. Así un F5 no manda al
       * usuario a /login mientras Firebase restaura sesión.
       */
      try {
        await setPersistence(
          auth,
          browserLocalPersistence
        );
      } catch (error) {
        console.warn(
          "No se pudo fijar persistencia local de Authentication:",
          error
        );
      }

      if (disposed) {
        return;
      }

      unsubscribe = onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          setLoading(true);

          if (!firebaseUser) {
            setUser(null);
            setProfile(null);
            setLoading(false);
            return;
          }

          try {
            const userProfile = await loadUserProfile(
              firebaseUser
            );

            if (disposed) {
              return;
            }

            setUser(firebaseUser);
            setProfile(userProfile);
            setAuthError(null);
          } catch (error) {
            console.error(
              "Error validando perfil:",
              error
            );

            if (!disposed) {
              setUser(null);
              setProfile(null);
              setAuthError(
                getProfileErrorMessage(error)
              );
            }

            try {
              await signOut(auth);
            } catch (signOutError) {
              console.error(
                "Error cerrando sesión:",
                signOutError
              );
            }
          } finally {
            if (!disposed) {
              setLoading(false);
            }
          }
        }
      );
    };

    observeSession();

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  /* =======================================
     PERFIL EN TIEMPO REAL
     Si un Admin cambia rol o desactiva a un
     usuario, la sesión se actualiza sin F5.
  ======================================= */

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    const profileRef = doc(
      db,
      "usuarios",
      user.uid
    );

    return onSnapshot(
      profileRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          setProfile(null);
          setAuthError(
            getProfileErrorMessage(
              new Error("PROFILE_NOT_FOUND")
            )
          );
          await signOut(auth);
          return;
        }

        try {
          const nextProfile = await buildRuntimeProfile(
            auth.currentUser,
            snapshot.data(),
            snapshot.id
          );

          setProfile(nextProfile);
          setAuthError(null);
        } catch (error) {
          setProfile(null);
          setAuthError(
            getProfileErrorMessage(error)
          );
          await signOut(auth);
        }
      },
      (error) => {
        console.error(
          "Error observando perfil:",
          error
        );
      }
    );
  }, [user?.uid]);

  /* =======================================
     ACCIONES AUTH
  ======================================= */

  const login = useCallback(
    async (email, password) => {
      setAuthError(null);

      return signInWithEmailAndPassword(
        auth,
        normalizeEmail(email),
        password
      );
    },
    []
  );

  const resetPassword = useCallback(
    async (email) => {
      const cleanEmail = normalizeEmail(email);

      if (!cleanEmail) {
        throw new Error("EMAIL_REQUIRED");
      }

      await sendPasswordResetEmail(
        auth,
        cleanEmail
      );
    },
    []
  );

  const logout = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
  }, []);

  /* =======================================
     AUTORIZACIÓN
  ======================================= */

  const hasPermission = useCallback(
    (permission) =>
      profileHasPermission(
        profile,
        permission
      ),
    [profile]
  );

  const hasAnyPermission = useCallback(
    (permissions = []) =>
      profileHasAnyPermission(
        profile,
        permissions
      ),
    [profile]
  );

  const isAdmin = useMemo(
    () => isAdministratorProfile(profile),
    [profile]
  );

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      authError,
      isAdmin,
      login,
      logout,
      resetPassword,
      hasPermission,
      hasAnyPermission,
    }),
    [
      user,
      profile,
      loading,
      authError,
      isAdmin,
      login,
      logout,
      resetPassword,
      hasPermission,
      hasAnyPermission,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth debe utilizarse dentro de AuthProvider"
    );
  }

  return context;
}
