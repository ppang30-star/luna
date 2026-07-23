"use client"

import { createContext, useContext } from "react"
import type { AdminRole } from "@/lib/admin-session"

interface AdminRoleContextValue {
  role: AdminRole
  // Convenience flag: true only for super_admin. All Create/Update/Delete UI
  // and handlers must be gated behind this.
  canWrite: boolean
}

const AdminRoleContext = createContext<AdminRoleContextValue>({
  role: "manager",
  canWrite: false,
})

export function AdminRoleProvider({
  role,
  children,
}: {
  role: AdminRole
  children: React.ReactNode
}) {
  return (
    <AdminRoleContext.Provider value={{ role, canWrite: role === "super_admin" }}>
      {children}
    </AdminRoleContext.Provider>
  )
}

// Read the current admin role anywhere inside AuthGuard. Defaults to the
// read-only manager role when used outside a provider.
export function useAdminRole(): AdminRoleContextValue {
  return useContext(AdminRoleContext)
}
