"use client";
import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { getUser } from "@/utils/tokenUtils";

const VERIFICATION_REQUIRED_PATHS = [
  "/dashboard",
];

const AUTH_PAGES = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
];

export default function GlobalVerificationCheck() {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const lastPathname = useRef(pathname);
  const hasRedirected = useRef(false);

  // Reset redirect flag when pathname changes
  useEffect(() => {
    if (lastPathname.current !== pathname) {
      hasRedirected.current = false;
      lastPathname.current = pathname;
    }
  }, [pathname]);

  // Immediate check on pathname change - check localStorage directly
  useEffect(() => {
    const isProtectedPath = VERIFICATION_REQUIRED_PATHS.some(path => pathname.startsWith(path));
    
    if (isProtectedPath && !hasRedirected.current) {
      // Check localStorage directly for immediate redirect
      const userData = getUser();
      
      if (!userData) {
        // No user in localStorage - redirect to login immediately
        hasRedirected.current = true;
        const currentPath = pathname;
        window.location.href = `/auth/login?redirect=${encodeURIComponent(currentPath)}`;
        return;
      } else if (userData.role !== 'admin') {
        // User exists but not admin - redirect to home
        hasRedirected.current = true;
        window.location.href = '/';
        return;
      }
    }
  }, [pathname]);

  useEffect(() => {
    // Don't run checks if already redirected
    if (hasRedirected.current) {
      return;
    }

    // Only protect dashboard routes - require admin login
    // All other pages (cart, checkout, products, etc.) are completely public
    const isProtectedPath = VERIFICATION_REQUIRED_PATHS.some(path => pathname.startsWith(path));
    
    // Double-check with hook data (after loading completes)
    if (!loading && !user && isProtectedPath) {
      hasRedirected.current = true;
      const currentPath = pathname;
      window.location.href = `/auth/login?redirect=${encodeURIComponent(currentPath)}`;
      return;
    }
    
    // If user is loaded and logged in but not admin, and trying to access dashboard, redirect to home
    if (!loading && user && user.role !== 'admin' && isProtectedPath) {
      hasRedirected.current = true;
      window.location.href = '/';
      return;
    }

    // If user is logged in but not verified, redirect to verification page
    if (user && !user.isVerified) {
      // But allow them to stay on verification-related pages
      if (!pathname.startsWith("/auth/verify")) {
        hasRedirected.current = true;
        router.replace(`/auth/verify-email?email=${encodeURIComponent(user.email)}`);
      }
      return;
    }

    // If user is verified and on auth pages, redirect away
    const isOnAuthPage = AUTH_PAGES.some(authPath => pathname.startsWith(authPath));
    if (user && user.isVerified && isOnAuthPage) {
      hasRedirected.current = true;
      
      // Check if there's a redirect URL in the query params
      const urlParams = new URLSearchParams(window.location.search);
      const redirectTo = urlParams.get('redirect');
      
      // Use window.location.href for full page reload
      if (redirectTo && redirectTo !== pathname) {
        window.location.href = redirectTo;
        return;
      }
      
      // If admin user and no specific redirect, send to dashboard
      if (user.role === 'admin') {
        window.location.href = '/dashboard/admin';
        return;
      }
      
      // Default redirect for regular users
      window.location.href = '/';
      return;
    }

    // For all other pages (not dashboard, not auth pages), allow access
    // Anonymous users can browse freely
  }, [user, loading, pathname, router]);

  // This component doesn't render anything
  return null;
}
