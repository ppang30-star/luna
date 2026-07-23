"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import MenuForm from "./menu-form"
import { adminTranslations } from "@/lib/admin-translations"
import { useRealtimeCategories, useRealtimeMenuItems } from "@/hooks/use-realtime-menu"
import { addCategory, updateCategory, deleteCategory, updateCategoryOrder, addMenuItem, updateMenuItem, deleteMenuItem } from "@/lib/supabase/actions"
import { isSupabaseConfigured } from "@/lib/supabase/client"
import { useAdminRole } from "@/components/admin/role-context"

interface Category {
  id: string
  ko: string
  en: string
  ja: string
  zh: string
  es: string
  th: string
  vi: string
  isVisible?: boolean
}

interface MenuItem {
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

interface CategoryManagerProps {
  onCategoriesChange?: (categories: Category[]) => void
  language?: string
}

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

const getCategoryDisplayName = (category: Category, lang: string): string => {
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

export default function CategoryManager({ onCategoriesChange, language = "ko" }: CategoryManagerProps) {
  const [localCategories, setLocalCategories] = useState<Category[]>(DEFAULT_CATEGORIES)
  const [localMenuItems, setLocalMenuItems] = useState<MenuItem[]>([])
  
  // Supabase 환경 변수가 설정되어 있으면 항상 Supabase 사용 (빈 테이블이어도)
  const [isSupabaseEnabled, setIsSupabaseEnabled] = useState(false)
  
  // Supabase 실시간 연동
  const { categories: realtimeCategories, loading: catLoading, refetch: refetchCategories } = useRealtimeCategories()
  const { menuItems: realtimeMenuItems, loading: menuLoading, refetch: refetchMenuItems } = useRealtimeMenuItems()
  
  // Supabase가 활성화되면 realtime 데이터 사용, 아니면 로컬 데이터 사용
  const categories = isSupabaseEnabled ? realtimeCategories : localCategories
  const menuItems = isSupabaseEnabled ? realtimeMenuItems : localMenuItems
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryNames, setEditingCategoryNames] = useState({
    ko: "",
    en: "",
    ja: "",
    zh: "",
    es: "",
    th: "",
    vi: "",
  })
  const [editingCategoryId2, setEditingCategoryId2] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<Category>(DEFAULT_CATEGORIES[0])
  const [isAddingMenu, setIsAddingMenu] = useState(false)
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const t = adminTranslations[language as keyof typeof adminTranslations]
  const { canWrite } = useAdminRole()

  // Supabase 환경 변수 확인 (클라이언트에서만 실행)
  useEffect(() => {
    const configured = isSupabaseConfigured()
    setIsSupabaseEnabled(configured)
    console.log("[v0] CategoryManager: Supabase configured:", configured)
  }, [])

  useEffect(() => {
    // 로컬 스토리지에서 불러옴 (Supabase 미연결 시 fallback)
    const savedCategories = localStorage.getItem("menuCategories")
    if (savedCategories) {
      try {
        setLocalCategories(JSON.parse(savedCategories))
      } catch {
        setLocalCategories(DEFAULT_CATEGORIES)
      }
    }

    const savedMenuItems = localStorage.getItem("menuItems")
    if (savedMenuItems) {
      try {
        setLocalMenuItems(JSON.parse(savedMenuItems))
      } catch {
        setLocalMenuItems([])
      }
    }
    setMounted(true)
  }, [])

  const saveCategories = (updatedCategories: Category[]) => {
    setLocalCategories(updatedCategories)
    localStorage.setItem("menuCategories", JSON.stringify(updatedCategories))
  }

  const saveMenuItems = (updatedItems: MenuItem[]) => {
    setLocalMenuItems(updatedItems)
    localStorage.setItem("menuItems", JSON.stringify(updatedItems))
  }

  const handleEditCategory = (category: Category) => {
    setEditingCategoryId(category.id)
    setEditingCategoryNames({
      ko: category.ko,
      en: category.en,
      ja: category.ja,
      zh: category.zh,
      es: category.es,
      th: category.th,
      vi: category.vi,
    })
    setEditingCategoryId2(category.id)
  }

  const handleSaveCategory = async () => {
    if (editingCategoryId) {
      const oldId = editingCategoryId
      const newId = editingCategoryId2 || editingCategoryId

      // Preserve the current visibility flag while editing names/id
      const currentCategory = categories.find((c) => c.id === oldId)

      const updatedCategory = {
        id: newId,
        ko: editingCategoryNames.ko,
        en: editingCategoryNames.en,
        ja: editingCategoryNames.ja,
        zh: editingCategoryNames.zh,
        es: editingCategoryNames.es,
        th: editingCategoryNames.th,
        vi: editingCategoryNames.vi,
        isVisible: currentCategory?.isVisible !== false,
      }

      if (isSupabaseEnabled) {
        try {
          console.log("[v0] Updating category in Supabase:", updatedCategory)
          // Supabase 업데이트
          await updateCategory(oldId, updatedCategory)
          // 전체 목록 다시 가져오기
          await refetchCategories()
        } catch (error) {
          console.error("[v0] Error updating category:", error)
          // 에러 시 로컬 fallback
          const updated = categories.map((c) =>
            c.id === oldId ? { ...c, ...updatedCategory } : c,
          )
          saveCategories(updated)
        }
      } else {
        // 로컬 스토리지 업데이트
        const updated = categories.map((c) =>
          c.id === oldId ? { ...c, ...updatedCategory } : c,
        )

        if (oldId !== newId) {
          const updatedMenuItems = menuItems.map((m) => (m.category === oldId ? { ...m, category: newId } : m))
          saveMenuItems(updatedMenuItems)
        }

        saveCategories(updated)
      }

      setEditingCategoryId(null)
      setEditingCategoryNames({ ko: "", en: "", ja: "", zh: "", es: "", th: "", vi: "" })
    }
  }

  const handleCancelCategory = () => {
    setEditingCategoryId(null)
    setEditingCategoryNames({ ko: "", en: "", ja: "", zh: "", es: "", th: "", vi: "" })
  }

  const handleToggleVisibility = async (category: Category, visible: boolean) => {
    const updatedCategory = { ...category, isVisible: visible }

    if (isSupabaseEnabled) {
      try {
        console.log("[v0] Toggling category visibility in Supabase:", category.id, visible)
        await updateCategory(category.id, updatedCategory)
        await refetchCategories()
      } catch (error) {
        console.error("[v0] Error toggling category visibility:", error)
        // Fallback to local update on error
        saveCategories(categories.map((c) => (c.id === category.id ? { ...c, isVisible: visible } : c)))
      }
    } else {
      saveCategories(categories.map((c) => (c.id === category.id ? { ...c, isVisible: visible } : c)))
    }
  }

  const handleAddCategory = async () => {
    const newId = `category_${Date.now()}`
    const newCategory: Category = {
      id: newId,
      ko: "",
      en: "",
      ja: "",
      zh: "",
      es: "",
      th: "",
      vi: "",
    }
    
    if (isSupabaseEnabled) {
      try {
        console.log("[v0] Adding category to Supabase:", newCategory)
        // Supabase에 추가
        const result = await addCategory(newCategory, categories.length)
        console.log("[v0] Add category result:", result)
        // Supabase 연결 시 refetch로 전체 목록을 다시 가져옴
        await refetchCategories()
        // 새로 추가된 카테고리를 편집 모드로 전환
        handleEditCategory(newCategory)
      } catch (error) {
        console.error("[v0] Error adding category:", error)
        // 에러 시 로컬 fallback
        saveCategories([...categories, newCategory])
        handleEditCategory(newCategory)
      }
    } else {
      // 로컬 스토리지 사용
      saveCategories([...categories, newCategory])
      handleEditCategory(newCategory)
    }
    
    if (onCategoriesChange) {
      onCategoriesChange([...categories, newCategory])
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (confirm(t.confirmDeleteCategory)) {
      if (isSupabaseEnabled) {
        try {
          // Supabase에서 삭제
          await deleteCategory(id)
          // 전체 목록 다시 가져오기
          await refetchCategories()
        } catch (error) {
          console.error("[v0] Error deleting category:", error)
          // 에러 시 로컬 fallback
          saveCategories(categories.filter((c) => c.id !== id))
        }
      } else {
        // 로컬 스토리지에서 삭제
        saveCategories(categories.filter((c) => c.id !== id))
        saveMenuItems(menuItems.filter((m) => m.category !== id))
      }
      
      setSelectedCategory(categories[0] || DEFAULT_CATEGORIES[0])
      if (onCategoriesChange) {
        const updatedCategories = categories.filter((cat) => cat.id !== id)
        onCategoriesChange(updatedCategories)
      }
    }
  }

  const handleAddMenuItem = async (item: any) => {
    console.log("[v0] handleAddMenuItem called, isSupabaseEnabled:", isSupabaseEnabled, "item:", item)
    
    if (isSupabaseEnabled) {
      try {
        if (editingMenuId) {
          console.log("[v0] Updating menu item in Supabase:", editingMenuId)
          // Supabase 업데이트
          await updateMenuItem(editingMenuId, { ...item, id: editingMenuId })
          setEditingMenuId(null)
        } else {
          const newId = Date.now().toString()
          console.log("[v0] Adding menu item to Supabase:", newId)
          // Supabase에 추가
          const result = await addMenuItem({ ...item, id: newId }, menuItems.length)
          console.log("[v0] Add menu item result:", result)
        }
        // 전체 목록 다시 가져오기
        await refetchMenuItems()
      } catch (error) {
        console.error("[v0] Error saving menu item:", error)
        // 에러 시 로컬 fallback
        if (editingMenuId) {
          saveMenuItems(menuItems.map((m) => (m.id === editingMenuId ? { ...item, id: editingMenuId } : m)))
          setEditingMenuId(null)
        } else {
          saveMenuItems([...menuItems, { ...item, id: Date.now().toString() }])
        }
      }
    } else {
      // 로컬 스토리지 사용
      if (editingMenuId) {
        saveMenuItems(menuItems.map((m) => (m.id === editingMenuId ? { ...item, id: editingMenuId } : m)))
        setEditingMenuId(null)
      } else {
        saveMenuItems([...menuItems, { ...item, id: Date.now().toString() }])
      }
    }
    setIsAddingMenu(false)
  }

  const handleEditMenuItem = (id: string) => {
    setEditingMenuId(id)
    setIsAddingMenu(true)
  }

  const handleDeleteMenuItem = async (id: string) => {
    if (confirm(t.confirmDelete)) {
      if (isSupabaseEnabled) {
        try {
          // Supabase에서 삭제
          await deleteMenuItem(id)
          // 전체 목록 다시 가져오기
          await refetchMenuItems()
        } catch (error) {
          console.error("[v0] Error deleting menu item:", error)
          // 에러 시 로컬 fallback
          saveMenuItems(menuItems.filter((m) => m.id !== id))
        }
      } else {
        // 로컬 스토리지에서 삭제
        saveMenuItems(menuItems.filter((m) => m.id !== id))
      }
    }
  }

  const handleMoveCategory = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= categories.length) return

    const updatedCategories = [...categories]
    ;[updatedCategories[index], updatedCategories[newIndex]] = [updatedCategories[newIndex], updatedCategories[index]]
    
    if (isSupabaseEnabled) {
      try {
        // Supabase 순서 업데이트
        await updateCategoryOrder(updatedCategories)
        // 전체 목록 다시 가져오기
        await refetchCategories()
      } catch (error) {
        console.error("[v0] Error updating category order:", error)
        // 에러 시 로컬 fallback
        saveCategories(updatedCategories)
      }
    } else {
      // 로컬 스토리지 업데이트
      saveCategories(updatedCategories)
    }
  }

  const categoryMenuItems = menuItems.filter((m) => m.category === selectedCategory.id)
  const editingMenuItem = editingMenuId ? menuItems.find((m) => m.id === editingMenuId) : null

  if (!mounted) return null

  return (
    <Tabs defaultValue="categories" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="categories">{t.categoryManagement}</TabsTrigger>
        <TabsTrigger value="menus">{t.menuManagement}</TabsTrigger>
      </TabsList>

      <TabsContent value="categories">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t.categoryManagement}</CardTitle>
                <CardDescription>{t.categoryManagementDesc}</CardDescription>
              </div>
              {canWrite && (
                <Button onClick={handleAddCategory} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {t.addNewCategory}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.order}</TableHead>
                    <TableHead>{t.id}</TableHead>
                    <TableHead>{t.categoryName}</TableHead>
                    <TableHead className="text-center">노출</TableHead>
                    <TableHead>{t.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category, index) => (
                    <TableRow key={category.id}>
                      <TableCell className="text-center font-semibold text-muted-foreground w-16">
                        <div className="flex gap-1 justify-center">
                          {canWrite && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={index === 0}
                              onClick={() => handleMoveCategory(index, "up")}
                              className="h-6 w-6 p-0"
                            >
                              ↑
                            </Button>
                          )}
                          <span className="w-6 text-center">{index + 1}</span>
                          {canWrite && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={index === categories.length - 1}
                              onClick={() => handleMoveCategory(index, "down")}
                              className="h-6 w-6 p-0"
                            >
                              ↓
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      {editingCategoryId === category.id ? (
                        <>
                          <TableCell className="font-mono text-sm">
                            <Input
                              value={editingCategoryId2}
                              onChange={(e) => setEditingCategoryId2(e.target.value)}
                              size={12}
                              className="font-mono text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Tabs defaultValue="ko" className="w-full">
                              <TabsList className="grid w-full grid-cols-7 h-8 mb-2">
                                <TabsTrigger value="ko" className="text-xs px-1 py-0">
                                  한국어
                                </TabsTrigger>
                                <TabsTrigger value="en" className="text-xs px-1 py-0">
                                  English
                                </TabsTrigger>
                                <TabsTrigger value="ja" className="text-xs px-1 py-0">
                                  日本語
                                </TabsTrigger>
                                <TabsTrigger value="zh" className="text-xs px-1 py-0">
                                  中文
                                </TabsTrigger>
                                <TabsTrigger value="es" className="text-xs px-1 py-0">
                                  Español
                                </TabsTrigger>
                                <TabsTrigger value="th" className="text-xs px-1 py-0">
                                  ไทย
                                </TabsTrigger>
                                <TabsTrigger value="vi" className="text-xs px-1 py-0">
                                  Tiếng Việt
                                </TabsTrigger>
                              </TabsList>
                              <TabsContent value="ko">
                                <Input
                                  value={editingCategoryNames.ko}
                                  onChange={(e) =>
                                    setEditingCategoryNames({ ...editingCategoryNames, ko: e.target.value })
                                  }
                                  placeholder="한국어 카테고리명"
                                />
                              </TabsContent>
                              <TabsContent value="en">
                                <Input
                                  value={editingCategoryNames.en}
                                  onChange={(e) =>
                                    setEditingCategoryNames({ ...editingCategoryNames, en: e.target.value })
                                  }
                                  placeholder="English category name"
                                />
                              </TabsContent>
                              <TabsContent value="ja">
                                <Input
                                  value={editingCategoryNames.ja}
                                  onChange={(e) =>
                                    setEditingCategoryNames({ ...editingCategoryNames, ja: e.target.value })
                                  }
                                  placeholder="日本語カテゴリ名"
                                />
                              </TabsContent>
                              <TabsContent value="zh">
                                <Input
                                  value={editingCategoryNames.zh}
                                  onChange={(e) =>
                                    setEditingCategoryNames({ ...editingCategoryNames, zh: e.target.value })
                                  }
                                  placeholder="中文分类名"
                                />
                              </TabsContent>
                              <TabsContent value="es">
                                <Input
                                  value={editingCategoryNames.es}
                                  onChange={(e) =>
                                    setEditingCategoryNames({ ...editingCategoryNames, es: e.target.value })
                                  }
                                  placeholder="Nombre categoría"
                                />
                              </TabsContent>
                              <TabsContent value="th">
                                <Input
                                  value={editingCategoryNames.th}
                                  onChange={(e) =>
                                    setEditingCategoryNames({ ...editingCategoryNames, th: e.target.value })
                                  }
                                  placeholder="ชื่อหมวดหมู่"
                                />
                              </TabsContent>
                              <TabsContent value="vi">
                                <Input
                                  value={editingCategoryNames.vi}
                                  onChange={(e) =>
                                    setEditingCategoryNames({ ...editingCategoryNames, vi: e.target.value })
                                  }
                                  placeholder="Tên danh mục"
                                />
                              </TabsContent>
                            </Tabs>
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={category.isVisible !== false}
                              onCheckedChange={(checked) => handleToggleVisibility(category, checked)}
                              aria-label="카테고리 노출 여부"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={handleSaveCategory}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                저장
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCancelCategory}>
                                취소
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-mono text-sm">{category.id}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="text-sm font-semibold">{category.ko}</p>
                              <p className="text-xs text-muted-foreground">
                                {category.en && `EN: ${category.en}`}
                                {category.ja && ` | JA: ${category.ja}`}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              {canWrite ? (
                                <Switch
                                  checked={category.isVisible !== false}
                                  onCheckedChange={(checked) => handleToggleVisibility(category, checked)}
                                  aria-label="카테고리 노출 여부"
                                />
                              ) : null}
                              <span className="text-xs text-muted-foreground">
                                {category.isVisible !== false ? "노출" : "숨김"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {canWrite ? (
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleEditCategory(category)}>
                                  수정
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDeleteCategory(category.id)}>
                                  삭제
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">읽기 전용</span>
                            )}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="menus">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {canWrite && (
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>{editingMenuItem ? "메뉴 수정" : "새 메뉴 추가"}</CardTitle>
                <CardDescription>
                  {selectedCategory && selectedCategory.ko
                    ? `[${selectedCategory.ko}] 카테고리`
                    : "카테고리를 선택해주세요"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isAddingMenu ? (
                  <MenuForm
                    onSubmit={handleAddMenuItem}
                    initialData={
                      editingMenuItem
                        ? {
                            ...editingMenuItem,
                            category: selectedCategory.id,
                          }
                        : { category: selectedCategory.id }
                    }
                    onCancel={() => {
                      setEditingMenuId(null)
                      setIsAddingMenu(false)
                    }}
                  />
                ) : (
                  <Button
                    onClick={() => setIsAddingMenu(true)}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    새 메뉴 추가
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
          )}

          <div className={`${canWrite ? "lg:col-span-2" : "lg:col-span-3"} space-y-6`}>
            <Card>
              <CardHeader>
                <CardTitle>{t.selectCategory}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((cat) => (
                    <Button
                      key={cat.id}
                      variant={selectedCategory.id === cat.id ? "default" : "outline"}
                      onClick={() => {
                        setSelectedCategory(cat)
                        setIsAddingMenu(false)
                        setEditingMenuId(null)
                      }}
                      className="justify-start"
                    >
                      {getCategoryDisplayName(cat, language)}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedCategory ? getCategoryDisplayName(selectedCategory, language) : t.selectCategory}{" "}
                  {t.menuList}
                </CardTitle>
                <CardDescription>
                  {t.total} {categoryMenuItems.length}
                  {t.menuItems}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {categoryMenuItems.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">이 카테고리에 메뉴가 없습니다</div>
                ) : (
                  <div className="space-y-4">
                    {categoryMenuItems.map((item) => (
                      <div key={item.id} className="border border-border rounded-lg p-4">
                        <div className="flex gap-4">
                          {item.image && (
                            <div className="w-24 h-24 bg-muted rounded-md overflow-hidden flex-shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.image || "/placeholder.svg"}
                                alt={item.nameKo}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{item.nameKo}</h3>
                            {item.descKo && <p className="text-sm text-muted-foreground mt-1">{item.descKo}</p>}
                            <div className="mt-2 flex items-center gap-4">
                              <span className="text-lg font-bold text-primary">
                                ₩{item.priceKRW.toLocaleString("ko-KR")}
                              </span>
                          {canWrite && (
                            <div className="flex gap-2 ml-auto">
                              <Button size="sm" variant="outline" onClick={() => handleEditMenuItem(item.id)}>
                                수정
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleDeleteMenuItem(item.id)}>
                                삭제
                              </Button>
                            </div>
                          )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}
