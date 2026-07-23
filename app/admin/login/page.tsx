"use client"

import type React from "react"
import Link from "next/link"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { setAdminSession } from "@/lib/admin-session"

export default function AdminLoginPage() {
  const router = useRouter()
  const [loginId, setLoginId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      // The server validates the ID + password against the managers table and
      // decides the role. A super admin receives a privileged token; a manager
      // receives an empty token and is therefore read-only at the API level too.
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      })

      if (!res.ok) {
        setError("아이디 또는 비밀번호가 올바르지 않습니다")
        setPassword("")
        return
      }

      const { role, token, name, loginId: id } = await res.json()
      setAdminSession(role, token, name, id)
      setPassword("")
      router.push("/admin")
    } catch {
      setError("로그인 중 오류가 발생했습니다")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">관리자 로그인</CardTitle>
          <CardDescription>
            등록된 개인 아이디와 비밀번호로 로그인하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">아이디</label>
              <Input
                type="text"
                value={loginId}
                onChange={(e) => {
                  setLoginId(e.target.value)
                  setError("")
                }}
                placeholder="아이디를 입력하세요"
                className="mt-1"
                autoComplete="username"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">비밀번호</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError("")
                }}
                placeholder="비밀번호를 입력하세요"
                className="mt-1"
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? "로그인 중..." : "로그인"}
            </Button>
            <Link href="/">
              <Button type="button" variant="outline" className="w-full bg-transparent">
                메뉴판으로 돌아가기
              </Button>
            </Link>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
