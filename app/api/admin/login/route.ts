import { NextResponse, type NextRequest } from "next/server"
import { getSuperAdminToken, getSuperAdminPassword } from "@/lib/admin-auth"
import { createAdminServerClient } from "@/lib/supabase/admin-server"

// Runtime-only: DB credentials + token are resolved server-side per request.
export const dynamic = "force-dynamic"
export const revalidate = 0

const NO_STORE = { "Cache-Control": "no-store, max-age=0" }

type Role = "manager" | "super_admin"

// POST /api/admin/login  Body: { loginId, password }
// Authenticates against the DB-backed `managers` table. On success returns the
// user's role, display name, and — for super admins only — the privileged token
// used to authorize mutating API calls. Managers receive an empty token so they
// can never mutate server-side, no matter what the client does.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const loginId = String(body?.loginId ?? "").trim()
    const password = String(body?.password ?? "")

    if (!loginId || !password) {
      return NextResponse.json(
        { error: "ID and password are required." },
        { status: 400, headers: NO_STORE },
      )
    }

    const supabase = createAdminServerClient()

    if (supabase) {
      const { data, error } = await supabase
        .from("managers")
        .select("id, name, login_id, role")
        .eq("login_id", loginId)
        .eq("password", password)
        .maybeSingle()

      if (!error && data) {
        const role: Role = data.role === "super_admin" ? "super_admin" : "manager"
        const token = role === "super_admin" ? getSuperAdminToken() : ""
        return NextResponse.json(
          { role, token, name: data.name, loginId: data.login_id },
          { headers: NO_STORE },
        )
      }
    }

    // Bootstrap fallback: allow a hardcoded env super admin so the owner can
    // never be locked out (e.g. DB unreachable or no accounts seeded yet).
    const bootstrapId = process.env.SUPER_ADMIN_ID || "admin"
    if (loginId === bootstrapId && password === getSuperAdminPassword()) {
      return NextResponse.json(
        { role: "super_admin", token: getSuperAdminToken(), name: "Super Admin", loginId },
        { headers: NO_STORE },
      )
    }

    return NextResponse.json(
      { error: "Invalid ID or password." },
      { status: 401, headers: NO_STORE },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE })
  }
}
