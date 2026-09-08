import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "../services/firebase.js";

const AuthContext = createContext(null);

async function loadUserProfile(user) {
  if (!user?.email) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  const usersRef = collection(db, "usuarios");

  const userQuery = query(
    usersRef,
    where("email", "==", user.email),
    limit(1)
  );

  const snapshot = await getDocs(userQuery);

  if (snapshot.empty) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  const document = snapshot.docs[0];

  const profile = {
    id: document.id,
    ...document.data(),
  };

  if (profile.activo === false) {
    throw new Error("USER_INACTIVE");
  }

  return profile;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        setLoading(true);
        setAuthError(null);

        if (!firebaseUser) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        try {
          const userProfile =
            await loadUserProfile(firebaseUser);

          setUser(firebaseUser);
          setProfile(userProfile);
        } catch (error) {
          console.error(
            "Error validando perfil:",
            error
          );

          setUser(null);
          setProfile(null);

          if (error.message === "PROFILE_NOT_FOUND") {
            setAuthError(
              "Tu cuenta existe, pero no tiene un perfil habilitado en el sistema."
            );
          } else if (error.message === "USER_INACTIVE") {
            setAuthError(
              "Este usuario se encuentra desactivado."
            );
          } else {
            setAuthError(
              "No se pudo validar tu perfil de usuario."
            );
          }

          await signOut(auth);
        } finally {
          setLoading(false);
        }
      }
    );

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    setAuthError(null);

    return signInWithEmailAndPassword(
      auth,
      email,
      password
    );
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value = {
    user,
    profile,
    loading,
    authError,
    login,
    logout,
  };

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