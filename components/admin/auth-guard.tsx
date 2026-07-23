"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getAdminRole, isAdminAuthenticated, type AdminRole } from "@/lib/admin-session"
import { AdminRoleProvider } from "@/components/admin/role-context"

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [role, setRole] = useState<AdminRole>("manager")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (isAdminAuthenticated()) {
      setIsAuthenticated(true)
      setRole(getAdminRole())
    } else {
      router.push("/admin/login")
    }
    setMounted(true)
  }, [router])

  if (!mounted) return null

  if (!isAuthenticated) {
    return null
  }

  return <AdminRoleProvider role={role}>{children}</AdminRoleProvider>
}
