"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { BarChart3, Wine, Package, GlassWater, FileSpreadsheet } from "lucide-react"
import {
  shouldIncludeLine,
  resolveItemType,
  type StatLineItem,
  type StatItemType,
} from "@/lib/stats-classification"
import { adminTranslations, type AdminLanguage } from "@/lib/admin-translations"
import {
  buildMenuNameIndex,
  resolveOrderItemName,
  normalizeNameKey,
  EMPTY_MENU_NAME_INDEX,
  type MenuNameIndex,
} from "@/lib/item-name-localization"

type TabType = "daily" | "monthly"

interface RawLineItem extends StatLineItem {
  id: number
  created_at: string
}

interface AggregatedRow {
  key: string
  name: string
  type: StatItemType
  quantity: number
}

// Type labels are derived from the active language at render time, so they are
// built inside the component (see `typeLabels`) rather than as a static map.
const TYPE_ICON: Record<StatItemType, typeof Wine> = {
  single: GlassWater,
  combo_set: Package,
  combo_drink: Wine,
}

export default function ItemStatisticsReport({
  adminLanguage: adminLanguageProp,
}: {
  /** Passed down by the admin shell so the report re-localizes instantly. */
  adminLanguage?: AdminLanguage
} = {}) {
  const [activeTab, setActiveTab] = useState<TabType>("daily")
  const [rows, setRows] = useState<RawLineItem[]>([])
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  // Localized names from the live catalog, so item names are not frozen in the
  // language they were saved in at order time.
  const [menuNameIndex, setMenuNameIndex] = useState<MenuNameIndex>(EMPTY_MENU_NAME_INDEX)
  // Fallback for standalone use; the prop wins whenever the shell supplies it.
  const [storedLanguage, setStoredLanguage] = useState<AdminLanguage>("ko")
  const adminLanguage = adminLanguageProp ?? storedLanguage
  const t = adminTranslations[adminLanguage]

  const typeLabels: Record<StatItemType, string> = useMemo(
    () => ({
      single: t.statTypeSingle,
      combo_set: t.statTypeComboSet,
      combo_drink: t.statTypeComboDrink,
    }),
    [t],
  )

  useEffect(() => {
    if (adminLanguageProp) return
    const saved = localStorage.getItem("adminLanguage") as AdminLanguage | null
    if (saved && adminTranslations[saved]) setStoredLanguage(saved)
  }, [adminLanguageProp])

  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0] // YYYY-MM-DD
  })
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  // 메뉴 ID → 카테고리 매핑 (상위 메뉴의 음식 여부 판별용). 최초 1회 로드.
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Reuse the runtime server route that already serves menu data. This avoids
        // the build-time NEXT_PUBLIC_* browser client entirely.
        const res = await fetch("/api/menu", { cache: "no-store" })
        if (!res.ok) {
          console.error("[v0] 카테고리 로드 실패:", res.status)
          return
        }
        const body = await res.json().catch(() => ({}))
        const items: any[] = body?.menuItems ?? []
        const map: Record<string, string> = {}
        for (const item of items) {
          if (item?.id != null) map[String(item.id)] = item.category
        }
        setCategoryMap(map)
        // Same response also drives per-language name resolution (one request).
        setMenuNameIndex(buildMenuNameIndex(items))
      } catch (err) {
        console.error("[v0] 카테고리 로드 중 오류:", err)
      }
    }
    fetchCategories()
  }, [])

  // 선택된 기간의 sale_line_items 조회
  useEffect(() => {
    const fetchLines = async () => {
      setLoading(true)

      let start: string
      let end: string
      if (activeTab === "daily") {
        start = `${selectedDate}T00:00:00`
        end = `${selectedDate}T23:59:59.999`
      } else {
        const [y, m] = selectedMonth.split("-").map(Number)
        start = `${selectedMonth}-01T00:00:00`
        const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`
        end = `${nextMonth}-01T00:00:00`
      }

      // Half-open range [start, end): `end` maps to an exclusive `lt` filter server-side.
      const params = new URLSearchParams({ resource: "sale_line_items", from: start, toExclusive: end })
      const res = await fetch(`/api/sales?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error("[v0] sale_line_items 조회 실패:", res.status, err?.error)
        setRows([])
      } else {
        const body = await res.json().catch(() => ({}))
        setRows((body?.data ?? []) as RawLineItem[])
      }
      setLoading(false)
    }
    fetchLines()
  }, [activeTab, selectedDate, selectedMonth])

  const categoryOf = useMemo(
    () => (menuId: string | null) => (menuId ? categoryMap[String(menuId)] : undefined),
    [categoryMap],
  )

  // Resolve a stat line to a name in the active admin language.
  // NOTE: on 'item' rows parent_menu_id IS the item's own menu id, but on
  // 'combo_option' rows it points at the PARENT combo — passing it there would
  // label every option with the combo's name, so those resolve by name instead.
  const resolveLineName = useMemo(() => {
    return (row: RawLineItem): string => {
      const isComboOption = row.line_type === "combo_option"
      const resolved = resolveOrderItemName(
        {
          menuId: isComboOption ? null : row.parent_menu_id,
          nameKo: row.item_name_ko,
          nameEn: row.item_name_en,
        },
        adminLanguage,
        menuNameIndex,
      )
      return resolved || row.item_name_ko || row.item_name_en || t.statNoName
    }
  }, [adminLanguage, menuNameIndex, t])

  // 필터 규칙 적용 후 항목 기준 집계.
  // 버킷 키는 언어와 무관한 식별자(메뉴 ID 또는 정규화된 원본명)를 사용하므로
  // 관리자 언어를 바꿔도 집계 그룹이 갈라지지 않는다.
  const aggregated = useMemo<AggregatedRow[]>(() => {
    const buckets = new Map<string, AggregatedRow>()
    for (const row of rows) {
      if (!shouldIncludeLine(row, categoryOf)) continue
      const type = resolveItemType(row, categoryOf)
      const identity =
        row.line_type === "combo_option" || !row.parent_menu_id
          ? normalizeNameKey(row.item_name_ko || row.item_name_en)
          : String(row.parent_menu_id)
      const key = `${type}__${identity}`
      const existing = buckets.get(key)
      if (existing) {
        existing.quantity += Number(row.quantity) || 0
      } else {
        buckets.set(key, {
          key,
          name: resolveLineName(row),
          type,
          quantity: Number(row.quantity) || 0,
        })
      }
    }
    return Array.from(buckets.values()).sort((a, b) => b.quantity - a.quantity)
  }, [rows, categoryOf, resolveLineName])

  const totalVolume = useMemo(
    () => aggregated.reduce((sum, r) => sum + r.quantity, 0),
    [aggregated],
  )

  // Export the aggregated table, using the same localized names shown on screen.
  const handleExportExcel = () => {
    const escapeCsv = (value: string | number) => `"${String(value ?? "").replace(/"/g, '""')}"`
    const headers = ["#", t.statItemName, t.statType, t.statQuantity]
    const csvRows = aggregated.map((row, index) => [
      String(index + 1),
      row.name,
      typeLabels[row.type],
      String(row.quantity),
    ])
    // BOM so Excel reads UTF-8 (Korean/Vietnamese/Thai) correctly.
    const csvContent =
      "\uFEFF" + [headers, ...csvRows].map((r) => r.map(escapeCsv).join(",")).join("\r\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const fileLabel = activeTab === "daily" ? selectedDate : selectedMonth
    link.href = url
    link.download = `item_statistics_${fileLabel}_${adminLanguage}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* 탭 + 날짜 선택 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-border bg-muted p-1">
          <button
            onClick={() => setActiveTab("daily")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "daily"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.statDaily}
          </button>
          <button
            onClick={() => setActiveTab("monthly")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "monthly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.statMonthly}
          </button>
        </div>

        {activeTab === "daily" ? (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
          />
        ) : (
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
          />
        )}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.statTotalVolume}
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{totalVolume.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.statCountedItems}
            </CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{aggregated.length.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* 품목별 통계 테이블 */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Wine className="h-5 w-5 text-primary" />
              {t.statItemSalesVolume}
            </CardTitle>
            <button
              onClick={handleExportExcel}
              disabled={aggregated.length === 0}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-12 text-center text-muted-foreground">{t.loading}</p>
          ) : aggregated.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">{t.statNoData}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>{t.statItemName}</TableHead>
                  <TableHead className="w-32">{t.statType}</TableHead>
                  <TableHead className="w-28 text-right">{t.statQuantity}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregated.map((row, index) => {
                  const Icon = TYPE_ICON[row.type]
                  return (
                    <TableRow key={row.key}>
                      <TableCell className="text-center text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1 font-normal">
                          <Icon className="h-3 w-3" />
                          {typeLabels[row.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">
                        {row.quantity.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
