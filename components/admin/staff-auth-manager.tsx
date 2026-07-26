"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Check } from "lucide-react"
import { adminTranslations, type AdminLanguage } from "@/lib/admin-translations"

interface StaffAuthManagerProps {
  language: string
}

const translations: Record<string, any> = {
  ko: {
    title: "직원 인증 비밀번호 관리",
    description: "모든 직원이 사용할 공통 인증 비밀번호를 설정합니다",
    currentPassword: "현재 비밀번호",
    newPassword: "새 비밀번호",
    confirmPassword: "비밀번호 확인",
    setPassword: "비밀번호 설정",
    update: "업데이트",
    passwordUpdated: "비밀번호가 업데이트되었습니다!",
    passwordMismatch: "비밀번호가 일치하지 않습니다",
    passwordEmpty: "비밀번호를 입력해주세요",
    passwordTooShort: "비밀번호는 최소 4자 이상이어야 합니다",
    error: "오류가 발생했습니다",
    success: "성공",
    warning: "주의",
  },
  en: {
    title: "Staff Authentication Password Management",
    description: "Set a common authentication password for all staff members",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmPassword: "Confirm Password",
    setPassword: "Set Password",
    update: "Update",
    passwordUpdated: "Password updated successfully!",
    passwordMismatch: "Passwords do not match",
    passwordEmpty: "Please enter a password",
    passwordTooShort: "Password must be at least 4 characters",
    error: "An error occurred",
    success: "Success",
    warning: "Warning",
  },
  ja: {
    title: "スタッフ認証パスワード管理",
    description: "すべてのスタッフが使用する共通認証パスワードを設定します",
    currentPassword: "現在のパスワード",
    newPassword: "新しいパスワード",
    confirmPassword: "パスワード確認",
    setPassword: "パスワード設定",
    update: "更新",
    passwordUpdated: "パスワードが更新されました!",
    passwordMismatch: "パスワードが一致しません",
    passwordEmpty: "パスワードを入力してください",
    passwordTooShort: "パスワードは4文字以上である必要があります",
    error: "エラーが発生しました",
    success: "成功",
    warning: "警告",
  },
  zh: {
    title: "员工认证密码管理",
    description: "为所有员工设置公共认证密码",
    currentPassword: "当前密码",
    newPassword: "新密码",
    confirmPassword: "确认密码",
    setPassword: "设置密码",
    update: "更新",
    passwordUpdated: "密码已成功更新!",
    passwordMismatch: "密码不匹配",
    passwordEmpty: "请输入密码",
    passwordTooShort: "密码必须至少4个字符",
    error: "发生错误",
    success: "成功",
    warning: "警告",
  },
  es: {
    title: "Gestión de Contraseña de Autenticación de Personal",
    description: "Establezca una contraseña de autenticación común para todos los miembros del personal",
    currentPassword: "Contraseña Actual",
    newPassword: "Nueva Contraseña",
    confirmPassword: "Confirmar Contraseña",
    setPassword: "Establecer Contraseña",
    update: "Actualizar",
    passwordUpdated: "¡Contraseña actualizada exitosamente!",
    passwordMismatch: "Las contraseñas no coinciden",
    passwordEmpty: "Por favor ingrese una contraseña",
    passwordTooShort: "La contraseña debe tener al menos 4 caracteres",
    error: "Ocurrió un error",
    success: "Éxito",
    warning: "Advertencia",
  },
  th: {
    title: "การจัดการรหัสผ่านการตรวจสอบพนักงาน",
    description: "ตั้งรหัสผ่านการตรวจสอบทั่วไปสำหรับพนักงานทั้งหมด",
    currentPassword: "รหัสผ่านปัจจุบัน",
    newPassword: "รหัสผ่านใหม่",
    confirmPassword: "ยืนยันรหัสผ่าน",
    setPassword: "ตั้งรหัสผ่าน",
    update: "อัปเดต",
    passwordUpdated: "อัปเดตรหัสผ่านสำเร็จ!",
    passwordMismatch: "รหัสผ่านไม่ตรงกัน",
    passwordEmpty: "กรุณากรอกรหัสผ่าน",
    passwordTooShort: "รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร",
    error: "เกิดข้อผิดพลาด",
    success: "สำเร็จ",
    warning: "คำเตือน",
  },
  vi: {
    title: "Quản lý Mật khẩu Xác thực Nhân viên",
    description: "Đặt mật khẩu xác thực chung cho tất cả các thành viên nhân viên",
    currentPassword: "Mật khẩu hiện tại",
    newPassword: "Mật khẩu mới",
    confirmPassword: "Xác nhận mật khẩu",
    setPassword: "Đặt mật khẩu",
    update: "Cập nhật",
    passwordUpdated: "Mật khẩu đã được cập nhật thành công!",
    passwordMismatch: "Mật khẩu không khớp",
    passwordEmpty: "Vui lòng nhập mật khẩu",
    passwordTooShort: "Mật khẩu phải có ít nhất 4 ký tự",
    error: "Đã xảy ra lỗi",
    success: "Thành công",
    warning: "Cảnh báo",
  },
}

// HARDCODED SHARED KEY - Must match exactly in the Main Menu Auth Modal
const APP_STAFF_AUTH_PWD = "APP_STAFF_AUTH_PWD"

export default function StaffAuthManager({ language }: StaffAuthManagerProps) {
  const adminLang = (language as AdminLanguage) || "ko"
  const t = adminTranslations[adminLang] || adminTranslations.ko
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    // Get current stored password (or default)
    const storedPassword = localStorage.getItem(APP_STAFF_AUTH_PWD) || "0000"

    // Validation
    if (!currentPassword) {
      setMessage({ type: "error", text: t.staffAuthPasswordEmpty })
      return
    }

    if (!newPassword || !confirmPassword) {
      setMessage({ type: "error", text: t.passwordEmpty })
      return
    }

    if (newPassword.length < 4) {
      setMessage({ type: "error", text: t.passwordTooShort })
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: t.passwordMismatch })
      return
    }

    // Verify current password
    if (currentPassword !== storedPassword) {
      setMessage({ type: "error", text: t.staffAuthPasswordMismatch })
      return
    }

    setLoading(true)
    try {
      // Save new password to localStorage
      localStorage.setItem(APP_STAFF_AUTH_PWD, newPassword)
      
      setMessage({ type: "success", text: t.passwordUpdated })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")

      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: "error", text: t.error })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.staffAuthTitle}</CardTitle>
        <CardDescription>{t.staffAuthDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Current Password Field - ALWAYS SHOWN */}
          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="text-sm font-medium">
              {t.staffAuthCurrentPassword}
            </Label>
            <Input
              id="currentPassword"
              type="password"
              placeholder={t.staffAuthCurrentPassword}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-zinc-500 mt-1">(Default: 0000)</p>
          </div>

          {/* New Password Field */}
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-sm font-medium">
              {t.staffAuthNewPassword}
            </Label>
            <Input
              id="newPassword"
              type="password"
              placeholder={t.staffAuthNewPassword}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              minLength={4}
            />
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">
              {t.staffAuthConfirmPassword}
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder={t.staffAuthConfirmPassword}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              minLength={4}
            />
          </div>

          {/* Message Display */}
          {message && (
            <div
              className={`p-4 rounded-lg flex items-start gap-3 ${
                message.type === "success"
                  ? "bg-green-500/10 border border-green-500/30"
                  : message.type === "error"
                  ? "bg-red-500/10 border border-red-500/30"
                  : "bg-amber-500/10 border border-amber-500/30"
              }`}
            >
              {message.type === "success" && <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />}
              {message.type !== "success" && <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
              <p
                className={`text-sm font-medium ${
                  message.type === "success"
                    ? "text-green-600"
                    : message.type === "error"
                    ? "text-red-600"
                    : "text-amber-600"
                }`}
              >
                {message.text}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? "..." : t.staffAuthUpdate}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
