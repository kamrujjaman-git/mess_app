"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { subscribeToMembers } from "@/lib/firestore";
import { userHasMessAccess, type Member } from "@/lib/mess";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  accessLoading: boolean;
  isAdmin: boolean;
  hasAccess: boolean;
  members: Member[];
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

  const isAdmin = !!user && user.email?.toLowerCase() === adminEmail.toLowerCase();

  const hasAccess = useMemo(() => {
    if (!user) return false;
    return userHasMessAccess(user.email, adminEmail, members);
  }, [user, adminEmail, members]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (!firebaseUser) {
        setAccessLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setMembers([]);
      return;
    }

    setAccessLoading(true);
    const unsubscribe = subscribeToMembers((fetchedMembers) => {
      setMembers(fetchedMembers);
      setAccessLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        accessLoading,
        isAdmin,
        hasAccess,
        members,
        signInWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
