"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import MenuForm from "./menu-form"
import AddMenuModal from "./add-menu-modal"
import { currencies } from "@/lib/currencies"
import { adminTranslations } from "@/lib/admin-translations"
import { useRealtimeCategories } from "@/hooks/use-realtime-menu"

interface MenuItemData {
  id: string
  category: string
  nameKo: string
  nameEn: string
  nameJa: string
  nameZh: string
  nameEs: string
  nameTh: string
  nameVi: string
  descKo: string
  descEn: string
  descJa: string
  descZh: string
  descEs: string
  descTh: string
  descVi: string
  priceKRW: number
  priceCurrency?: string
  priceAmount?: number
  image: string
}

interface AdminMenuManagerProps {
  menuItems: MenuItemData[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onAdd: () => void
  editingItem: MenuItemData | null
  onSubmit: (item: any) => Promise<void> | void
  language?: string
}

export default function AdminMenuManager({
  menuItems,
  onEdit,
  onDelete,
  onAdd,
  editingItem,
  onSubmit,
  language = "ko",
}: AdminMenuManagerProps) {
  const t = adminTranslations[language as keyof typeof adminTranslations]
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [localCategories, setLocalCategories] = useState<Record<string, any>[]>([])
  
  // Supabase 실시간 연동
  const { categories: realtimeCategories } = useRealtimeCategories()
  
  // Supabase에 데이터가 있으면 사용, 없으면 로컬 데이터 사용
  const categories = realtimeCategories.length > 0 ? realtimeCategories : localCategories
  const [hoverItemId, setHoverItemId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    // Supabase에 데이터가 없을 때만 로컬 스토리지에서 불러옴
    const savedCategories = localStorage.getItem("menuCategories")
    if (savedCategories) {
      try {
        const categoryList = JSON.parse(savedCategories)
        setLocalCategories(categoryList)
        if (!selectedCategory && categoryList.length > 0) {
          setSelectedCategory(categoryList[0].id)
        }
      } catch {
        setLocalCategories([])
      }
    }
    setMounted(true)
  }, [selectedCategory])
  
  // Supabase에서 카테고리를 가져오면 첫 번째 카테고리 선택
  useEffect(() => {
    if (realtimeCategories.length > 0 && !selectedCategory) {
      setSelectedCategory(realtimeCategories[0].id)
    }
  }, [realtimeCategories, selectedCategory])

  if (!mounted) return null

  const getCategoryName = (category: any): string => {
    if (!category) return ""
    switch (language) {
      case "ko":
        return category.ko || category.name || ""
      case "en":
        return category.en || category.name || ""
      case "ja":
        return category.ja || category.ko || ""
      case "zh":
        return category.zh || category.ko || ""
      case "es":
        return category.es || category.ko || ""
      case "th":
        return category.th || category.ko || ""
      case "vi":
        return category.vi || category.ko || ""
      default:
        return category.ko || ""
    }
  }

  const filteredItems = selectedCategory ? menuItems.filter((item) => item.category === selectedCategory) : []
  const currencyInfo = currencies["KRW"]

  const handleFormSubmit = async (item: any) => {
    console.log("[v0] AdminMenuManager: handleFormSubmit called with:", JSON.stringify(item, null, 2))
    try {
      await onSubmit(item)
      console.log("[v0] AdminMenuManager: onSubmit completed successfully")
      setIsFormOpen(false)
    } catch (error: any) {
      console.error("[v0] AdminMenuManager: Error in handleFormSubmit:", error.message || error)
      // Don't close form on error so user can retry
    }
  }

  const handleFormCancel = () => {
    console.log("[v0] AdminMenuManager: handleFormCancel called")
    setIsFormOpen(false)
  }

  const handleModalSave = async (menuData: any) => {
    try {
      console.log("[v0] AdminMenuManager: handleModalSave called with:", JSON.stringify(menuData, null, 2))
      await onSubmit(menuData)
      setIsModalOpen(false)
    } catch (error: any) {
      console.error("[v0] AdminMenuManager: Error in handleModalSave:", error.message || error)
      throw error // Re-throw to let modal handle the error
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-foreground">{t.selectCategory}</h2>
        <div className="flex gap-2">
          <Button onClick={() => setIsModalOpen(true)} className="bg-[#FF8C00] hover:bg-[#E67E00] text-white">
            + {t.addNewMenu}
          </Button>
          <Button onClick={() => setIsFormOpen(!isFormOpen)} variant="outline">
            {isFormOpen ? t.closeForm : t.addNewMenu + " (Form)"}
          </Button>
        </div>
      </div>

      <AddMenuModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleModalSave}
        language={language}
      />

      <div className="flex gap-2 flex-wrap border-b border-border pb-4">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-t-lg font-medium transition-all duration-200 ${
              selectedCategory === cat.id
                ? "bg-primary text-primary-foreground border-b-2 border-primary"
                : "bg-muted text-foreground hover:bg-muted/80"
            }`}
          >
            {getCategoryName(cat)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>{editingItem ? t.editMenu : t.addNewMenu}</CardTitle>
              <CardDescription>
                {selectedCategory
                  ? `${getCategoryName(categories.find((c) => c.id === selectedCategory))} ${t.category}`
                  : t.selectCategory}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(isFormOpen || editingItem) && selectedCategory && (
                <MenuForm
                  onSubmit={(item) => {
                    // Keep original category if editing, otherwise use selected category
                    const finalCategory = editingItem?.category || item.category || selectedCategory
                    console.log("[v0] AdminMenuManager: Form submitted, category:", finalCategory)
                    handleFormSubmit({ ...item, category: finalCategory })
                  }}
                  initialData={editingItem ? { ...editingItem, category: editingItem.category || selectedCategory } : undefined}
                  onCancel={handleFormCancel}
                  language={language}
                />
              )}
              {!selectedCategory && (
                <div className="text-center text-muted-foreground py-8">
                  <p>{t.selectCategoryToAddMenu}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{`${t.menuItems} (${filteredItems.length}개)`}</CardTitle>
              <CardDescription>{t.hoverToEditOrDelete}</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredItems.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">{t.noMenuInCategory}</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="relative group"
                      onMouseEnter={() => setHoverItemId(item.id)}
                      onMouseLeave={() => setHoverItemId(null)}
                    >
                      <div className="relative h-64 bg-muted rounded-lg overflow-hidden">
                        {item.image && (
                          <img
                            src={item.image || "/placeholder.svg"}
                            alt={item.nameKo}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200" />
                      </div>
                      <div className="p-3">
                        <h3 className="font-bold text-sm text-foreground">
                          {item[`name${language.charAt(0).toUpperCase() + language.slice(1)}` as keyof typeof item] ||
                            item.nameKo}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {item[`desc${language.charAt(0).toUpperCase() + language.slice(1)}` as keyof typeof item] ||
                            item.descKo}
                        </p>
                        <p className="text-sm font-semibold text-primary mt-2">
                          {item.priceCurrency === "VND" 
                            ? `${(item.priceAmount || item.priceKRW).toLocaleString("vi-VN")} VND`
                            : `₩${item.priceKRW.toLocaleString("ko-KR")}`
                          }
                        </p>
                      </div>

                      {hoverItemId === item.id && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 rounded-lg">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              onEdit(item.id)
                              setIsFormOpen(true)
                            }}
                            className="bg-white text-black hover:bg-gray-200"
                          >
                            {t.edit}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm(t.confirmDelete)) {
                                onDelete(item.id)
                              }
                            }}
                          >
                            {t.delete}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
