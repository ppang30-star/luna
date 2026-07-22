"use client"

import type React from "react"
import Link from "next/link"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const ADMIN_PASSWORD = "admin123"

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem("adminAuth", "true")
      setPassword("")
      router.push("/admin")
    } else {
      setError("비밀번호가 올바르지 않습니다")
      setPassword("")
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">관리자 로그인</CardTitle>
          <CardDescription>메뉴판을 관리하려면 로그인하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
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
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              로그인
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
