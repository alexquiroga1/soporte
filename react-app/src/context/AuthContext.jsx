import {
  createContext,
  useContext,
  useEffect,
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
  query,
  where,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../services/firebase.js";

const AuthContext = createContext(null);

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
   CARGAR PERFIL
========================================= */

async function loadUserProfile(firebaseUser) {
  if (!firebaseUser) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  /* Primero buscamos por UID */

  const userDocumentRef = doc(
    db,
    "usuarios",
    firebaseUser.uid
  );

  const userDocument = await getDoc(
    userDocumentRef
  );

  if (userDocument.exists()) {
    return validateProfile({
      id: userDocument.id,
      ...userDocument.data(),
    });
  }

  /* Si no existe por UID, buscamos por email */

  if (!firebaseUser.email) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  const usersRef = collection(
    db,
    "usuarios"
  );

  const emailQuery = query(
    usersRef,
    where(
      "email",
      "==",
      firebaseUser.email
    ),
    limit(1)
  );

  const snapshot = await getDocs(
    emailQuery
  );

  if (snapshot.empty) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  const profileDocument =
    snapshot.docs[0];

  return validateProfile({
    id: profileDocument.id,
    ...profileDocument.data(),
  });
}

/* =========================================
   MENSAJES DE PERFIL
========================================= */

function getProfileErrorMessage(error) {
  switch (error?.message) {
    case "PROFILE_NOT_FOUND":
      return (
        "La cuenta existe en Firebase, " +
        "pero no tiene un perfil habilitado " +
        "en la colección usuarios."
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

export function AuthProvider({
  children,
}) {
  const [user, setUser] =
    useState(null);

  const [profile, setProfile] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [authError, setAuthError] =
    useState(null);

  /* =======================================
     OBSERVAR SESIÓN
  ======================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
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
            const userProfile =
              await loadUserProfile(
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
              getProfileErrorMessage(
                error
              )
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

    return () => {
      unsubscribe();
    };
  }, []);

  /* =======================================
     LOGIN
  ======================================= */

  const login = async (
    email,
    password
  ) => {
    setAuthError(null);

    return signInWithEmailAndPassword(
      auth,
      email,
      password
    );
  };

  /* =======================================
     RECUPERAR CONTRASEÑA
  ======================================= */

  const resetPassword = async (
    email
  ) => {
    const cleanEmail =
      email?.trim();

    if (!cleanEmail) {
      throw new Error(
        "EMAIL_REQUIRED"
      );
    }

    await sendPasswordResetEmail(
      auth,
      cleanEmail
    );
  };

  /* =======================================
     LOGOUT
  ======================================= */

  const logout = async () => {
    setAuthError(null);

    await signOut(auth);
  };

  const value = {
    user,
    profile,
    loading,
    authError,

    login,
    logout,
    resetPassword,
  };

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* =========================================
   HOOK
========================================= */

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth debe utilizarse dentro de AuthProvider"
    );
  }

  return context;
}