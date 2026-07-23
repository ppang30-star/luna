"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2, Upload, X } from "lucide-react"
import { adminTranslations } from "@/lib/admin-translations"
import { useAdminRole } from "@/components/admin/role-context"

interface PromotionImage {
  id: string
  image: string
  title: string
  order: number
}

interface PromotionManagerProps {
  language?: string
}

const DEFAULT_PROMOTIONS: PromotionImage[] = []

export default function PromotionManager({ language = "ko" }: PromotionManagerProps) {
  const t = adminTranslations[language as keyof typeof adminTranslations]
  const { canWrite } = useAdminRole()
  const [promotions, setPromotions] = useState<PromotionImage[]>(DEFAULT_PROMOTIONS)
  const [mounted, setMounted] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem("promotions")
    if (saved) {
      try {
        setPromotions(JSON.parse(saved))
      } catch {
        setPromotions(DEFAULT_PROMOTIONS)
      }
    }
    setMounted(true)
  }, [])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file.name)
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result as string
        const newPromotion: PromotionImage = {
          id: Date.now().toString(),
          image: base64,
          title: "",
          order: promotions.length,
        }
        setPromotions([...promotions, newPromotion])
        setSelectedFile("")
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleUpdateTitle = (id: string, title: string) => {
    setPromotions(promotions.map((p) => (p.id === id ? { ...p, title } : p)))
  }

  const handleDelete = (id: string) => {
    setPromotions(promotions.filter((p) => p.id !== id))
  }

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      const newPromos = [...promotions]
      ;[newPromos[index - 1], newPromos[index]] = [newPromos[index], newPromos[index - 1]]
      setPromotions(newPromos.map((p, i) => ({ ...p, order: i })))
    }
  }

  const handleMoveDown = (index: number) => {
    if (index < promotions.length - 1) {
      const newPromos = [...promotions]
      ;[newPromos[index], newPromos[index + 1]] = [newPromos[index + 1], newPromos[index]]
      setPromotions(newPromos.map((p, i) => ({ ...p, order: i })))
    }
  }

  const handleSave = () => {
    if (!canWrite) return // RBAC: read-only managers cannot save
    console.log("[v0] Saving promotions to localStorage:", {
      count: promotions.length,
      promotions: promotions.map((p) => ({ id: p.id, title: p.title, order: p.order, imageSize: p.image.length })),
    })
    localStorage.setItem("promotions", JSON.stringify(promotions))
    const saved = localStorage.getItem("promotions")
    console.log("[v0] Promotions saved successfully. Verify:", JSON.parse(saved || "[]").length, "items")
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!mounted) return null

  return (
    <div className="space-y-6">
      {canWrite && (
      <Card>
        <CardHeader>
          <CardTitle>{t.promotionTitle}</CardTitle>
          <CardDescription>{t.promotionDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 p-4 bg-card border border-border rounded-lg">
            <Label className="text-sm font-medium text-foreground">{t.promotionImage}</Label>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-[#FF8C00] hover:bg-[#E67E00] text-white font-medium rounded-lg transition-all duration-200 active:scale-95 shadow-sm hover:shadow-md"
              >
                <Upload className="w-5 h-5" />
                {t.uploadImage}
              </button>
              {selectedFile && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                  <span className="text-sm text-green-700 font-medium">{selectedFile}</span>
                  <button
                    onClick={() => {
                      setSelectedFile("")
                      if (fileInputRef.current) fileInputRef.current.value = ""
                    }}
                    className="text-green-600 hover:text-green-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              aria-label="Upload promotion image"
            />
            <p className="text-xs text-muted-foreground">{t.recommendedSize}</p>
          </div>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t.uploadedEventImages}</CardTitle>
          <CardDescription>
            {promotions.length} {t.imagesCount}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {promotions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t.noUploadedImages}</p>
          ) : (
            <div className="space-y-4">
              {promotions.map((promo, index) => (
                <div
                  key={promo.id}
                  className="border rounded-lg p-4 space-y-3 bg-card hover:bg-card/80 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="w-32 h-20 rounded overflow-hidden bg-muted flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={promo.image || "/placeholder.svg"}
                        alt={promo.title || t.uploadedEventImages}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label className="text-xs font-medium">{t.eventTitle}</Label>
                      <Input
                        value={promo.title}
                        onChange={(e) => handleUpdateTitle(promo.id, e.target.value)}
                        placeholder={t.eventTitlePlaceholder}
                        className="text-sm"
                        readOnly={!canWrite}
                        disabled={!canWrite}
                      />
                    </div>
                  </div>
                  {canWrite && (
                    <div className="flex gap-2 justify-end pt-2 border-t">
                      <Button size="sm" variant="outline" onClick={() => handleMoveUp(index)} disabled={index === 0}>
                        {t.moveUp}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === promotions.length - 1}
                      >
                        {t.moveDown}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(promo.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canWrite && (
        <Button onClick={handleSave} size="lg" className="w-full">
          {saved ? t.saved : t.saveSettings}
        </Button>
      )}
    </div>
  )
}
