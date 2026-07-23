// Client-side admin session helpers (localStorage-backed).
// The role decides UI gating; the token authorizes mutating API calls.

export type AdminRole = "manager" | "super_admin"

const AUTH_KEY = "adminAuth"
const ROLE_KEY = "adminRole"
const TOKEN_KEY = "adminToken"
const NAME_KEY = "adminName"
const LOGIN_ID_KEY = "adminLoginId"

export function setAdminSession(role: AdminRole, token: string, name = "", loginId = "") {
  if (typeof window === "undefined") return
  localStorage.setItem(AUTH_KEY, "true")
  localStorage.setItem(ROLE_KEY, role)
  localStorage.setItem(TOKEN_KEY, token || "")
  localStorage.setItem(NAME_KEY, name || "")
  localStorage.setItem(LOGIN_ID_KEY, loginId || "")
}

export function clearAdminSession() {
  if (typeof window === "undefined") return
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem(ROLE_KEY)
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(NAME_KEY)
  localStorage.removeItem(LOGIN_ID_KEY)
}

export function getAdminName(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(NAME_KEY) || ""
}

export function getAdminLoginId(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(LOGIN_ID_KEY) || ""
}

export function isAdminAuthenticated(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(AUTH_KEY) === "true"
}

export function getAdminRole(): AdminRole {
  if (typeof window === "undefined") return "manager"
  // Default to the least-privileged role when unknown, so a missing/legacy
  // session can never accidentally unlock write access.
  return (localStorage.getItem(ROLE_KEY) as AdminRole) || "manager"
}

export function getAdminToken(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(TOKEN_KEY) || ""
}

export function isSuperAdmin(): boolean {
  return getAdminRole() === "super_admin"
}

// fetch wrapper that attaches the privileged token so secured server routes
// (POST/PUT/DELETE) accept admin mutations. Use this for every admin-driven
// mutating request.
export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = getAdminToken()
  const headers = new Headers(init.headers)
  if (token) headers.set("Authorization", `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}
