'use client'

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import AdminMenuManager from "@/components/admin/admin-menu-manager"
import CategoryManager from "@/components/admin/category-manager"
import AuthGuard from "@/components/admin/auth-guard"
import ExchangeRateManager from "@/components/admin/exchange-rate-manager"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3 } from "lucide-react"
import PageSettings from "@/components/admin/page-settings"
import PromotionManager from "@/components/admin/promotion-manager"
import { adminTranslations, type AdminLanguage } from "@/lib/admin-translations"
import { useRealtimeMenu } from "@/hooks/use-realtime-menu"
import { addMenuItem, updateMenuItem, deleteMenuItem } from "@/lib/supabase/actions"
import { autoTranslateMenuFields, normalizeDescription } from "@/lib/translate"
import { isSupabaseConfigured } from "@/lib/supabase/client"
import ManagersManagement from "@/components/admin/managers-management"
import PriceModificationLog from "@/components/admin/price-modification-log"
import StaffPayrollReport from "@/components/admin/staff-payroll-report"
import OptionGroupManager from "@/components/admin/option-group-manager"
import ItemStatisticsReport from "@/components/admin/item-statistics-report"
import { initializeAllTables } from "@/lib/supabase/initialize-managers-table"

// 직원 정산 탭 라벨 (관리자 언어별)
const payrollTabLabels: Record<AdminLanguage, string> = {
  ko: "직원 정산",
  en: "Staff Payroll",
  vi: "Bảng lương NV",
  ja: "スタッフ精算",
  zh: "员工结算",
  es: "Nómina",
  th: "เงินเดือน",
}

export default function AdminPage() {
  const router = useRouter()
  const [localMenuItems, setLocalMenuItems] = useState<any[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [adminLanguage, setAdminLanguage] = useState<AdminLanguage>("ko")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  // Supabase 환경 변수가 설정되어 있으면 항상 Supabase 사용 (빈 테이블이어도)
  const [isSupabaseEnabled, setIsSupabaseEnabled] = useState(false)
  
  // Supabase 실시간 연동
  const { menuItems: realtimeMenuItems, loading: realtimeLoading, refetch } = useRealtimeMenu()
  
  // Supabase가 활성화되면 realtime 데이터 사용, 아니면 로컬 데이터 사용
  const menuItems = isSupabaseEnabled ? realtimeMenuItems : localMenuItems

  // Supabase 환경 변수 확인 (클라이언트에서만 실행)
  useEffect(() => {
    const configured = isSupabaseConfigured()
    setIsSupabaseEnabled(configured)
    
    // Initialize tables if Supabase is configured
    if (configured) {
      initializeAllTables().catch(err => {
        console.error('[v0] Error initializing tables:', err)
      })
    }
  }, [])

  useEffect(() => {
    const savedAdminLang = localStorage.getItem("adminLanguage") as AdminLanguage
    if (savedAdminLang && adminTranslations[savedAdminLang]) {
      setAdminLanguage(savedAdminLang)
    }

    // 로컬 스토리지에서 불러옴 (Supabase 미연결 시 fallback)
    const saved = localStorage.getItem("menuItems")
    if (saved) {
      try {
        setLocalMenuItems(JSON.parse(saved))
      } catch {
        setLocalMenuItems([])
      }
    }
    setMounted(true)
  }, [])

  const saveMenuItems = (items: any[]) => {
    setLocalMenuItems(items)
    localStorage.setItem("menuItems", JSON.stringify(items))
  }

  const handleAddItem = async (rawItem: any) => {
    // Determine if this is an edit or add operation based on item.id
    const isEditing = editingId || (rawItem.id && menuItems.some(m => m.id === rawItem.id))
    const itemId = editingId || rawItem.id || Date.now().toString()
    
    setSaveError(null)
    setSaveSuccess(false)

    // Auto-translate the Korean name/description into EN/JP/CN/VN before saving.
    // On edit, this also migrates legacy items: the old Korean value is re-translated
    // and the full multi-language set overwrites the previous data in Supabase.
    const item = await autoTranslateMenuFields(rawItem)
    
    if (isSupabaseEnabled) {
      try {
        console.log("[v0] handleAddItem: form data before save", {
          isEditing,
          itemId,
          can_adjust_price: item.can_adjust_price,
          formDataKeys: Object.keys(item)
        })
        
        if (isEditing) {
          const result = await updateMenuItem(itemId, { ...item, id: itemId })
          console.log("[v0] Menu item updated, response:", result)
        } else {
          const result = await addMenuItem({ ...item, id: itemId })
          console.log("[v0] Menu item added, response:", result)
        }
        
        // Reset editing state
        setEditingId(null)
        setIsFormOpen(false)
        setSaveSuccess(true)
        
        // Clear success message after 3 seconds
        setTimeout(() => setSaveSuccess(false), 3000)
        
        // CRITICAL: Refetch to update UI with new image URL (cache buster).
        // The refetch will trigger a new fetch from Supabase, which will rebuild the image URLs
        // with new timestamps, forcing the browser to bypass cache and load fresh images.
        console.log("[v0] Starting refetch to update UI with fresh image URLs...")
        await refetch()
        console.log("[v0] Refetch complete - UI should now show updated images with cache buster")
        
        } catch (error: any) {
          const errorMessage = error?.message || error?.details || error?.hint || JSON.stringify(error) || '알 수 없는 오류가 발생했습니다.'
          console.error("[v0] Menu save error:", { error, errorMessage })
          setSaveError(errorMessage)
          
          // Also show in alert for immediate visibility
          alert(`메뉴 저장 실패:\n${errorMessage}`)
      }
      } else {
        if (isEditing) {
        saveMenuItems(menuItems.map((m) => (m.id === itemId ? { ...item, id: itemId } : m)))
      } else {
        saveMenuItems([...menuItems, { ...item, id: itemId }])
      }
      setEditingId(null)
      setIsFormOpen(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  const handleEdit = (id: string) => {
    setEditingId(id)
    setIsFormOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm(t.confirmDelete)) {
      setSaveError(null)
      if (isSupabaseEnabled) {
        try {
          // Supabase에서 삭제
          await deleteMenuItem(id)
          setSaveSuccess(true)
          setTimeout(() => setSaveSuccess(false), 3000)
          // 전체 목록 다시 가져오기
          setTimeout(async () => {
            await refetch()
          }, 100)
        } catch (error: any) {
          const errorMessage = error?.message || error?.details || error?.hint || JSON.stringify(error) || '알 수 없는 오류가 발생했습니다.'
          console.error("[v0] Menu delete error:", { error, errorMessage })
          setSaveError(errorMessage)
          alert(`메뉴 삭제 실패:\n${errorMessage}`)
        }
      } else {
        // 로컬 스토리지에서 삭제
        saveMenuItems(menuItems.filter((m) => m.id !== id))
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("adminAuth")
    router.push("/admin/login")
  }

  const handleLanguageChange = (lang: AdminLanguage) => {
    setAdminLanguage(lang)
    localStorage.setItem("adminLanguage", lang)
  }

  const t = adminTranslations[adminLanguage]

  // Convert DB field names to form field names for editing
  const convertDbToForm = (dbItem: any) => {
    if (!dbItem) return null

    // Backward compatibility: a legacy row may store the description as a plain
    // string (or a JSON object string) rather than split desc_* columns.
    // normalizeDescription turns any shape into a { ko, en, ... } object so the
    // Korean input is always populated with the old value.
    const legacyDesc = normalizeDescription(dbItem.description ?? dbItem.desc_ko ?? dbItem.descKo)

    // CRITICAL: Preserve the image field - it may be null/empty from API, but we need to
    // pass it to the form so the form can make the distinction between "no new upload"
    // (in which case the form should NOT include it in the submit) vs "new upload"
    return {
      ...dbItem,
      can_adjust_price: dbItem.can_adjust ?? dbItem.can_adjust_price ?? false,
      priceKRW: dbItem.price_krw ?? dbItem.priceKRW,
      priceCurrency: dbItem.price_currency ?? dbItem.priceCurrency ?? "KRW",
      priceAmount: dbItem.price_amount ?? dbItem.priceAmount,
      nameKo: dbItem.name_ko ?? dbItem.nameKo,
      nameEn: dbItem.name_en ?? dbItem.nameEn,
      nameJa: dbItem.name_ja ?? dbItem.nameJa,
      nameZh: dbItem.name_zh ?? dbItem.nameZh,
      nameEs: dbItem.name_es ?? dbItem.nameEs,
      nameTh: dbItem.name_th ?? dbItem.nameTh,
      nameVi: dbItem.name_vi ?? dbItem.nameVi,
      descKo: dbItem.desc_ko ?? dbItem.descKo ?? legacyDesc.ko ?? "",
      descEn: dbItem.desc_en ?? dbItem.descEn ?? legacyDesc.en ?? "",
      descJa: dbItem.desc_ja ?? dbItem.descJa ?? legacyDesc.ja ?? "",
      descZh: dbItem.desc_zh ?? dbItem.descZh ?? legacyDesc.zh ?? "",
      descEs: dbItem.desc_es ?? dbItem.descEs ?? legacyDesc.es ?? "",
      descTh: dbItem.desc_th ?? dbItem.descTh ?? legacyDesc.th ?? "",
      descVi: dbItem.desc_vi ?? dbItem.descVi ?? legacyDesc.vi ?? "",
      // CRITICAL: Include image for edit mode
      image: dbItem.image ?? "",
    }
  }

  const editingItem = editingId ? convertDbToForm(menuItems.find((m) => m.id === editingId)) : null

  // Don't render until mounted to avoid hydration issues
  if (!mounted) return <div className="p-8 text-center">Loading admin panel...</div>

  return (
    <AuthGuard>
      <main className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border bg-card">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-primary">{t.adminDashboard}</h1>
                <p className="text-muted-foreground text-sm mt-1">{t.menuCategoryManagement}</p>
              </div>
              <div className="flex gap-4 items-center">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground">{t.language}</label>
                  <select
                    value={adminLanguage}
                    onChange={(e) => handleLanguageChange(e.target.value as AdminLanguage)}
                    className="px-3 py-2 rounded-md border border-border bg-background text-foreground cursor-pointer"
                  >
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                    <option value="vi">Tiếng Việt</option>
                    <option value="ja">日本語</option>
                    <option value="zh">中文</option>
                    <option value="es">Español</option>
                    <option value="th">ไทย</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Link href="/admin/sales">
                    <Button variant="outline" className="gap-2">
                      <BarChart3 className="w-4 h-4" />
                      매출 현황
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button variant="outline">{t.viewMenu}</Button>
                  </Link>
                  <Button variant="destructive" onClick={handleLogout}>
                    {t.logout}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Error/Success Messages */}
        {saveError && (
          <div className="fixed top-4 right-4 max-w-md z-50 bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-600 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">오류 발생</p>
                <p className="text-xs mt-1 whitespace-pre-wrap break-words">{saveError}</p>
              </div>
              <button onClick={() => setSaveError(null)} className="text-red-600 hover:text-red-700 font-bold">×</button>
            </div>
          </div>
        )}
        
        {saveSuccess && (
          <div className="fixed top-4 right-4 max-w-md z-50 bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-600 text-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">저장 완료</p>
              <button onClick={() => setSaveSuccess(false)} className="text-green-600 hover:text-green-700 font-bold">×</button>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 py-8">
          <Tabs defaultValue="menu" className="w-full">
            <TabsList className="grid w-full grid-cols-10">
              <TabsTrigger value="menu">{t.menuManagement}</TabsTrigger>
              <TabsTrigger value="category">{t.categoryManagement}</TabsTrigger>
              <TabsTrigger value="optionGroups">콤보 옵션</TabsTrigger>
              <TabsTrigger value="itemStats">품목별 통계</TabsTrigger>
              <TabsTrigger value="promotion">{t.promotion}</TabsTrigger>
              <TabsTrigger value="exchange">{t.exchangeRate}</TabsTrigger>
              <TabsTrigger value="managers">{t.managers}</TabsTrigger>
              <TabsTrigger value="priceLog">{t.priceLog}</TabsTrigger>
              <TabsTrigger value="payroll">{payrollTabLabels[adminLanguage]}</TabsTrigger>
              <TabsTrigger value="settings">{t.pageSettings}</TabsTrigger>
            </TabsList>

            <TabsContent value="menu" className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t.menuManagement}</CardTitle>
                    <CardDescription>{t.selectCategoryDesc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AdminMenuManager
                      menuItems={menuItems}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onAdd={() => {
                        setEditingId(null)
                        setIsFormOpen(true)
                      }}
                      editingItem={editingItem}
                      onSubmit={handleAddItem}
                      language={adminLanguage}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="category">
              <CategoryManager language={adminLanguage} />
            </TabsContent>

            <TabsContent value="optionGroups">
              <div className="space-y-4">
                {mounted ? <OptionGroupManager /> : <div className="p-8 text-center text-muted-foreground">Loading...</div>}
              </div>
            </TabsContent>

            <TabsContent value="itemStats">
              <div className="space-y-4">
                {mounted ? (
                  <ItemStatisticsReport />
                ) : (
                  <div className="p-8 text-center text-muted-foreground">Loading...</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="promotion">
              <PromotionManager language={adminLanguage} />
            </TabsContent>

            <TabsContent value="exchange">
              <ExchangeRateManager language={adminLanguage} />
            </TabsContent>

            <TabsContent value="managers">
              <div className="space-y-4">
                {mounted ? <ManagersManagement /> : <div className="p-8 text-center text-muted-foreground">Loading...</div>}
              </div>
            </TabsContent>

            <TabsContent value="priceLog">
              <div className="space-y-4">
                {mounted ? <PriceModificationLog /> : <div className="p-8 text-center text-muted-foreground">Loading...</div>}
              </div>
            </TabsContent>

            <TabsContent value="payroll">
              <div className="space-y-4">
                {mounted ? (
                  <StaffPayrollReport language={adminLanguage} />
                ) : (
                  <div className="p-8 text-center text-muted-foreground">Loading...</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <PageSettings language={adminLanguage} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </AuthGuard>
  )
}
