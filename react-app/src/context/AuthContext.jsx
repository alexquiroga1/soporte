import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  onAuthStateChanged,
  sendPasswordResetEmail,
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
  setDoc,
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

function sameStringArray(a, b) {
  const left = [...a].sort();
  const right = [...b].sort();

  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
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
   BUSCAR PERFIL LEGACY POR EMAIL
========================================= */

async function findLegacyProfileByEmail(email) {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail) {
    return null;
  }

  const usersRef = collection(db, "usuarios");

  const emailQuery = query(
    usersRef,
    where("email", "==", cleanEmail),
    limit(1)
  );

  const snapshot = await getDocs(emailQuery);

  if (!snapshot.empty) {
    return snapshot.docs[0];
  }

  /*
   * Compatibilidad con perfiles muy antiguos
   * que hayan guardado el email con mayúsculas.
   * Esta rama solo se necesita durante la migración.
   */
  const allUsers = await getDocs(usersRef);

  return (
    allUsers.docs.find(
      (snapshotDoc) =>
        normalizeEmail(snapshotDoc.data()?.email) ===
        cleanEmail
    ) || null
  );
}

/* =========================================
   NORMALIZAR / MIGRAR PERFIL A UID
========================================= */

async function normalizeProfileForUid(
  firebaseUser,
  sourceDocument
) {
  const sourceData = sourceDocument.data();
  const permissions = await resolveProfilePermissions(
    sourceData
  );

  const normalized = {
    ...sourceData,
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    authUid: firebaseUser.uid,
    email: normalizeEmail(
      firebaseUser.email || sourceData.email
    ),
    activo: sourceData.activo !== false,
    authPendiente: false,
    permisos: permissions,
  };

  const uidRef = doc(
    db,
    "usuarios",
    firebaseUser.uid
  );

  const sourceIsUid =
    sourceDocument.id === firebaseUser.uid;

  const currentPermissions = normalizePermissions(
    sourceData?.permisos
  );

  const needsSync =
    !sourceIsUid ||
    sourceData?.uid !== firebaseUser.uid ||
    sourceData?.authUid !== firebaseUser.uid ||
    sourceData?.authPendiente === true ||
    normalizeEmail(sourceData?.email) !==
      normalized.email ||
    !sameStringArray(
      currentPermissions,
      permissions
    );

  if (!needsSync) {
    return validateProfile(normalized);
  }

  const nowISO = new Date().toISOString();

  const persisted = {
    ...normalized,
    actualizadoEn: nowISO,
    actualizadoPor:
      sourceData?.actualizadoPor ||
      "Migración UID",
  };

  if (!sourceIsUid) {
    persisted.migradoDesde = sourceDocument.id;

    const batch = writeBatch(db);

    batch.set(uidRef, persisted, {
      merge: true,
    });

    batch.delete(sourceDocument.ref);

    await batch.commit();
  } else {
    await setDoc(uidRef, persisted, {
      merge: true,
    });
  }

  return validateProfile(persisted);
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
    return normalizeProfileForUid(
      firebaseUser,
      uidSnapshot
    );
  }

  if (!firebaseUser.email) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  const legacyDocument =
    await findLegacyProfileByEmail(
      firebaseUser.email
    );

  if (!legacyDocument) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  return normalizeProfileForUid(
    firebaseUser,
    legacyDocument
  );
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
    const unsubscribe = onAuthStateChanged(
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

          setUser(firebaseUser);
          setProfile(userProfile);
          setAuthError(null);
        } catch (error) {
          console.error(
            "Error validando perfil:",
            error
          );

          setUser(null);
          setProfile(null);
          setAuthError(
            getProfileErrorMessage(error)
          );

          try {
            await signOut(auth);
          } catch (signOutError) {
            console.error(
              "Error cerrando sesión:",
              signOutError
            );
          }
        } finally {
          setLoading(false);
        }
      }
    );

    return unsubscribe;
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
          const nextProfile = validateProfile({
            id: snapshot.id,
            ...snapshot.data(),
          });

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
