"use client"

import { useState, useEffect } from "react"
import { useContext } from "react"
import { LanguageContext } from "@/lib/context"
import { translations, type Language } from "@/lib/translations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check } from "lucide-react"

interface StaffAuthModalProps {
  onAuthenticate: (exemptUntilPrint: boolean) => void
  isOpen: boolean
}

// HARDCODED SHARED KEY - Must match exactly in the Admin Staff Auth Manager
const APP_STAFF_AUTH_PWD = "APP_STAFF_AUTH_PWD"

export default function StaffAuthModal({
  onAuthenticate,
  isOpen,
}: StaffAuthModalProps) {
  const language = (useContext(LanguageContext) as Language) || "ko"
  const t = translations[language]?.staffAuth ?? translations.ko.staffAuth
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [exemptUntilPrint, setExemptUntilPrint] = useState(false)
  const [currentPassword, setCurrentPassword] = useState<string>("0000")

  // Read localStorage on mount
  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem(APP_STAFF_AUTH_PWD)
      setCurrentPassword(stored || "0000")
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    
    if (!password.trim()) {
      setError(t.emptyPassword)
      return
    }

    setLoading(true)
    
    // Compare directly against localStorage value
    const effectivePassword = currentPassword || "0000"
    
    // Simulate slight delay for better UX
    setTimeout(() => {
      if (password === effectivePassword) {
        setPassword("")
        onAuthenticate(exemptUntilPrint)
      } else {
        setError(t.invalidPassword)
      }
      setLoading(false)
    }, 300)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing && !loading) {
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
    >
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-8 pt-10 pb-6 text-center border-b border-white/10">
          <h2 className="text-2xl font-bold text-white mb-2">
            {t.title}
          </h2>
          <p className="text-zinc-400 text-sm">
            {t.description}
          </p>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Password Input */}
          <div className="space-y-2">
            <Label htmlFor="staffPassword" className="text-white">
              {t.title}
            </Label>
            <Input
              id="staffPassword"
              type="password"
              placeholder={t.passwordPlaceholder}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError("")
              }}
              onKeyPress={handleKeyPress}
              disabled={loading}
              autoFocus
              className="bg-zinc-800 border-white/20 text-white placeholder:text-zinc-500"
            />
            <p className="text-xs text-zinc-400 mt-1">
              (Default: 0000)
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Exemption Checkbox - Custom High Visibility */}
          <div className="flex items-start space-x-3 p-4 bg-zinc-800/50 rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => !loading && setExemptUntilPrint(!exemptUntilPrint)}
              disabled={loading}
              className={`flex-shrink-0 mt-1 w-6 h-6 rounded border-2 transition-all duration-200 flex items-center justify-center ${
                exemptUntilPrint
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-white bg-transparent hover:bg-white/5'
              }`}
              aria-label="Exemption checkbox"
            >
              {exemptUntilPrint && (
                <Check size={16} className="text-white font-bold" strokeWidth={4} />
              )}
            </button>
            <Label
              htmlFor="exemptCheckbox"
              onClick={() => !loading && setExemptUntilPrint(!exemptUntilPrint)}
              className="text-sm text-zinc-300 cursor-pointer flex-1 pt-0.5"
            >
              {t.exemptionCheckbox}
            </Label>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold py-3 rounded-lg transition-all duration-300"
          >
            {loading ? "..." : t.enterButton}
          </Button>
        </form>
      </div>
    </div>
  )
}
