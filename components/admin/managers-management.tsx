"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, Loader2, ShieldCheck, Eye } from "lucide-react"
import { adminFetch } from "@/lib/admin-session"
import { useAdminRole } from "@/components/admin/role-context"

type Role = "manager" | "super_admin"

interface StaffUser {
  id: string
  name: string
  login_id: string
  password: string
  role: Role
  created_at: string
}

interface FormState {
  id: string | null
  name: string
  loginId: string
  password: string
  role: Role
}

const EMPTY_FORM: FormState = { id: null, name: "", loginId: "", password: "", role: "manager" }

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "최고 관리자",
  manager: "매니저 (읽기 전용)",
}

export default function ManagersManagement() {
  const { canWrite } = useAdminRole()
  const [users, setUsers] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminFetch("/api/admin/users", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "직원 목록을 불러오지 못했습니다.")
      setUsers(json.users ?? [])
    } catch (err: any) {
      setError(err?.message || "직원 목록을 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (user: StaffUser) => {
    setForm({
      id: user.id,
      name: user.name,
      loginId: user.login_id,
      // Password left blank on edit: only overwrites when a new value is typed.
      password: "",
      role: user.role,
    })
    setFormError(null)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!canWrite) return
    const name = form.name.trim()
    const loginId = form.loginId.trim()
    if (!name || !loginId) {
      setFormError("이름과 아이디는 필수입니다.")
      return
    }
    if (!form.id && !form.password) {
      setFormError("새 직원은 비밀번호가 필요합니다.")
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const isEdit = Boolean(form.id)
      const res = await adminFetch("/api/admin/users", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          name,
          loginId,
          password: form.password,
          role: form.role,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "저장에 실패했습니다.")
      setDialogOpen(false)
      setForm(EMPTY_FORM)
      await loadUsers()
    } catch (err: any) {
      setFormError(err?.message || "저장에 실패했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (user: StaffUser) => {
    if (!canWrite) return
    if (!confirm(`직원 "${user.name}" (${user.login_id}) 계정을 삭제하시겠습니까?`)) return
    try {
      const res = await adminFetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "삭제에 실패했습니다.")
      await loadUsers()
    } catch (err: any) {
      alert(err?.message || "삭제에 실패했습니다.")
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            사용자 관리
          </CardTitle>
          <CardDescription className="mt-1">
            직원 계정을 등록하고 권한(최고 관리자 / 매니저)을 지정합니다.
          </CardDescription>
        </div>
        {canWrite && (
          <Button onClick={openAdd} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> 직원 추가
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 불러오는 중...
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>아이디</TableHead>
                  <TableHead>비밀번호</TableHead>
                  <TableHead>권한</TableHead>
                  {canWrite && <TableHead className="text-right">관리</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canWrite ? 5 : 4} className="text-center text-muted-foreground py-8">
                      등록된 직원이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="font-mono text-sm">{user.login_id}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {"•".repeat(Math.min(8, Math.max(4, user.password?.length ?? 6)))}
                      </TableCell>
                      <TableCell>
                        {user.role === "super_admin" ? (
                          <Badge className="gap-1 bg-primary/15 text-primary border-primary/30" variant="outline">
                            <ShieldCheck className="h-3 w-3" /> {ROLE_LABEL.super_admin}
                          </Badge>
                        ) : (
                          <Badge className="gap-1 bg-amber-500/10 text-amber-600 border-amber-500/30" variant="outline">
                            <Eye className="h-3 w-3" /> {ROLE_LABEL.manager}
                          </Badge>
                        )}
                      </TableCell>
                      {canWrite && (
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(user)}>
                              <Pencil className="h-3.5 w-3.5" /> 수정
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="gap-1"
                              onClick={() => handleDelete(user)}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> 삭제
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "직원 정보 수정" : "새 직원 추가"}</DialogTitle>
            <DialogDescription>
              이름, 로그인 아이디, 비밀번호와 권한을 지정하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="staff-name">이름</Label>
              <Input
                id="staff-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: Luna"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-id">아이디</Label>
              <Input
                id="staff-id"
                value={form.loginId}
                onChange={(e) => setForm({ ...form, loginId: e.target.value })}
                placeholder="로그인에 사용할 아이디"
                className="font-mono"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-pw">비밀번호</Label>
              <Input
                id="staff-pw"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={form.id ? "변경 시에만 입력" : "비밀번호"}
                autoComplete="new-password"
              />
              {form.id && (
                <p className="text-xs text-muted-foreground">비워두면 기존 비밀번호가 유지됩니다.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-role">권한</Label>
              <Select
                value={form.role}
                onValueChange={(value) => setForm({ ...form, role: value as Role })}
              >
                <SelectTrigger id="staff-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">
                    최고 관리자 — 전체 데이터 추가/수정/삭제
                  </SelectItem>
                  <SelectItem value="manager">
                    매니저 — 읽기 전용 (조회 · 엑셀 · 인쇄)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? "저장" : "추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
