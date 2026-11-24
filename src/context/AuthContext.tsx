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

type AccessDeniedReason = "inactive" | "not-member" | "removed" | null;

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  accessLoading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  canDeleteNotifications: boolean;
  hasAccess: boolean;
  accessDeniedReason: AccessDeniedReason;
  members: Member[];
  profileVersion: number;
  signInWithGoogle: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersReady, setMembersReady] = useState(false);
  const [profileVersion, setProfileVersion] = useState(0);

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";
  const normalizedAdminEmail = adminEmail.trim().toLowerCase();

  const currentMember = useMemo(() => {
    if (!user) return null;
    const normalizedEmail = user.email?.trim().toLowerCase();
    if (!normalizedEmail) return null;

    return (
      members.find(
        (member) => member.email.trim().toLowerCase() === normalizedEmail
      ) ?? null
    );
  }, [user, members]);

  const isSuperAdmin = useMemo(() => {
    if (!user?.email || !normalizedAdminEmail) return false;
    const normalizedUserEmail = user.email.trim().toLowerCase();
    return normalizedUserEmail === normalizedAdminEmail;
  }, [user, normalizedAdminEmail]);

  const canDeleteNotifications = useMemo(() => isSuperAdmin, [isSuperAdmin]);

  const isAdmin = useMemo(() => {
    if (!user?.email) return false;
    const normalizedEmail = user.email.trim().toLowerCase();
    const isPrimaryAdmin = !!normalizedAdminEmail && normalizedEmail === normalizedAdminEmail;
    return isPrimaryAdmin || (
      Boolean(currentMember?.isAdmin) &&
      isMemberActive(currentMember)
    );
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

  const accessLoading = Boolean(user && !membersReady);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      setMembersReady(false);
      if (!firebaseUser) setMembers([]);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToMembers(
      (fetchedMembers) => {
        setMembers(fetchedMembers);
        setMembersReady(true);
      },
      (error) => {
        console.error("Failed to subscribe to members:", error);
        setMembers([]);
        setMembersReady(true);
      }
    );

    return unsubscribe;
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const refreshUserProfile = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("The signed-in user is no longer available.");
    }

    await currentUser.reload();
    setProfileVersion((version) => version + 1);
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setLoading(false);
    setMembers([]);
    setMembersReady(false);

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
        canDeleteNotifications,
        hasAccess,
        accessDeniedReason,
        members,
        profileVersion,
        signInWithGoogle,
        refreshUserProfile,
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
