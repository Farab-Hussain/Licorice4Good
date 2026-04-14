import { NextRequest, NextResponse } from "next/server";

// JWT verification is handled by the backend API
// Note: localStorage is not accessible in middleware (server-side)
// Client-side components (GlobalVerificationCheck) will handle authentication checks
// Middleware allows all requests - client-side will redirect to login if needed for dashboard routes
export async function middleware(req: NextRequest) {
  // Allow all requests - authentication is handled client-side
  // GlobalVerificationCheck component will protect dashboard routes
  // All other routes (cart, checkout, products, etc.) are completely public
  return NextResponse.next();
}

// Apply middleware to all routes except static, _next, and api
export const config = {
  matcher: ["/((?!_next|favicon.ico|api|public).*)"],
};
