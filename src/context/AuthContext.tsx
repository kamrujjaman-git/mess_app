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
import { getUserByUid, subscribeToMembers } from "@/lib/firestore";
import { isMemberActive, type Member } from "@/lib/mess";

type AccessDeniedReason = "inactive" | "not-member" | "removed" | null;

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
  const [currentUserDoc, setCurrentUserDoc] = useState<Member | null>(null);
  const [membersReady, setMembersReady] = useState(false);
  const [userDocReady, setUserDocReady] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";
  const normalizedAdminEmail = adminEmail.trim().toLowerCase();

  const currentMember = useMemo(() => {
    if (!user) return null;
    if (currentUserDoc) return currentUserDoc;

    const normalizedEmail = user.email?.trim().toLowerCase();
    if (!normalizedEmail) return null;

    return (
      members.find(
        (member) => member.email.trim().toLowerCase() === normalizedEmail
      ) ?? null
    );
  }, [user, members, currentUserDoc]);

  const isSuperAdmin = useMemo(() => {
    if (!user?.email || !normalizedAdminEmail) return false;
    return user.email.trim().toLowerCase() === normalizedAdminEmail;
  }, [user, normalizedAdminEmail]);

  const isAdmin = useMemo(() => {
    if (!user?.email) return false;
    const normalizedEmail = user.email.trim().toLowerCase();
    const isPrimaryAdmin = !!normalizedAdminEmail && normalizedEmail === normalizedAdminEmail;
    return isPrimaryAdmin || Boolean(currentMember?.isAdmin);
  }, [user, normalizedAdminEmail, currentMember]);

  const accessDeniedReason = useMemo<AccessDeniedReason>(() => {
    if (!user) return null;
    if (isAdmin) return null;
    if (!currentMember) return "not-member";

    if (currentMember.isBlocked || currentMember.isRemoved) {
      return "removed";
    }

    if (currentMember.status === "inactive") {
      return "inactive";
    }

    return isMemberActive(currentMember) ? null : "inactive";
  }, [user, isAdmin, currentMember]);

  const hasAccess = useMemo(() => {
    return !accessDeniedReason;
  }, [accessDeniedReason]);

  useEffect(() => {
    if (!user) {
      setAccessLoading(false);
      return;
    }
    setAccessLoading(!(membersReady && userDocReady));
  }, [membersReady, userDocReady, user]);

  useEffect(() => {
    if (!mounted) return;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (!firebaseUser) {
        setCurrentUserDoc(null);
        setMembers([]);
        setMembersReady(false);
        setUserDocReady(false);
        setAccessLoading(false);
      }
    });
    return unsubscribe;
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !user) {
      setMembers([]);
      setCurrentUserDoc(null);
      setMembersReady(false);
      setUserDocReady(false);
      setAccessLoading(false);
      return;
    }

    setAccessLoading(true);
    setCurrentUserDoc(null);
    setMembersReady(false);
    setUserDocReady(false);

    const unsubscribe = subscribeToMembers((fetchedMembers) => {
      setMembers(fetchedMembers);
      setMembersReady(true);
    });

    getUserByUid(user.uid)
      .then(async (memberDoc) => {
        if (memberDoc) {
          setCurrentUserDoc(memberDoc);
        } else if (user.email) {
          // Fallback: try finding a users doc by email (in case member id is not uid)
          try {
            const byEmail = await (await import('@/lib/firestore')).getUserByEmail(user.email.trim().toLowerCase());
            if (byEmail) setCurrentUserDoc(byEmail);
          } catch (err) {
            console.error('Failed to lookup user by email fallback:', err);
          }
        }
      })
      .catch((error) => {
        console.error("Failed to load user record by UID:", error);
      })
      .finally(() => {
        setUserDocReady(true);
      });

    return unsubscribe;
  }, [mounted, user]);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setLoading(false);
    setAccessLoading(false);
    setMembers([]);
    setCurrentUserDoc(null);
    setMembersReady(false);
    setUserDocReady(false);

    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    }
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
