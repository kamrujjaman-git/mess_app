"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { subscribeToMembers } from "@/lib/firestore";
import { isMemberActive, type Member } from "@/lib/mess";
import toast from "react-hot-toast";

type AccessDeniedReason = "inactive" | "not-member" | "removed" | null;

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  sessionLoading: boolean;
  sessionError: string | null;
  accessLoading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  canDeleteNotifications: boolean;
  hasAccess: boolean;
  accessDeniedReason: AccessDeniedReason;
  members: Member[];
  userProfilePhotoURL: string | null;
  profileVersion: number;
  signInWithGoogle: () => Promise<void>;
  retrySessionSync: () => void;
  refreshUserProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function postSessionToken(idToken: string, signal: AbortSignal): Promise<boolean> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    cache: "no-store",
    signal,
  });

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error("The secure session service returned an invalid response.");
  }
  if (!response.ok) {
    throw new Error(
      isRecord(result) && typeof result.error === "string"
        ? result.error
        : "Could not establish a secure session."
    );
  }

  return isRecord(result) && result.claimsChanged === true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionRetryCount, setSessionRetryCount] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersReady, setMembersReady] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    uid: string;
    photoURL: string | null;
  } | null>(null);
  const [profileVersion, setProfileVersion] = useState(0);
  const sessionSyncRef = useRef<{
    controller: AbortController;
    promise: Promise<void>;
  } | null>(null);

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
      if (!firebaseUser) {
        setMembers([]);
        setSessionLoading(false);
        setSessionError(null);
      } else {
        setSessionLoading(true);
        setSessionError(null);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const controller = new AbortController();
    const syncPromise = (async () => {
      try {
        let claimsChanged = await postSessionToken(
          await user.getIdToken(),
          controller.signal
        );
        if (claimsChanged) {
          claimsChanged = await postSessionToken(
            await user.getIdToken(true),
            controller.signal
          );
        }
        if (!controller.signal.aborted) {
          setSessionError(null);
          setSessionLoading(false);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to establish the server session.");
        setSessionError(
          error instanceof Error
            ? error.message
            : "Could not establish a secure session. Please retry."
        );
        setSessionLoading(false);
        toast.error("Could not establish a secure session. Please retry.");
      }
    })();

    sessionSyncRef.current = { controller, promise: syncPromise };
    return () => {
      controller.abort();
      if (sessionSyncRef.current?.controller === controller) {
        sessionSyncRef.current = null;
      }
    };
  }, [user, sessionRetryCount]);

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

  useEffect(() => {
    if (!user) return;

    return onSnapshot(
      doc(db, "users", user.uid),
      (snapshot) => {
        const photoURL = snapshot.data()?.photoURL;
        setUserProfile({
          uid: user.uid,
          photoURL: typeof photoURL === "string" ? photoURL : null,
        });
      },
      (error) => {
        console.error("Failed to subscribe to the signed-in user profile:", error);
        setUserProfile({ uid: user.uid, photoURL: null });
      }
    );
  }, [user]);

  const userProfilePhotoURL = userProfile && userProfile.uid === user?.uid
    ? userProfile.photoURL
    : null;

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const retrySessionSync = useCallback(() => {
    setSessionRetryCount((count) => count + 1);
    setSessionLoading(true);
    setSessionError(null);
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
    const pendingSync = sessionSyncRef.current;
    pendingSync?.controller.abort();
    await pendingSync?.promise;

    let cookieClearFailed = false;
    try {
      const response = await fetch("/api/auth/session", {
        method: "DELETE",
        cache: "no-store",
      });
      if (!response.ok) cookieClearFailed = true;
    } catch {
      cookieClearFailed = true;
      console.error("Failed to clear the server session cookie.");
    }

    let signOutError: unknown;
    try {
      await signOut(auth);
    } catch (error) {
      signOutError = error;
      console.error("Logout failed:", error);
    } finally {
      setUser(null);
      setLoading(false);
      setSessionLoading(false);
      setSessionError(null);
      setMembers([]);
      setMembersReady(false);
    }

    if (cookieClearFailed) {
      toast.error("Signed out, but the server session cookie could not be cleared.");
    }
    if (signOutError) throw signOutError;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sessionLoading,
        sessionError,
        accessLoading,
        isAdmin,
        isSuperAdmin,
        canDeleteNotifications,
        hasAccess,
        accessDeniedReason,
        members,
        userProfilePhotoURL,
        profileVersion,
        signInWithGoogle,
        retrySessionSync,
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
