"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { adminTranslations } from "@/lib/admin-translations"
import { useStoreSettings } from "@/hooks/use-store-settings"
import { Loader2, Check, AlertCircle, Trash2, Plus, ChevronLeft, ChevronRight } from "lucide-react"

interface LocalPageSettings {
  title: string
  subtitle: string
  backgroundImage: string
}

interface PageSettingsProps {
  language?: string
}

export default function PageSettings({ language = "ko" }: PageSettingsProps) {
  const t = adminTranslations[language as keyof typeof adminTranslations]
  
  // Supabase store settings for table numbers (global state)
  const { settings: storeSettings, loading: storeLoading, saveTableNumbers, saveSettings } = useStoreSettings()
  
  // Local page settings (stored in localStorage for backward compatibility)
  const DEFAULT_LOCAL_SETTINGS: LocalPageSettings = {
    title: t.defaultTitle,
    subtitle: t.defaultSubtitle,
    backgroundImage: "",
  }

  const [localSettings, setLocalSettings] = useState<LocalPageSettings>(DEFAULT_LOCAL_SETTINGS)
  const [previewImage, setPreviewImage] = useState<string>("")
  const [saved, setSaved] = useState(false)
  // Title/subtitle DB save state
  const [titleSaving, setTitleSaving] = useState(false)
  const [titleSaved, setTitleSaved] = useState(false)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [tableSaved, setTableSaved] = useState(false)
  const [tableSaving, setTableSaving] = useState(false)
  const [tableError, setTableError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  
  // Table number input state
  const [tableInput, setTableInput] = useState("")
  const [tableNumbers, setTableNumbers] = useState<string[]>([])

  // Load local settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("pageSettings")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setLocalSettings({
          title: parsed.title || DEFAULT_LOCAL_SETTINGS.title,
          subtitle: parsed.subtitle || DEFAULT_LOCAL_SETTINGS.subtitle,
          backgroundImage: parsed.backgroundImage || "",
        })
        if (parsed.backgroundImage) {
          setPreviewImage(parsed.backgroundImage)
        }
      } catch {
        setLocalSettings(DEFAULT_LOCAL_SETTINGS)
      }
    }
    setMounted(true)
  }, [])

  // Sync table numbers from Supabase when loaded
  useEffect(() => {
    if (!storeLoading && storeSettings.table_numbers) {
      setTableNumbers(storeSettings.table_numbers)
    }
  }, [storeLoading, storeSettings.table_numbers])

  // ★ Sync title/subtitle from Supabase (source of truth, shared across all devices).
  // This ensures the inputs reflect what's actually persisted and prevents edits
  // from "reverting" to stale localStorage values.
  useEffect(() => {
    if (!storeLoading) {
      setLocalSettings((prev) => ({
        ...prev,
        title: storeSettings.page_title || prev.title,
        subtitle: storeSettings.page_subtitle || prev.subtitle,
      }))
    }
  }, [storeLoading, storeSettings.page_title, storeSettings.page_subtitle])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result as string
        setLocalSettings({ ...localSettings, backgroundImage: base64 })
        setPreviewImage(base64)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveLocalSettings = () => {
    // Save to localStorage for backward compatibility
    const toSave = {
      ...localSettings,
      tableNumbers: tableNumbers.join(", "), // Keep for backward compatibility
    }
    localStorage.setItem("pageSettings", JSON.stringify(toSave))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ★ Persist title & subtitle to Supabase so changes are permanent and shared
  // across all devices (via the store_settings realtime subscription).
  const handleSaveTitleSubtitle = async () => {
    setTitleSaving(true)
    setTitleError(null)

    const result = await saveSettings({
      page_title: localSettings.title,
      page_subtitle: localSettings.subtitle,
    })

    if (result.success) {
      // Keep localStorage in sync for backward compatibility
      const currentLocal = JSON.parse(localStorage.getItem("pageSettings") || "{}")
      localStorage.setItem(
        "pageSettings",
        JSON.stringify({
          ...currentLocal,
          title: localSettings.title,
          subtitle: localSettings.subtitle,
        }),
      )

      setTitleSaved(true)
      setTimeout(() => setTitleSaved(false), 2000)
    } else {
      setTitleError(result.error || "저장에 실패했습니다")
    }

    setTitleSaving(false)
  }

  const handleReset = () => {
    setLocalSettings(DEFAULT_LOCAL_SETTINGS)
    setPreviewImage("")
    localStorage.removeItem("pageSettings")
    setSaved(false)
  }

  // Add table number
  const handleAddTable = () => {
    const trimmed = tableInput.trim()
    if (trimmed && !tableNumbers.includes(trimmed)) {
      setTableNumbers([...tableNumbers, trimmed])
      setTableInput("")
    }
  }

  // Remove table number
  const handleRemoveTable = (table: string) => {
    setTableNumbers(tableNumbers.filter((t) => t !== table))
  }

  // Move a table left/right (swap with adjacent) and persist the new order
  const handleMoveTable = async (index: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= tableNumbers.length) return

    const reordered = [...tableNumbers]
    ;[reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]]
    setTableNumbers(reordered)

    // Save the new order to the database (shared across all devices)
    const result = await saveTableNumbers(reordered)
    if (!result.success) {
      setTableError(result.error || "순서 저장에 실패했습니다")
    }
  }

  // Save table numbers to Supabase (global state)
  const handleSaveTableNumbers = async () => {
    setTableSaving(true)
    setTableError(null)
    
    const result = await saveTableNumbers(tableNumbers)
    
    if (result.success) {
      // Also save to localStorage for backward compatibility
      const currentLocal = JSON.parse(localStorage.getItem("pageSettings") || "{}")
      localStorage.setItem("pageSettings", JSON.stringify({
        ...currentLocal,
        tableNumbers: tableNumbers.join(", "),
      }))
      
      setTableSaved(true)
      setTimeout(() => setTableSaved(false), 2000)
    } else {
      setTableError(result.error || "저장에 실패했습니다")
    }
    
    setTableSaving(false)
  }

  // Add multiple tables at once (comma-separated)
  const handleBulkAddTables = (input: string) => {
    const newTables = input
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t && !tableNumbers.includes(t))
    
    if (newTables.length > 0) {
      setTableNumbers([...tableNumbers, ...newTables])
    }
  }

  if (!mounted) return null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t.editPageTitle}</CardTitle>
          <CardDescription>{t.editPageDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t.title}</Label>
            <Input
              id="title"
              value={localSettings.title}
              onChange={(e) => setLocalSettings({ ...localSettings, title: e.target.value })}
              placeholder={t.titlePlaceholder}
              className="text-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subtitle">{t.subtitle}</Label>
            <Input
              id="subtitle"
              value={localSettings.subtitle}
              onChange={(e) => setLocalSettings({ ...localSettings, subtitle: e.target.value })}
              placeholder={t.subtitlePlaceholder}
            />
          </div>

          {/* Error display */}
          {titleError && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{titleError}</span>
            </div>
          )}

          {/* ★ Save button directly below the title & subtitle inputs */}
          <Button onClick={handleSaveTitleSubtitle} className="w-full" disabled={titleSaving}>
            {titleSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                저장 중...
              </>
            ) : titleSaved ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                저장됨! (모든 기기에 반영)
              </>
            ) : (
              t.saveSettings
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t.tableManagement || "테이블 관리"}
            <Badge variant="secondary" className="text-xs">
              전체 기기 공유
            </Badge>
          </CardTitle>
          <CardDescription>
            {t.tableManagementDesc || "매장 테이블 번호를 설정하세요. 여기서 설정한 테이블 목록은 모든 태블릿/기기에서 공유됩니다."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {storeLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>테이블 목록 불러오는 중...</span>
            </div>
          ) : (
            <>
              {/* Add single table */}
              <div className="space-y-2">
                <Label htmlFor="tableInput">{t.tableNumbers || "테이블 번호 추가"}</Label>
                <div className="flex gap-2">
                  <Input
                    id="tableInput"
                    value={tableInput}
                    onChange={(e) => setTableInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddTable()
                      }
                    }}
                    placeholder="예: VIP1, 1번, A-1"
                    className="font-mono flex-1"
                  />
                  <Button onClick={handleAddTable} variant="outline" size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter 키 또는 + 버튼으로 추가. 쉼표(,)로 여러 개 한번에 입력 가능
                </p>
              </div>

              {/* Bulk add */}
              <div className="space-y-2">
                <Label>한번에 여러 테이블 추가</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="예: 1번, 2번, 3번, VIP1, VIP2"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleBulkAddTables((e.target as HTMLInputElement).value)
                        ;(e.target as HTMLInputElement).value = ""
                      }
                    }}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Current table list */}
              <div className="space-y-2">
                <Label>현재 테이블 목록 ({tableNumbers.length}개)</Label>
                {tableNumbers.length > 0 ? (
                  <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg min-h-[60px]">
                    {tableNumbers.map((table, index) => (
                      <Badge
                        key={table}
                        variant="secondary"
                        className="px-2 py-1.5 text-sm font-medium flex items-center gap-1 group"
                      >
                        <button
                          onClick={() => handleMoveTable(index, "left")}
                          disabled={index === 0}
                          aria-label="왼쪽으로 이동"
                          className="opacity-50 hover:opacity-100 transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <span className="px-0.5">{table}</span>
                        <button
                          onClick={() => handleMoveTable(index, "right")}
                          disabled={index === tableNumbers.length - 1}
                          aria-label="오른쪽으로 이동"
                          className="opacity-50 hover:opacity-100 transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveTable(table)}
                          aria-label="삭제"
                          className="ml-0.5 opacity-50 hover:opacity-100 hover:text-destructive transition-opacity"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-muted/50 rounded-lg text-center text-muted-foreground text-sm">
                    등록된 테이블이 없습니다. 위에서 테이블 번호를 추가하세요.
                  </div>
                )}
              </div>

              {/* Error display */}
              {tableError && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{tableError}</span>
                </div>
              )}

              {/* Save button */}
              <Button
                onClick={handleSaveTableNumbers}
                variant="default"
                className="w-full"
                disabled={tableSaving}
              >
                {tableSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    저장 중...
                  </>
                ) : tableSaved ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    저장됨! (모든 기기에 반영)
                  </>
                ) : (
                  "테이블 목록 저장 (전체 기기 공유)"
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.editBackgroundImage}</CardTitle>
          <CardDescription>{t.editBackgroundImageDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backgroundImage">{t.backgroundImageUpload}</Label>
            <Input
              id="backgroundImage"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">{t.recommendedImageSize}</p>
          </div>

          {previewImage && (
            <div className="space-y-2">
              <Label>{t.preview}</Label>
              <div
                className="w-full h-48 rounded-lg border border-border bg-cover bg-center"
                style={{ backgroundImage: `url(${previewImage})` }}
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setLocalSettings({ ...localSettings, backgroundImage: "" })
                  setPreviewImage("")
                }}
              >
                {t.removeImage}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={handleSaveLocalSettings} className="flex-1" size="lg">
          {saved ? t.saved : t.saveSettings}
        </Button>
        <Button onClick={handleReset} variant="outline" size="lg">
          {t.reset}
        </Button>
      </div>
    </div>
  )
}
