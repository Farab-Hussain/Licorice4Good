"use client";
import { useEffect, useState, useRef } from "react";
import {
  getToken,
  getUser,
  setUser,
  removeToken,
  removeUser,
} from "@/utils/tokenUtils";
import { identifyUser } from "./useTrackdeskEvent";

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  isVerified: boolean;
  requiresVerification?: boolean;
  // add other fields as needed
};

// Global function to clear user cache (call this after login/logout)
let userCache: { user: User | null; timestamp: number } | null = null;
export function clearUserCache() {
  userCache = null;
}

export function useUser() {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = () => {
      try {
        const token = getToken();
        if (!token) {
          // No token = anonymous user
          setUserState(null);
          setLoading(false);
          return;
        }

        // Get user from localStorage
        const userData = getUser();
        if (userData) {
          setUserState(userData as User);

          // Identify user in Trackdesk when user data is loaded
          if (typeof window !== "undefined" && window.Trackdesk) {
            identifyUser(userData.id, {
              email: userData.email,
              name:
                userData.name ||
                `${(userData as any).firstName || ""} ${
                  (userData as any).lastName || ""
                }`.trim(),
              role: userData.role,
              isVerified: userData.isVerified,
            });
          }
        } else {
          // Token exists but no user data - clear token
          removeToken();
          setUserState(null);
        }
        setLoading(false);
      } catch (err) {
        console.error("Error loading user:", err);
        setUserState(null);
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const refreshUser = () => {
    // Refresh user from localStorage
    const userData = getUser();
    setUserState(userData as User | null);
  };

  const clearUser = () => {
    setUserState(null);
    setError(null);
    removeToken();
    removeUser();
    userCache = null;
  };

  return { user, loading, error, refreshUser, clearUser };
}
