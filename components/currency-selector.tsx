"use client"

import { useContext } from "react"
import { useExchangeRates } from "@/hooks/use-exchange-rates"
import { LanguageContext } from "@/lib/context"
import { translations, type Language } from "@/lib/translations"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const LOCALE_MAP: Record<string, string> = {
  ko: "ko-KR",
  en: "en-US",
  ja: "ja-JP",
  zh: "zh-CN",
  es: "es-ES",
  th: "th-TH",
  vi: "vi-VN",
}

interface CurrencySelectorProps {
  value: string
  onChange: (currency: string) => void
  showLoading?: boolean
}

// Primary currencies for menu display - expanded to include JPY and CNY
const PRIMARY_CURRENCIES = [
  { code: "KRW", symbol: "₩", name: "한국 원", flag: "🇰🇷" },
  { code: "USD", symbol: "$", name: "미국 달러", flag: "🇺🇸" },
  { code: "VND", symbol: "₫", name: "베트남 동", flag: "🇻🇳" },
  { code: "JPY", symbol: "¥", name: "일본 엔", flag: "🇯🇵" },
  { code: "CNY", symbol: "¥", name: "중국 위안", flag: "🇨🇳" },
]

export default function CurrencySelector({ value, onChange, showLoading = true }: CurrencySelectorProps) {
  const { loading, lastUpdated } = useExchangeRates()
  const language = (useContext(LanguageContext) as Language) || "ko"
  const t = translations[language]?.header ?? translations.ko.header
  const locale = LOCALE_MAP[language] || "ko-KR"

  const currentCurrency = PRIMARY_CURRENCIES.find(c => c.code === value) || PRIMARY_CURRENCIES[0]
  
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-muted-foreground hidden sm:inline">{t.currency}</label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-[140px] sm:w-[160px] bg-card border-border">
            <SelectValue>
              <span className="flex items-center gap-2">
                <span>{currentCurrency.flag}</span>
                <span className="font-medium">{currentCurrency.code}</span>
                <span className="text-muted-foreground text-xs hidden sm:inline">({currentCurrency.symbol})</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {PRIMARY_CURRENCIES.map((curr) => (
              <SelectItem 
                key={curr.code} 
                value={curr.code}
                className="cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span>{curr.flag}</span>
                  <span className="font-medium">{curr.code}</span>
                  <span className="text-muted-foreground text-xs">({curr.symbol})</span>
                  <span className="text-muted-foreground text-xs hidden sm:inline ml-1">{curr.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showLoading && loading && (
          <span className="text-xs text-muted-foreground animate-pulse">{t.exchangeRateLoading}</span>
        )}
      </div>
      {showLoading && lastUpdated && !loading && (
        <span className="text-xs text-muted-foreground">
          {t.exchangeRateUpdated.replace("{time}", lastUpdated.toLocaleTimeString(locale))}
        </span>
      )}
    </div>
  )
}
