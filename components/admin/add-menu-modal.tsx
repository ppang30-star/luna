"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { adminTranslations } from "@/lib/admin-translations"
import { useRealtimeCategories } from "@/hooks/use-realtime-menu"

interface Category {
  id: string
  ko: string
  en: string
  ja: string
  zh: string
  es: string
  th: string
  vi: string
}

interface AddMenuModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (menuData: any) => Promise<void> | void
  language?: string
}

const LANGUAGES = [
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "th", label: "ไทย", flag: "🇹🇭" },
  { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
]

const DEFAULT_CATEGORIES: Category[] = [
  {
    id: "spirits",
    ko: "위스키/스피릿",
    en: "Spirits",
    ja: "ウイスキー",
    zh: "烈酒",
    es: "Licores",
    th: "เหล้า",
    vi: "Rượu mạnh",
  },
  { id: "beers", ko: "맥주", en: "Beer", ja: "ビール", zh: "啤酒", es: "Cerveza", th: "เบียร์", vi: "Bia" },
  { id: "wines", ko: "와인", en: "Wine", ja: "ワイン", zh: "葡萄酒", es: "Vino", th: "ไวน์", vi: "Rượu vang" },
  {
    id: "cocktails",
    ko: "칵테일",
    en: "Cocktails",
    ja: "カクテル",
    zh: "鸡尾酒",
    es: "Cócteles",
    th: "ค็อกเทล",
    vi: "Cocktail",
  },
  {
    id: "liqueurs",
    ko: "리큐르",
    en: "Liqueurs",
    ja: "リキュール",
    zh: "利口酒",
    es: "Licores",
    th: "ลิเคียร์",
    vi: "Liqueur",
  },
]

export default function AddMenuModal({ isOpen, onClose, onSave, language = "ko" }: AddMenuModalProps) {
  const t = adminTranslations[language as keyof typeof adminTranslations]
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [localCategories, setLocalCategories] = useState<Category[]>(DEFAULT_CATEGORIES)
  
  // Supabase 실시간 카테고리 연동
  const { categories: realtimeCategories, loading: categoriesLoading, refetch: refetchCategories } = useRealtimeCategories()
  
  // Supabase에 카테고리가 있으면 사용, 없으면 로컬 데이터 사용
  const categories = realtimeCategories.length > 0 ? realtimeCategories : localCategories
  const [selectedFileName, setSelectedFileName] = useState("")
  const [imagePreview, setImagePreview] = useState("")
  const [activeInputLang, setActiveInputLang] = useState("ko")
  const [showMultiLang, setShowMultiLang] = useState(false)
  const [validationError, setValidationError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [formData, setFormData] = useState({
    category: "",
    priceKRW: "",
    priceCurrency: "KRW" as "KRW" | "VND",
    nameKo: "",
    nameEn: "",
    nameJa: "",
    nameZh: "",
    nameEs: "",
    nameTh: "",
    nameVi: "",
    descKo: "",
    descEn: "",
    descJa: "",
    descZh: "",
    descEs: "",
    descTh: "",
    descVi: "",
    image: "",
    can_adjust_price: false,
  })

  const PRICE_CURRENCIES = [
    { code: "KRW", symbol: "₩", name: "원화 (KRW)" },
    { code: "VND", symbol: "₫", name: "베트남 동 (VND)" },
  ]

  // 모달이 열릴 때마다 Supabase에서 최신 카테고리 목록을 가져옴
  useEffect(() => {
    if (isOpen) {
      // Supabase 카테고리 다시 불러오기
      refetchCategories()
      
      // 로컬 스토리지에서도 불러옴 (fallback)
      const savedCategories = localStorage.getItem("menuCategories")
      if (savedCategories) {
        try {
          const parsed = JSON.parse(savedCategories)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setLocalCategories(parsed)
          } else {
            setLocalCategories(DEFAULT_CATEGORIES)
          }
        } catch {
          setLocalCategories(DEFAULT_CATEGORIES)
        }
      } else {
        setLocalCategories(DEFAULT_CATEGORIES)
      }
    }
  }, [isOpen, refetchCategories])

  useEffect(() => {
    if (isOpen) {
      setFormData({
        category: "",
        priceKRW: "",
        priceCurrency: "KRW",
        nameKo: "",
        nameEn: "",
        nameJa: "",
        nameZh: "",
        nameEs: "",
        nameTh: "",
        nameVi: "",
        descKo: "",
        descEn: "",
        descJa: "",
        descZh: "",
        descEs: "",
        descTh: "",
        descVi: "",
        image: "",
        can_adjust_price: false,
      })
      setSelectedFileName("")
      setImagePreview("")
      setActiveInputLang("ko")
      setShowMultiLang(false)
    }
  }, [isOpen])

  const getCategoryDisplayName = (category: Category): string => {
    switch (language) {
      case "ko":
        return category.ko
      case "en":
        return category.en
      case "ja":
        return category.ja
      case "zh":
        return category.zh
      case "es":
        return category.es
      case "th":
        return category.th
      case "vi":
        return category.vi
      default:
        return category.ko
    }
  }

  const getNameKey = (langCode: string) => {
    const map: Record<string, keyof typeof formData> = {
      ko: "nameKo",
      en: "nameEn",
      ja: "nameJa",
      zh: "nameZh",
      es: "nameEs",
      th: "nameTh",
      vi: "nameVi",
    }
    return map[langCode] || "nameKo"
  }

  const getDescKey = (langCode: string) => {
    const map: Record<string, keyof typeof formData> = {
      ko: "descKo",
      en: "descEn",
      ja: "descJa",
      zh: "descZh",
      es: "descEs",
      th: "descTh",
      vi: "descVi",
    }
    return map[langCode] || "descKo"
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError("")
    setSaveSuccess(false)
    const file = e.target.files?.[0]

    if (!file) {
      return
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setValidationError(t.invalidImageType)
      e.target.value = "" // Reset input
      return
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      setValidationError(t.imageTooLarge)
      e.target.value = "" // Reset input
      return
    }

    setSelectedFileName(file.name)

    try {
      const reader = new FileReader()

      reader.onloadend = () => {
        if (reader.result && typeof reader.result === "string") {
          setFormData((prev) => ({ ...prev, image: reader.result as string }))
          setImagePreview(reader.result as string)
        } else {
          setValidationError(t.imageUploadError)
          setSelectedFileName("")
        }
      }

      reader.onerror = () => {
        setValidationError(t.imageUploadError)
        setSelectedFileName("")
        e.target.value = "" // Reset input
      }

      reader.readAsDataURL(file)
    } catch (error) {
      setValidationError(t.imageUploadError)
      setSelectedFileName("")
      e.target.value = "" // Reset input
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Prevent double submission
    if (isSaving) return

    setValidationError("")
    setSaveSuccess(false)

    // Validate required fields
    if (!formData.category) {
      setValidationError(t.pleaseSelectCategory)
      return
    }

    if (!formData.nameKo || formData.nameKo.trim() === "") {
      setValidationError(t.pleaseEnterProductName)
      return
    }

    // Allow 0 as a valid price (e.g. free service items). Only reject when the
    // field is truly empty/null/undefined, or not a valid non-negative number.
    const priceIsEmpty =
      formData.priceKRW === "" || formData.priceKRW === null || formData.priceKRW === undefined
    const priceValue = Number(formData.priceKRW)
    if (priceIsEmpty || Number.isNaN(priceValue) || priceValue < 0) {
      setValidationError(t.pleaseEnterPrice)
      return
    }

    // Check if image is still loading
    if (selectedFileName && !formData.image) {
      setValidationError(t.imageStillLoading)
      return
    }

    setIsSaving(true)

    try {
      const finalData = { ...formData }
      LANGUAGES.forEach((lang) => {
        const nameKey = getNameKey(lang.code)
        const descKey = getDescKey(lang.code)
        if (!finalData[nameKey]) {
          finalData[nameKey] = formData.nameKo
        }
        if (!finalData[descKey]) {
          finalData[descKey] = formData.descKo || ""
        }
      })

      const menuData = {
        ...finalData,
        priceKRW: Number(formData.priceKRW),
        priceCurrency: formData.priceCurrency,
        priceAmount: Number(formData.priceKRW),
        id: Date.now().toString(),
        image: finalData.image || "", // Ensure image is never undefined
      }

      console.log("[v0] AddMenuModal: Saving menu data:", JSON.stringify(menuData, null, 2))

      // Call parent onSave handler (which saves to Supabase)
      await onSave(menuData)

      console.log("[v0] AddMenuModal: Menu saved successfully")
      setSaveSuccess(true)
      setIsSaving(false)
      
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error: any) {
      console.error("[v0] AddMenuModal: Error saving menu:", error.message || error)
      setValidationError(error.message || t.saveError || "저장에 실패했습니다. 다시 시도해 주세요.")
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={isSaving ? undefined : onClose} />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">{t.addNewMenu}</h2>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {saveSuccess && (
            <div className="p-3 bg-green-100 border border-green-300 text-green-700 rounded-lg text-sm flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              {t.saveComplete || "저장 완료!"}
            </div>
          )}

          {validationError && (
            <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              {validationError}
            </div>
          )}

          {/* Row 1: Category and Price side-by-side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t.selectCategory} <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => {
                  setFormData({ ...formData, category: e.target.value })
                  setValidationError("")
                }}
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              >
                <option value="">{t.selectCategoryPlaceholder}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {getCategoryDisplayName(cat)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t.price} <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.priceCurrency}
                  onChange={(e) => setFormData({ ...formData, priceCurrency: e.target.value as "KRW" | "VND" })}
                  className="w-28 px-2 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                >
                  {PRICE_CURRENCIES.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.symbol} {curr.code}
                    </option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={formData.priceKRW}
                    onChange={(e) => {
                      setFormData({ ...formData, priceKRW: e.target.value })
                      setValidationError("")
                    }}
                    placeholder={formData.priceCurrency === "KRW" ? "450000" : "200000"}
                    className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-foreground">
              {t.productName} <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => setShowMultiLang(!showMultiLang)}
              className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              {showMultiLang ? t.hideMultiLang || "Hide Languages" : t.showMultiLang || "Multi-Language Input"}
            </button>
          </div>

          {showMultiLang ? (
            <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/30">
              {/* Language tabs */}
              <div className="flex flex-wrap gap-1">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setActiveInputLang(lang.code)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      activeInputLang === lang.code
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80 text-foreground"
                    }`}
                  >
                    {lang.flag} {lang.label}
                  </button>
                ))}
              </div>

              {/* Active language input */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  {LANGUAGES.find((l) => l.code === activeInputLang)?.label} {t.productName}
                </label>
                <input
                  type="text"
                  value={formData[getNameKey(activeInputLang)] as string}
                  onChange={(e) => setFormData({ ...formData, [getNameKey(activeInputLang)]: e.target.value })}
                  placeholder={t.enterProductName}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  {LANGUAGES.find((l) => l.code === activeInputLang)?.label} {t.productDescription}
                </label>
                <textarea
                  value={formData[getDescKey(activeInputLang)] as string}
                  onChange={(e) => setFormData({ ...formData, [getDescKey(activeInputLang)]: e.target.value })}
                  placeholder={t.enterProductDescription}
                  rows={2}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>

              {/* Filled languages indicator */}
              <div className="flex flex-wrap gap-1 pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground mr-2">{t.filledLanguages || "Filled"}:</span>
                {LANGUAGES.map((lang) => {
                  const hasName = !!formData[getNameKey(lang.code)]
                  return (
                    <span
                      key={lang.code}
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        hasName ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {lang.flag}
                    </span>
                  )
                })}
              </div>
            </div>
          ) : (
            <>
              {/* Row 2: Simple Product Name (Korean) */}
              <input
                type="text"
                value={formData.nameKo}
                onChange={(e) => setFormData({ ...formData, nameKo: e.target.value })}
                placeholder={t.enterProductName}
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />

              {/* Row 3: Simple Product Description (Korean) */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t.productDescription}</label>
                <textarea
                  value={formData.descKo}
                  onChange={(e) => setFormData({ ...formData, descKo: e.target.value })}
                  placeholder={t.enterProductDescription}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm resize-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
            </>
          )}

          {/* Row 4: Image Upload */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t.photoUpload}</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-3 bg-[#FF8C00] hover:bg-[#E67E00] text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              {t.uploadFile}
            </button>
            {selectedFileName && (
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {selectedFileName}
                </span>
              </div>
            )}
          </div>

          {/* Image Preview */}
          {imagePreview && (
            <div className="rounded-lg overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview || "/placeholder.svg"} alt="Preview" className="w-full h-40 object-cover" />
            </div>
          )}

          {/* Manager Price Edit Toggle */}
          <div className="border border-border rounded-md p-4 bg-muted/20">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.can_adjust_price || false}
                onChange={(e) => setFormData({ ...formData, can_adjust_price: e.target.checked })}
                className="w-4 h-4 rounded cursor-pointer"
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Manager Price Edit</p>
                <p className="text-xs text-muted-foreground">Allow manager to adjust price (±10,000 VND)</p>
              </div>
            </label>
          </div>

          {/* Footer: Save and Cancel buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className={`flex-1 px-4 py-3 font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 ${
                isSaving
                  ? "bg-primary/50 cursor-not-allowed text-primary-foreground/70"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
              }`}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {t.saving || "저장 중..."}
                </>
              ) : (
                t.save
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className={`flex-1 px-4 py-3 border border-border font-medium rounded-lg transition-colors duration-200 ${
                isSaving ? "cursor-not-allowed opacity-50" : "hover:bg-muted"
              } text-foreground`}
            >
              {t.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
