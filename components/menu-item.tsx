"use client"

import { useState } from "react"
import type { Currency } from "@/lib/currencies"
import type { Language } from "@/lib/translations"
import { useExchangeRates } from "@/hooks/use-exchange-rates"

interface MenuItemData {
  id: string
  nameKo: string
  nameEn: string
  nameJa: string
  nameZh: string
  nameEs: string
  nameVi: string
  descKo: string
  descEn: string
  descJa: string
  descZh: string
  descEs: string
  descVi: string
  priceKRW: number
  priceCurrency?: string
  priceAmount?: number
  image: string
}

interface MenuItemProps {
  item: MenuItemData
  language: Language
  currency: Currency
}

export default function MenuItem({ item, language, currency }: MenuItemProps) {
  const { convertPrice, formatPrice } = useExchangeRates()
  const [imageError, setImageError] = useState(false)
  
  // Early return if item is invalid
  if (!item) {
    return null
  }
  
  const nameKey =
    `name${language === "ko" ? "Ko" : language === "en" ? "En" : language === "ja" ? "Ja" : language === "zh" ? "Zh" : language === "es" ? "Es" : "Vi"}` as keyof MenuItemData
  const descKey =
    `desc${language === "ko" ? "Ko" : language === "en" ? "En" : language === "ja" ? "Ja" : language === "zh" ? "Zh" : language === "es" ? "Es" : "Vi"}` as keyof MenuItemData

  const itemName = (item?.[nameKey] as string) || item?.nameKo || "메뉴명 없음"
  const itemDesc = (item?.[descKey] as string) || item?.descKo || ""

  // Get the source currency and amount with safety checks
  const sourceCurrency = item?.priceCurrency || "KRW"
  const rawAmount = item?.priceAmount ?? item?.priceKRW ?? 0
  const sourceAmount = typeof rawAmount === 'number' && !isNaN(rawAmount) ? rawAmount : 0
  
  // Convert to display currency with NaN protection
  const convertedPrice = convertPrice(sourceAmount, sourceCurrency, currency || "KRW")
  const safeConvertedPrice = typeof convertedPrice === 'number' && !isNaN(convertedPrice) ? convertedPrice : 0
  const displayPrice = formatPrice(safeConvertedPrice, currency || "KRW")

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-all duration-200 hover:shadow-lg hover:-translate-y-1">
      {/* 이미지 */}
      <div className="relative h-48 w-full bg-muted overflow-hidden flex items-center justify-center">
        {!imageError ? (
          // CRITICAL: Use the image URL from the hook (includes cache buster with timestamp)
          // so UI updates immediately when image changes in DB. The key prop forces React
          // to remount the img tag when the URL changes, clearing browser cache state.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.image}
            src={item.image}
            alt={itemName}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          // Fallback UI: Clean gray box with camera icon when image fails to load
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <svg
              className="w-16 h-16 text-muted-foreground/30 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm text-muted-foreground/50 font-medium">No image</p>
          </div>
        )}
      </div>

      {/* 정보 */}
      <div className="p-4">
        <h3 className="font-bold text-lg text-foreground mb-1 line-clamp-2">{itemName}</h3>
        {itemDesc && <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{itemDesc}</p>}

        {/* 가격 */}
        <div className="flex items-baseline justify-between border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">{currency}</span>
          <span className="text-2xl font-bold text-primary">
            {displayPrice}
          </span>
        </div>
      </div>
    </div>
  )
}
