"use client"

import { useContext } from "react"
import { LanguageContext } from "@/lib/context"
import { translations, type Language } from "@/lib/translations"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface LanguageSelectorProps {
  value: string
  onChange: (lang: string) => void
}

const languages = [
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
]

export default function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  const contextLanguage = (useContext(LanguageContext) as Language) || "ko"
  const t = translations[contextLanguage]?.header ?? translations.ko.header
  const currentLabel = languages.find((l) => l.code === value)?.label || t.language

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-muted-foreground hidden sm:inline">{t.language}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-40">
          <SelectValue>{currentLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.flag} {lang.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
