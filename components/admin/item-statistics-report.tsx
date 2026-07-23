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
import { BarChart3, Wine, Package, GlassWater } from "lucide-react"
import {
  shouldIncludeLine,
  resolveItemType,
  type StatLineItem,
  type StatItemType,
} from "@/lib/stats-classification"

type TabType = "daily" | "monthly"

interface RawLineItem extends StatLineItem {
  id: number
  created_at: string
}

interface AggregatedRow {
  name: string
  type: StatItemType
  quantity: number
}

const TYPE_LABEL: Record<StatItemType, string> = {
  single: "단품",
  combo_set: "콤보 세트",
  combo_drink: "콤보 주류",
}

const TYPE_ICON: Record<StatItemType, typeof Wine> = {
  single: GlassWater,
  combo_set: Package,
  combo_drink: Wine,
}

export default function ItemStatisticsReport() {
  const [activeTab, setActiveTab] = useState<TabType>("daily")
  const [rows, setRows] = useState<RawLineItem[]>([])
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

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

  // 필터 규칙 적용 후 항목명 기준 집계
  const aggregated = useMemo<AggregatedRow[]>(() => {
    const buckets = new Map<string, AggregatedRow>()
    for (const row of rows) {
      if (!shouldIncludeLine(row, categoryOf)) continue
      const name = row.item_name_ko || row.item_name_en || "(이름 없음)"
      const type = resolveItemType(row, categoryOf)
      const key = `${type}__${name}`
      const existing = buckets.get(key)
      if (existing) {
        existing.quantity += Number(row.quantity) || 0
      } else {
        buckets.set(key, { name, type, quantity: Number(row.quantity) || 0 })
      }
    }
    return Array.from(buckets.values()).sort((a, b) => b.quantity - a.quantity)
  }, [rows, categoryOf])

  const totalVolume = useMemo(
    () => aggregated.reduce((sum, r) => sum + r.quantity, 0),
    [aggregated],
  )

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
            일별
          </button>
          <button
            onClick={() => setActiveTab("monthly")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "monthly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            월별
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
              총 판매 수량 (음식/직원착석 제외)
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
              집계 품목 수
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
          <CardTitle className="flex items-center gap-2">
            <Wine className="h-5 w-5 text-primary" />
            품목별 판매 수량
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-12 text-center text-muted-foreground">불러오는 중...</p>
          ) : aggregated.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              해당 기간에 집계할 판매 데이터가 없습니다.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>품목명</TableHead>
                  <TableHead className="w-32">유형</TableHead>
                  <TableHead className="w-28 text-right">판매 수량</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregated.map((row, index) => {
                  const Icon = TYPE_ICON[row.type]
                  return (
                    <TableRow key={`${row.type}-${row.name}`}>
                      <TableCell className="text-center text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1 font-normal">
                          <Icon className="h-3 w-3" />
                          {TYPE_LABEL[row.type]}
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
