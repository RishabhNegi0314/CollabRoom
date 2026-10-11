import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, googleProvider, signInWithPopup, signOut } from "../lib/firebase.ts";

export interface CollabUserProfile {
  uid: string;
  name: string;
  email: string | null;
  photoURL: string;
  isGuest: boolean;
}

export interface GoogleAccount {
  email: string;
  name: string;
  photoURL?: string;
  isPrimary?: boolean;
}

const DEFAULT_GOOGLE_ACCOUNTS: GoogleAccount[] = [
  {
    email: "rishabh.23bce10452@vitbhopal.ac.in",
    name: "Rishabh Negi",
    photoURL: "https://api.dicebear.com/7.x/bottts/svg?seed=rishabh.23bce10452@vitbhopal.ac.in",
    isPrimary: true
  }
];

// Memory fallback in case localStorage is blocked in sandboxed iframe
const memoryStorage = new Map<string, string>();

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // In sandboxed iframes without storage permission
    }
    return memoryStorage.get(key) || null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignore security error
    }
    memoryStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore security error
    }
    memoryStorage.delete(key);
  }
};

interface AuthContextType {
  user: CollabUserProfile | null;
  loading: boolean;
  error: string | null;
  savedGoogleAccounts: GoogleAccount[];
  loginWithGoogle: () => Promise<CollabUserProfile>;
  loginWithGoogleAccount: (account: { email: string; name?: string; photoURL?: string }) => CollabUserProfile;
  removeSavedGoogleAccount: (email: string) => void;
  loginAsGuest: (username?: string) => CollabUserProfile;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CollabUserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [savedGoogleAccounts, setSavedGoogleAccounts] = useState<GoogleAccount[]>(() => {
    try {
      const stored = safeStorage.getItem("collab_saved_google_accounts");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore parsing error
    }
    return DEFAULT_GOOGLE_ACCOUNTS;
  });

  // Save google accounts when list changes
  useEffect(() => {
    try {
      safeStorage.setItem("collab_saved_google_accounts", JSON.stringify(savedGoogleAccounts));
    } catch {
      // ignore
    }
  }, [savedGoogleAccounts]);

  const upsertGoogleAccount = (acc: GoogleAccount) => {
    setSavedGoogleAccounts(prev => {
      const filtered = prev.filter(a => a.email.toLowerCase() !== acc.email.toLowerCase());
      return [acc, ...filtered];
    });
  };

  const removeSavedGoogleAccount = (email: string) => {
    setSavedGoogleAccounts(prev => prev.filter(a => a.email.toLowerCase() !== email.toLowerCase()));
  };

  // Initialize and persist auth state listener
  useEffect(() => {
    let isMounted = true;

    // Check if guest or dev session exists in safe storage
    const savedDev = safeStorage.getItem("collab_dev_user");
    if (savedDev) {
      try {
        const parsed = JSON.parse(savedDev);
        if (isMounted) {
          setUser(parsed);
          setLoading(false);
        }
      } catch {
        safeStorage.removeItem("collab_dev_user");
      }
    }

    const savedGuest = safeStorage.getItem("collab_guest_user");
    if (savedGuest && !savedDev) {
      try {
        const parsed = JSON.parse(savedGuest);
        if (isMounted) {
          setUser(parsed);
          setLoading(false);
        }
      } catch {
        safeStorage.removeItem("collab_guest_user");
      }
    }

    // Set safety timeout to prevent infinite loading state
    const timer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 1200);

    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
        if (!isMounted) return;

        if (firebaseUser) {
          safeStorage.removeItem("collab_guest_user");
          safeStorage.removeItem("collab_dev_user");

          const photo = firebaseUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(firebaseUser.uid)}`;
          const profile: CollabUserProfile = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Google User",
            email: firebaseUser.email,
            photoURL: photo,
            isGuest: false
          };

          if (firebaseUser.email) {
            upsertGoogleAccount({
              email: firebaseUser.email,
              name: profile.name,
              photoURL: photo
            });
          }

          setUser(profile);
        } else if (!safeStorage.getItem("collab_guest_user") && !safeStorage.getItem("collab_dev_user")) {
          setUser(null);
        }
        setLoading(false);
      }, (err) => {
        console.warn("Firebase Auth state observer notice:", err);
        if (isMounted) setLoading(false);
      });
    } catch (e) {
      console.warn("Firebase onAuthStateChanged init warning:", e);
      if (isMounted) setLoading(false);
    }

    return () => {
      isMounted = false;
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const loginWithGoogle = async (): Promise<CollabUserProfile> => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      const photo = firebaseUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(firebaseUser.uid)}`;
      const profile: CollabUserProfile = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Collaborator",
        email: firebaseUser.email,
        photoURL: photo,
        isGuest: false
      };

      safeStorage.removeItem("collab_guest_user");
      safeStorage.removeItem("collab_dev_user");
      setUser(profile);

      if (firebaseUser.email) {
        upsertGoogleAccount({
          email: firebaseUser.email,
          name: profile.name,
          photoURL: photo
        });
      }

      setLoading(false);
      return profile;
    } catch (err: any) {
      setLoading(false);
      const isUnauthorizedDomain = err?.code === "auth/unauthorized-domain" ||
        err?.message?.includes("unauthorized-domain") ||
        err?.message?.includes("auth/unauthorized-domain");

      if (isUnauthorizedDomain) {
        const customErr = new Error("Firebase Auth requires manual account selection on preview domain.");
        (customErr as any).code = "auth/unauthorized-domain";
        throw customErr;
      }

      if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") {
        throw err;
      }

      setError(err.message || "Failed to sign in with Google.");
      throw err;
    }
  };

  const loginWithGoogleAccount = (account: { email: string; name?: string; photoURL?: string }): CollabUserProfile => {
    setError(null);
    const cleanEmail = account.email.trim();
    const cleanName = (account.name || "").trim() || cleanEmail.split("@")[0] || "Google User";
    const photo = account.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`;

    const profile: CollabUserProfile = {
      uid: `google-${encodeURIComponent(cleanEmail)}`,
      name: cleanName,
      email: cleanEmail,
      photoURL: photo,
      isGuest: false
    };

    upsertGoogleAccount({
      email: cleanEmail,
      name: cleanName,
      photoURL: photo
    });

    safeStorage.removeItem("collab_guest_user");
    safeStorage.setItem("collab_dev_user", JSON.stringify(profile));
    setUser(profile);
    return profile;
  };

  const loginAsGuest = (username?: string): CollabUserProfile => {
    setError(null);
    const guestName = username?.trim() || "Guest Developer";
    const guestUid = `guest-${Math.random().toString(36).substring(2, 10)}`;
    const profile: CollabUserProfile = {
      uid: guestUid,
      name: guestName,
      email: null,
      photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(guestName)}`,
      isGuest: true
    };

    safeStorage.removeItem("collab_dev_user");
    safeStorage.setItem("collab_guest_user", JSON.stringify(profile));
    setUser(profile);
    return profile;
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      safeStorage.removeItem("collab_guest_user");
      safeStorage.removeItem("collab_dev_user");
      await signOut(auth);
      setUser(null);
    } catch (err: any) {
      console.warn("Logout notice:", err);
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      savedGoogleAccounts,
      loginWithGoogle,
      loginWithGoogleAccount,
      removeSavedGoogleAccount,
      loginAsGuest,
      logout,
      clearError
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
