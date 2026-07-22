"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { adminTranslations } from "@/lib/admin-translations"
import { useRealtimeCategories } from "@/hooks/use-realtime-menu"
import { ModifierManager } from "./modifier-manager"
import { loadModifiersFromLocalStorage } from "@/lib/modifier-utils"
import { useComboOptionGroups } from "@/hooks/use-combo-option-groups"

interface MenuFormProps {
  onSubmit: (item: any) => void
  initialData?: any
  onCancel: () => void
  language?: string
}

const LANGUAGES = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "es", label: "Español" },
  { code: "th", label: "ไทย" },
  { code: "vi", label: "Tiếng Việt" },
]

export default function MenuForm({ onSubmit, initialData, onCancel, language = "ko" }: MenuFormProps) {
  const t = adminTranslations[language as keyof typeof adminTranslations]
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getNewMenuTemplate = () => ({
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
    priceKRW: "",
    priceCurrency: "KRW" as "KRW" | "VND",
    priceAmount: "",
    category: "",
    image: "",
    can_adjust_price: false,
    is_combo: false,
    combo_option_group_ids: [] as string[],
  })

  const PRICE_CURRENCIES = [
    { code: "KRW", symbol: "₩", name: "원화 (KRW)" },
    { code: "VND", symbol: "₫", name: "베트남 동 (VND)" },
  ]

  const [formData, setFormData] = useState(initialData || getNewMenuTemplate())
  const [imagePreview, setImagePreview] = useState(initialData?.image || "")
  // CRITICAL: Track whether a new image was uploaded (vs. existing image from database)
  const [hasNewImageUpload, setHasNewImageUpload] = useState(false)
  const [localCategories, setLocalCategories] = useState<
    Array<{ id: string; ko: string; en: string; ja: string; zh: string; es: string; th: string; vi: string }>
  >([])
  const [activeLanguage, setActiveLanguage] = useState("ko")
  const [selectedFileName, setSelectedFileName] = useState("")

  // Combo option groups (global, reusable) for linking to a combo menu.
  const { groups: optionGroups } = useComboOptionGroups()

  // Supabase 실시간 카테고리 연동
  const { categories: realtimeCategories, refetch: refetchCategories } = useRealtimeCategories()
  
  // Supabase에 카테고리가 있으면 사용, 없으면 로컬 데이터 사용
  const categories = realtimeCategories.length > 0 ? realtimeCategories : localCategories

  // 컴포넌트 마운트 시 카테고리 불러오기
  useEffect(() => {
    // Supabase에서 최신 카테고리 불러오기
    refetchCategories()
    
    // 로컬 스토리지에서도 불러옴 (fallback)
    const savedCategories = localStorage.getItem("menuCategories")
    if (savedCategories) {
      try {
        setLocalCategories(JSON.parse(savedCategories))
      } catch {
        setLocalCategories([])
      }
    }
  }, [refetchCategories])

  useEffect(() => {
    if (initialData) {
      // Ensure priceKRW is properly handled as string for input field
      const formattedData = {
        ...initialData,
        priceKRW: initialData.priceKRW !== undefined && initialData.priceKRW !== null 
          ? initialData.priceKRW.toString() 
          : "",
        priceCurrency: initialData.priceCurrency || "KRW",
        priceAmount: initialData.priceAmount !== undefined && initialData.priceAmount !== null 
          ? initialData.priceAmount.toString() 
          : "",
        can_adjust_price: initialData.can_adjust ?? initialData.can_adjust_price ?? false,
        is_combo: initialData.isCombo ?? initialData.is_combo ?? false,
        combo_option_group_ids: Array.isArray(initialData.comboOptionGroupIds)
          ? initialData.comboOptionGroupIds
          : Array.isArray(initialData.combo_option_group_ids)
            ? initialData.combo_option_group_ids
            : [],
      }
      setFormData(formattedData)
      setImagePreview(initialData.image || "")
      // CRITICAL: When loading initialData for editing, we have NOT uploaded a new image yet
      setHasNewImageUpload(false)
      setSelectedFileName("")
      setActiveLanguage("ko")
    } else {
      setFormData(getNewMenuTemplate())
      setImagePreview("")
      setHasNewImageUpload(false)
      setSelectedFileName("")
      setActiveLanguage("ko")
    }
  }, [initialData])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFileName(file.name)
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        // Store the actual base64 data and mark that a new image was uploaded
        setFormData({ ...formData, image: base64String })
        setImagePreview(base64String)
        // CRITICAL: Mark that we have a NEW image so it gets included in the submit
        setHasNewImageUpload(true)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    console.log("[v0] MenuForm handleSubmit called, formData:", JSON.stringify(formData, null, 2))
    console.log("[v0] MenuForm initialData:", initialData ? "editing mode" : "add mode")
    console.log("[v0] hasNewImageUpload:", hasNewImageUpload)
    
    // More flexible validation - only check for truly empty values
    const hasName = formData.nameKo && formData.nameKo.toString().trim() !== ""
    const hasPrice = formData.priceKRW !== "" && formData.priceKRW !== null && formData.priceKRW !== undefined
    const hasCategory = formData.category && formData.category.toString().trim() !== ""
    
    console.log("[v0] Validation: hasName=", hasName, "hasPrice=", hasPrice, "hasCategory=", hasCategory)
    
    if (!hasName || !hasPrice || !hasCategory) {
      alert(t.requiredField + "\n이름: " + hasName + ", 가격: " + hasPrice + ", 카테고리: " + hasCategory)
      return
    }
    
    // Ensure priceKRW is a number and preserve id for editing
    const priceValue = Number(formData.priceKRW) || 0
    
    // CRITICAL: Build submitData with proper image handling
    // 1. If adding a new item (not editing), include the image (base64 or empty)
    // 2. If editing WITHOUT uploading new image, DO NOT include image field so DB preserves it
    // 3. If editing WITH new image upload, include the new base64 image
    const submitData: any = {
      nameKo: formData.nameKo,
      nameEn: formData.nameEn,
      nameJa: formData.nameJa,
      nameZh: formData.nameZh,
      nameEs: formData.nameEs,
      nameTh: formData.nameTh,
      nameVi: formData.nameVi,
      descKo: formData.descKo,
      descEn: formData.descEn,
      descJa: formData.descJa,
      descZh: formData.descZh,
      descEs: formData.descEs,
      descTh: formData.descTh,
      descVi: formData.descVi,
      category: formData.category,
      priceKRW: priceValue,
      priceCurrency: formData.priceCurrency || "KRW",
      priceAmount: priceValue,
      can_adjust_price: formData.can_adjust_price || false,
      // Combo menu: flag + linked global option group ids. appMenuItemToDb persists
      // these into is_combo / combo_option_group_ids.
      isCombo: formData.is_combo || false,
      comboOptionGroupIds: Array.isArray(formData.combo_option_group_ids) ? formData.combo_option_group_ids : [],
      id: initialData?.id || formData.id || Date.now().toString()
    }

    // Persist the item's modifiers (e.g. Staff list) into Supabase alongside the menu item.
    // The ModifierManager buffers edits in localStorage during the session; we read that
    // buffer here (falling back to the DB values already on the item) and include it in the
    // save payload so the modifiers land in the menu_items.modifiers JSONB column and sync
    // across every device. Shape is preserved exactly for the cart/modifier flow.
    submitData.modifiers =
      loadModifiersFromLocalStorage(submitData.id) ??
      (Array.isArray(initialData?.modifiers) ? initialData.modifiers : [])
    
    // CRITICAL IMAGE LOGIC:
    // - Adding new item: Always include image (even if empty string)
    // - Editing without new upload: EXCLUDE image field entirely so DB preserves it
    // - Editing with new upload: Include the new base64 image
    if (!initialData || hasNewImageUpload) {
      // New item OR editing with new image upload
      submitData.image = formData.image || ""
    }
    // When editing without new upload, we intentionally DO NOT set image field
    // This allows the database layer to preserve the existing image
    
    console.log("[v0] MenuForm submitting data:", JSON.stringify(submitData, null, 2))
    
    try {
      onSubmit(submitData)
      alert(initialData ? "메뉴가 수정되었습니다!" : "메뉴가 추가되었습니다!")
      
      // NOTE: Do NOT clear modifier localStorage. Keep it so user can re-edit and see their modifiers.
      // The modifiers data persists across sessions for the same menu item.
      
      if (!initialData) {
        setFormData(getNewMenuTemplate())
        setImagePreview("")
        setHasNewImageUpload(false)
        setSelectedFileName("")
        setActiveLanguage("ko")
      }
    } catch (error: any) {
      console.error("[v0] MenuForm submit error:", error)
      alert("저장 실패: " + (error.message || error))
    }
  }

  const getNameFieldKey = (code: string) => `name${code.charAt(0).toUpperCase()}${code.slice(1).toLowerCase()}`
  const getDescFieldKey = (code: string) => `desc${code.charAt(0).toUpperCase()}${code.slice(1).toLowerCase()}`

  const getCategoryDisplayName = (category: any, lang: string): string => {
    switch (lang) {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Category and Price */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">{t.categoryRequired}</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
          >
            <option value="">{t.selectCategoryPlaceholder}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {getCategoryDisplayName(cat, language)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">{t.price || "가격"}</label>
          <div className="flex gap-2">
            <select
              value={formData.priceCurrency}
              onChange={(e) => setFormData({ ...formData, priceCurrency: e.target.value as "KRW" | "VND" })}
              className="w-24 px-2 py-2 border border-border rounded-md bg-background text-foreground text-sm"
            >
              {PRICE_CURRENCIES.map((curr) => (
                <option key={curr.code} value={curr.code}>
                  {curr.symbol} {curr.code}
                </option>
              ))}
            </select>
            <Input
              type="number"
              value={formData.priceKRW}
              onChange={(e) =>
                setFormData({ ...formData, priceKRW: e.target.value ? Number.parseInt(e.target.value) : "" })
              }
              placeholder={formData.priceCurrency === "KRW" ? "450000" : "200000"}
              className="text-sm flex-1"
            />
          </div>
        </div>
      </div>

      {/* Multilingual Tabs */}
      <div>
        <label className="text-sm font-medium block mb-2">{t.menuNameAndDesc}</label>
        <div className="flex gap-1 mb-3 flex-wrap">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setActiveLanguage(lang.code)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeLanguage === lang.code
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>

        <div className="space-y-3 p-3 border border-border rounded-md bg-muted/20">
          <div>
            <label className="text-sm font-medium">
              {t.menuName} ({LANGUAGES.find((l) => l.code === activeLanguage)?.label})
            </label>
            <Input
              value={formData[getNameFieldKey(activeLanguage) as keyof typeof formData] || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  [getNameFieldKey(activeLanguage)]: e.target.value,
                })
              }
              placeholder={t.menuName}
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              {t.description} ({LANGUAGES.find((l) => l.code === activeLanguage)?.label})
            </label>
            <Textarea
              value={formData[getDescFieldKey(activeLanguage) as keyof typeof formData] || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  [getDescFieldKey(activeLanguage)]: e.target.value,
                })
              }
              placeholder={t.description}
              rows={2}
              className="text-sm"
            />
          </div>
        </div>
      </div>

      {/* Photo Upload */}
      <div>
        <label className="text-sm font-medium block mb-2">{t.photoUpload}</label>
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
          {t.uploadFile || t.photoUpload}
        </button>
        {selectedFileName && <p className="text-xs text-green-600 mt-2">✓ {selectedFileName}</p>}
        <p className="text-xs text-muted-foreground mt-1">{t.chooseImageFile}</p>
      </div>

      {/* Photo Preview */}
      <div>
        <label className="text-sm font-medium">{t.photoPreview}</label>
        <div className="mt-2 relative w-full h-32 bg-muted rounded-md overflow-hidden flex items-center justify-center">
          {imagePreview && imagePreview.trim() !== "" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePreview} alt={t.photoPreview} className="w-full h-full object-cover" />
          ) : (
            // Fallback UI: Clean gray box with camera icon when no image
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <svg
                className="w-12 h-12 text-muted-foreground/30 mb-2"
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
              <p className="text-sm text-muted-foreground/50 font-medium">No image yet</p>
            </div>
          )}
        </div>
      </div>

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

      {/* Combo Menu Section */}
      <div className="border border-border rounded-md p-4 bg-muted/20 space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.is_combo || false}
            onChange={(e) => setFormData({ ...formData, is_combo: e.target.checked })}
            className="w-4 h-4 rounded cursor-pointer"
          />
          <div className="flex-1">
            <p className="text-sm font-medium">콤보 메뉴</p>
            <p className="text-xs text-muted-foreground">
              고객이 주문 시 옵션(예: 소주 → 참이슬)을 선택하도록 합니다.
            </p>
          </div>
        </label>

        {formData.is_combo && (
          <div className="space-y-2 pl-7">
            <p className="text-sm font-medium">연결할 옵션 그룹</p>
            {optionGroups.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                등록된 옵션 그룹이 없습니다. "콤보 옵션" 탭에서 먼저 그룹을 만드세요.
              </p>
            ) : (
              <div className="space-y-1.5">
                {optionGroups.map((group) => {
                  const selected: string[] = Array.isArray(formData.combo_option_group_ids)
                    ? formData.combo_option_group_ids
                    : []
                  const isChecked = selected.includes(group.id)
                  return (
                    <label key={group.id} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...selected, group.id]
                            : selected.filter((id) => id !== group.id)
                          setFormData({ ...formData, combo_option_group_ids: next })
                        }}
                        className="w-4 h-4 rounded cursor-pointer mt-0.5"
                      />
                      <span className="text-sm">
                        <span className="font-medium">{group.name}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          ({group.items.map((it) => it.name).join(", ")})
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modifiers Section - Only show if editing an existing item */}
      {initialData?.id && (
        <div className="border-t pt-4">
          <ModifierManager
            menuItemId={initialData.id}
            initialModifiers={Array.isArray(initialData.modifiers) ? initialData.modifiers : []}
          />
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <Button 
          type="submit" 
          className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={(e) => {
            console.log("[v0] Save button clicked")
          }}
        >
          {initialData ? t.edit : t.add} {initialData ? "(수정)" : "(추가)"}
        </Button>
        <Button type="button" variant="outline" className="flex-1 bg-transparent" onClick={onCancel}>
          {t.cancel}
        </Button>
      </div>
    </form>
  )
}
