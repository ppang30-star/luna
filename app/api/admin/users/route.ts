import { NextResponse, type NextRequest } from "next/server"
import { createAdminServerClient } from "@/lib/supabase/admin-server"
import { requireSuperAdmin } from "@/lib/admin-auth"

// Runtime-only: DB credentials resolved per-request on the server.
export const dynamic = "force-dynamic"
export const revalidate = 0

const NO_STORE = { "Cache-Control": "no-store, max-age=0" }

type Role = "manager" | "super_admin"

function normalizeRole(value: unknown): Role {
  return value === "super_admin" ? "super_admin" : "manager"
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE })
}

function serverError(message = "Database connection unavailable.") {
  return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE })
}

// GET /api/admin/users -> list all staff accounts (super admin only).
export async function GET(request: NextRequest) {
  const unauthorized = requireSuperAdmin(request)
  if (unauthorized) return unauthorized

  const supabase = createAdminServerClient()
  if (!supabase) return serverError()

  const { data, error } = await supabase
    .from("managers")
    .select("id, name, login_id, password, role, created_at")
    .order("created_at", { ascending: true })

  if (error) return serverError(error.message)
  return NextResponse.json({ users: data ?? [] }, { headers: NO_STORE })
}

// POST /api/admin/users -> create a new staff account (super admin only).
export async function POST(request: NextRequest) {
  const unauthorized = requireSuperAdmin(request)
  if (unauthorized) return unauthorized

  const supabase = createAdminServerClient()
  if (!supabase) return serverError()

  const body = await request.json().catch(() => ({}))
  const name = String(body?.name ?? "").trim()
  const loginId = String(body?.loginId ?? "").trim()
  const password = String(body?.password ?? "")
  const role = normalizeRole(body?.role)

  if (!name || !loginId || !password) {
    return badRequest("Name, ID, and password are all required.")
  }

  const { error } = await supabase
    .from("managers")
    .insert({ name, login_id: loginId, password, role })

  if (error) {
    // 23505 = unique_violation (duplicate login_id)
    if (error.code === "23505") return badRequest("This ID is already taken.")
    return serverError(error.message)
  }
  return NextResponse.json({ success: true }, { headers: NO_STORE })
}

// PUT /api/admin/users -> update an existing staff account (super admin only).
export async function PUT(request: NextRequest) {
  const unauthorized = requireSuperAdmin(request)
  if (unauthorized) return unauthorized

  const supabase = createAdminServerClient()
  if (!supabase) return serverError()

  const body = await request.json().catch(() => ({}))
  const id = String(body?.id ?? "").trim()
  const name = String(body?.name ?? "").trim()
  const loginId = String(body?.loginId ?? "").trim()
  const role = normalizeRole(body?.role)
  // Password is optional on update: only changed when a non-empty value is sent.
  const password = typeof body?.password === "string" ? body.password : ""

  if (!id) return badRequest("Missing user id.")
  if (!name || !loginId) return badRequest("Name and ID are required.")

  // Guard: never allow demoting/removing the last super admin.
  if (role !== "super_admin") {
    const { data: current } = await supabase
      .from("managers")
      .select("role")
      .eq("id", id)
      .single()
    if (current?.role === "super_admin") {
      const { count } = await supabase
        .from("managers")
        .select("id", { count: "exact", head: true })
        .eq("role", "super_admin")
      if ((count ?? 0) <= 1) {
        return badRequest("Cannot demote the last Super Admin.")
      }
    }
  }

  const updates: Record<string, unknown> = { name, login_id: loginId, role }
  if (password) updates.password = password

  const { error } = await supabase.from("managers").update(updates).eq("id", id)

  if (error) {
    if (error.code === "23505") return badRequest("This ID is already taken.")
    return serverError(error.message)
  }
  return NextResponse.json({ success: true }, { headers: NO_STORE })
}

// DELETE /api/admin/users?id=... -> remove a staff account (super admin only).
export async function DELETE(request: NextRequest) {
  const unauthorized = requireSuperAdmin(request)
  if (unauthorized) return unauthorized

  const supabase = createAdminServerClient()
  if (!supabase) return serverError()

  const id = request.nextUrl.searchParams.get("id")?.trim()
  if (!id) return badRequest("Missing user id.")

  // Guard: never allow deleting the last super admin (avoids lockout).
  const { data: target } = await supabase
    .from("managers")
    .select("role")
    .eq("id", id)
    .single()
  if (target?.role === "super_admin") {
    const { count } = await supabase
      .from("managers")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin")
    if ((count ?? 0) <= 1) {
      return badRequest("Cannot delete the last Super Admin.")
    }
  }

  const { error } = await supabase.from("managers").delete().eq("id", id)
  if (error) return serverError(error.message)
  return NextResponse.json({ success: true }, { headers: NO_STORE })
}
