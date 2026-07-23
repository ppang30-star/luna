import { NextResponse, type NextRequest } from "next/server"

// ------------------------------------------------------------------
// Server-side RBAC helpers.
//
// Two roles exist:
//   - "manager"     : read-only. Never receives the privileged token.
//   - "super_admin" : full access. Receives ADMIN_SUPER_TOKEN at login.
//
// Passwords and the privileged token are read from RUNTIME env vars so they
// work on any host (Netlify/Vercel). Sensible defaults are provided so the app
// keeps working before env vars are set, but production should override them.
// ------------------------------------------------------------------

export type AdminRole = "manager" | "super_admin"

export function getSuperAdminPassword(): string {
  return process.env.SUPER_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "admin123"
}

export function getManagerPassword(): string {
  return process.env.MANAGER_PASSWORD || "manager123"
}

// The opaque bearer token handed to a super admin on successful login. The
// client stores it and echoes it back on every mutating request. Only the
// server knows the expected value, so a manager cannot fabricate it.
export function getSuperAdminToken(): string {
  return (
    process.env.ADMIN_SUPER_TOKEN ||
    // Deterministic fallback derived from the password so it is stable across
    // requests/instances without extra configuration.
    `super:${getSuperAdminPassword()}`
  )
}

// Returns the role for a given password, or null if it matches neither.
export function resolveRole(password: string): AdminRole | null {
  if (password === getSuperAdminPassword()) return "super_admin"
  if (password === getManagerPassword()) return "manager"
  return null
}

// Reads the bearer token from the standard Authorization header or a fallback
// custom header.
function extractToken(request: NextRequest): string | null {
  const auth = request.headers.get("authorization")
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim()
  }
  return request.headers.get("x-admin-token")
}

// Returns true when the request carries a valid super-admin token.
export function isSuperAdminRequest(request: NextRequest): boolean {
  const token = extractToken(request)
  return !!token && token === getSuperAdminToken()
}

// Guard for mutating route handlers. Returns a 401 NextResponse when the caller
// is not a super admin, or null when the request is authorized to proceed.
export function requireSuperAdmin(request: NextRequest): NextResponse | null {
  if (isSuperAdminRequest(request)) return null
  return NextResponse.json(
    { error: "Unauthorized: super admin privileges are required for this action." },
    { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } },
  )
}
