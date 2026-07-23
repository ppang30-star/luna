"use client"

import { useState, useEffect, useMemo, Fragment } from "react"
import { ChevronDown, ChevronRight, Users, Clock, DollarSign, Calendar } from "lucide-react"
import type { AdminLanguage } from "@/lib/admin-translations"

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface SalesItemModifier {
  modifierId?: string
  modifierGroupName?: string
  selectedOption?: string
  selectedOptionLabel?: string
}

interface SalesItem {
  menuId: string
  nameKo?: string
  nameEn?: string
  quantity: number
  unitPrice: number
  selectedModifiers?: SalesItemModifier[] | null
}

interface SalesRecord {
  id: number
  bill_id: number | null
  table_no: string
  items: SalesItem[]
  created_at: string
}

type ViewMode = "daily" | "monthly"

// Aggregated per-staff result
interface StaffAggregate {
  staffName: string
  totalHours: number
  totalAmount: number
  // hours + amount split by charge type (item name)
  byCharge: Record<string, { hours: number; amount: number }>
}

// ------------------------------------------------------------------
// Localized labels (self-contained, no global translation edits)
// ------------------------------------------------------------------
const labels: Record<AdminLanguage, Record<string, string>> = {
  ko: {
    title: "직원별 T/C 및 서비스 정산",
    subtitle: "직원별 서비스 시간 및 발생 금액 집계",
    daily: "일별 보기",
    monthly: "월별 보기",
    staffName: "직원명",
    totalHours: "총 서비스 시간",
    totalAmount: "총 발생 금액",
    breakdown: "항목별 내역",
    grandTotal: "총 합계",
    noData: "해당 기간에 서비스 정산 데이터가 없습니다.",
    loading: "불러오는 중...",
    hoursUnit: "시간",
    staffCount: "직원 수",
  },
  en: {
    title: "Staff Payroll & Service Hours",
    subtitle: "Aggregated service hours and amount per staff",
    daily: "Daily View",
    monthly: "Monthly View",
    staffName: "Staff Name",
    totalHours: "Total Hours",
    totalAmount: "Total Amount",
    breakdown: "Breakdown",
    grandTotal: "Grand Total",
    noData: "No service settlement data for this period.",
    loading: "Loading...",
    hoursUnit: "h",
    staffCount: "Staff",
  },
  vi: {
    title: "Bảng lương & Giờ phục vụ NV",
    subtitle: "Tổng hợp giờ phục vụ và số tiền theo nhân viên",
    daily: "Theo ngày",
    monthly: "Theo tháng",
    staffName: "Tên nhân viên",
    totalHours: "Tổng giờ",
    totalAmount: "Tổng số tiền",
    breakdown: "Chi tiết",
    grandTotal: "Tổng cộng",
    noData: "Không có dữ liệu thanh toán dịch vụ cho kỳ này.",
    loading: "Đang tải...",
    hoursUnit: "h",
    staffCount: "Nhân viên",
  },
  ja: {
    title: "スタッフ別T/C・サービス精算",
    subtitle: "スタッフ別のサービス時間と発生金額の集計",
    daily: "日別表示",
    monthly: "月別表示",
    staffName: "スタッフ名",
    totalHours: "合計時間",
    totalAmount: "合計金額",
    breakdown: "内訳",
    grandTotal: "総合計",
    noData: "この期間のサービス精算データがありません。",
    loading: "読み込み中...",
    hoursUnit: "時間",
    staffCount: "人数",
  },
  zh: {
    title: "员工T/C及服务结算",
    subtitle: "按员工汇总服务时间和金额",
    daily: "按日查看",
    monthly: "按月查看",
    staffName: "员工姓名",
    totalHours: "总服务时间",
    totalAmount: "总金额",
    breakdown: "明细",
    grandTotal: "总计",
    noData: "该期间没有服务结算数据。",
    loading: "加载中...",
    hoursUnit: "小时",
    staffCount: "员工数",
  },
  es: {
    title: "Nómina y Horas de Servicio",
    subtitle: "Horas de servicio y monto agregados por personal",
    daily: "Vista diaria",
    monthly: "Vista mensual",
    staffName: "Nombre",
    totalHours: "Horas totales",
    totalAmount: "Monto total",
    breakdown: "Desglose",
    grandTotal: "Total general",
    noData: "No hay datos de liquidación para este período.",
    loading: "Cargando...",
    hoursUnit: "h",
    staffCount: "Personal",
  },
  th: {
    title: "เงินเดือน & ชั่วโมงบริการพนักงาน",
    subtitle: "รวมชั่วโมงบริการและจำนวนเงินต่อพนักงาน",
    daily: "รายวัน",
    monthly: "รายเดือน",
    staffName: "ชื่อพนักงาน",
    totalHours: "ชั่วโมงรวม",
    totalAmount: "จำนวนเงินรวม",
    breakdown: "รายละเอียด",
    grandTotal: "ยอดรวมทั้งหมด",
    noData: "ไม่มีข้อมูลการชำระบริการในช่วงนี้",
    loading: "กำลังโหลด...",
    hoursUnit: "ชม.",
    staffCount: "พนักงาน",
  },
}

export default function StaffPayrollReport({ language = "ko" }: { language?: AdminLanguage }) {
  const t = labels[language] || labels.ko

  const [viewMode, setViewMode] = useState<ViewMode>("daily")
  const [salesData, setSalesData] = useState<SalesRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0])
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  // Fetch completed sales for the selected range
  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true)

      let from: string
      let to: string
      if (viewMode === "daily") {
        from = `${selectedDate}T00:00:00`
        to = `${selectedDate}T23:59:59`
      } else {
        const [year, month] = selectedMonth.split("-")
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
        from = `${year}-${month}-01T00:00:00`
        to = `${year}-${month}-${lastDay}T23:59:59`
      }

      // Read through the server route so it uses runtime env vars (host-agnostic).
      const params = new URLSearchParams({ resource: "sales_records", from, to })
      const res = await fetch(`/api/sales?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error("[v0] Payroll fetch error:", res.status, err?.error)
        setSalesData([])
      } else {
        const body = await res.json().catch(() => ({}))
        setSalesData((body?.data as SalesRecord[]) || [])
      }
      setLoading(false)
    }

    fetchSales()
  }, [viewMode, selectedDate, selectedMonth])

  // Aggregate service items by staff name
  const { staffAggregates, grandTotal } = useMemo(() => {
    const map = new Map<string, StaffAggregate>()

    salesData.forEach((record) => {
      if (!Array.isArray(record.items)) return
      record.items.forEach((item) => {
        // ONLY process items that carry staff names in selectedModifiers.
        // (Lady Charge / Overtime Charge / Manager Charge all attach a staff modifier.)
        const mods = item.selectedModifiers
        if (!mods || mods.length === 0) return

        const chargeName = item.nameKo || item.nameEn || item.menuId
        const qty = Number(item.quantity) || 0
        const amount = (Number(item.unitPrice) || 0) * qty

        mods.forEach((mod) => {
          const staffName = mod.selectedOptionLabel || mod.selectedOption || "Unknown"
          const existing =
            map.get(staffName) || { staffName, totalHours: 0, totalAmount: 0, byCharge: {} }

          existing.totalHours += qty
          existing.totalAmount += amount
          if (!existing.byCharge[chargeName]) {
            existing.byCharge[chargeName] = { hours: 0, amount: 0 }
          }
          existing.byCharge[chargeName].hours += qty
          existing.byCharge[chargeName].amount += amount

          map.set(staffName, existing)
        })
      })
    })

    const aggregates = Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount)
    const totals = aggregates.reduce(
      (acc, s) => ({ hours: acc.hours + s.totalHours, amount: acc.amount + s.totalAmount }),
      { hours: 0, amount: 0 },
    )

    return { staffAggregates: aggregates, grandTotal: totals }
  }, [salesData])

  const formatCurrency = (amount: number) => new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + " VND"

  const toggleExpand = (name: string) => setExpanded((prev) => ({ ...prev, [name]: !prev[name] }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-500/15 text-amber-600">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{t.title}</h2>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* View toggle */}
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setViewMode("daily")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === "daily" ? "bg-amber-600 text-white" : "bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            {t.daily}
          </button>
          <button
            onClick={() => setViewMode("monthly")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === "monthly" ? "bg-amber-600 text-white" : "bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            {t.monthly}
          </button>
        </div>

        {/* Date / Month picker */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          {viewMode === "daily" ? (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
            />
          ) : (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
            />
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <Users className="w-5 h-5 text-amber-600" />
          <div>
            <p className="text-xs text-muted-foreground">{t.staffCount}</p>
            <p className="text-lg font-bold text-foreground">{staffAggregates.length}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-600" />
          <div>
            <p className="text-xs text-muted-foreground">{t.totalHours}</p>
            <p className="text-lg font-bold text-foreground">
              {grandTotal.hours} {t.hoursUnit}
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-amber-600" />
          <div>
            <p className="text-xs text-muted-foreground">{t.totalAmount}</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(grandTotal.amount)}</p>
          </div>
        </div>
      </div>

      {/* Data table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground">{t.loading}</div>
        ) : staffAggregates.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">{t.noData}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-left">
                  <th className="px-4 py-3 font-semibold text-foreground">{t.staffName}</th>
                  <th className="px-4 py-3 font-semibold text-foreground text-right">{t.totalHours}</th>
                  <th className="px-4 py-3 font-semibold text-foreground text-right">{t.totalAmount}</th>
                  <th className="px-4 py-3 font-semibold text-foreground text-center w-24">{t.breakdown}</th>
                </tr>
              </thead>
              <tbody>
                {staffAggregates.map((staff) => {
                  const isOpen = !!expanded[staff.staffName]
                  return (
                    <Fragment key={staff.staffName}>
                      <tr className="border-b border-border hover:bg-accent/40">
                        <td className="px-4 py-3 font-medium text-foreground">{staff.staffName}</td>
                        <td className="px-4 py-3 text-right text-foreground">
                          {staff.totalHours} {t.hoursUnit}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-amber-600">
                          {formatCurrency(staff.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggleExpand(staff.staffName)}
                            className="inline-flex items-center justify-center p-1 rounded hover:bg-accent text-muted-foreground"
                            aria-label="toggle breakdown"
                          >
                            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-muted/30 border-b border-border">
                          <td colSpan={4} className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(staff.byCharge).map(([charge, data]) => (
                                <span
                                  key={charge}
                                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1 text-xs"
                                >
                                  <span className="font-medium text-foreground">{charge}</span>
                                  <span className="text-muted-foreground">
                                    {data.hours} {t.hoursUnit}
                                  </span>
                                  <span className="text-amber-600">{formatCurrency(data.amount)}</span>
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-amber-500/10 border-t-2 border-amber-500/40 font-bold">
                  <td className="px-4 py-3 text-foreground">{t.grandTotal}</td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {grandTotal.hours} {t.hoursUnit}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-600">{formatCurrency(grandTotal.amount)}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
