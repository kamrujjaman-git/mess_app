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
import { isMemberActive, type Member } from "@/lib/mess";

type AccessDeniedReason = "inactive" | "not-member" | null;

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  accessLoading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  hasAccess: boolean;
  accessDeniedReason: AccessDeniedReason;
  members: Member[];
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

  const currentMember = useMemo(() => {
    if (!user?.email) return null;
    const normalizedEmail = user.email.trim().toLowerCase();
    return (
      members.find(
        (member) => member.email.trim().toLowerCase() === normalizedEmail
      ) ?? null
    );
  }, [user, members]);

  const isSuperAdmin = useMemo(() => {
    return user?.email?.trim().toLowerCase() ===
      "md.kamrujjaman092@gmail.com";
  }, [user]);

  const isAdmin = useMemo(() => {
    if (!user?.email) return false;
    const normalizedEmail = user.email.trim().toLowerCase();
    const isPrimaryAdmin = !!adminEmail && normalizedEmail === adminEmail.trim().toLowerCase();
    return isPrimaryAdmin || Boolean(currentMember?.isAdmin);
  }, [user, adminEmail, currentMember]);

  const accessDeniedReason = useMemo<AccessDeniedReason>(() => {
    if (!user) return null;
    if (isAdmin) return null;
    if (!currentMember) return "not-member";
    return isMemberActive(currentMember) ? null : "inactive";
  }, [user, isAdmin, currentMember]);

  const hasAccess = useMemo(() => {
    return !accessDeniedReason;
  }, [accessDeniedReason]);

  useEffect(() => {
    if (!mounted) return;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (!firebaseUser) {
        setAccessLoading(false);
      }
    });
    return unsubscribe;
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !user) {
      setMembers([]);
      return;
    }

    setAccessLoading(true);
    const unsubscribe = subscribeToMembers((fetchedMembers) => {
      setMembers(fetchedMembers);
      setAccessLoading(false);
    });

    return unsubscribe;
  }, [mounted, user]);

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
        isSuperAdmin,
        hasAccess,
        accessDeniedReason,
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
