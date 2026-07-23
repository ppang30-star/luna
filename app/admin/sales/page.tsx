"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Calendar, TrendingUp, CreditCard, Banknote, ArrowLeft, Printer, Trash2, FileSpreadsheet } from "lucide-react"
import Link from "next/link"
import DeleteConfirmationPopup from "@/components/delete-confirmation-popup"
import { adminTranslations, type AdminLanguage } from "@/lib/admin-translations"
import { adminFetch, getAdminRole } from "@/lib/admin-session"

interface SalesRecord {
  id: number
  bill_id: number | null  // ★ 통일된 빌 번호 (bills 테이블의 id)
  table_no: string
  items: Array<{
    menuId: string
    nameKo: string
    nameEn?: string
    quantity: number
    unitPrice: number
  }>
  payment_method: "cash" | "card"
  subtotal: number
  vat: number
  discount: number
  card_fee: number
  grand_total: number
  created_at: string
}

type TabType = "daily" | "monthly"

// Fetch sales_records through the server route (/api/sales). The server reads
// Supabase credentials from RUNTIME env vars, so this works on any host even when
// the build-time NEXT_PUBLIC_* values were missing/stale (the Netlify failure mode).
async function fetchSalesRecords(from: string, to: string): Promise<any[]> {
  const params = new URLSearchParams({ resource: "sales_records", from, to })
  const res = await fetch(`/api/sales?${params.toString()}`, { cache: "no-store" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error("[v0] Failed to fetch sales:", res.status, err?.error)
    return []
  }
  const body = await res.json().catch(() => ({}))
  return body?.data ?? []
}

export default function SalesDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>("daily")
  const [salesData, setSalesData] = useState<SalesRecord[]>([])
  const [monthlyAllData, setMonthlyAllData] = useState<SalesRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<SalesRecord | null>(null)
  const [adminLanguage, setAdminLanguage] = useState<AdminLanguage>("ko")
  // RBAC: only super_admin may delete sales records. Resolved after mount so the
  // localStorage-backed role is available (avoids SSR/hydration mismatch).
  const [canWrite, setCanWrite] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)
  
  // Get translations
  const t = adminTranslations[adminLanguage]
  
  // Date filters
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split("T")[0] // YYYY-MM-DD
  })
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}` // YYYY-MM
  })

  // Load admin language from localStorage
  useEffect(() => {
    const savedLang = localStorage.getItem("adminLanguage") as AdminLanguage
    if (savedLang && adminTranslations[savedLang]) {
      setAdminLanguage(savedLang)
    }
    setCanWrite(getAdminRole() === "super_admin")
  }, [])

  // Fetch sales data for the selected date/month
  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true)

      let from: string
      let to: string
      if (activeTab === "daily") {
        from = `${selectedDate}T00:00:00`
        to = `${selectedDate}T23:59:59`
      } else {
        const [year, month] = selectedMonth.split("-")
        from = `${year}-${month}-01T00:00:00`
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
        to = `${year}-${month}-${lastDay}T23:59:59`
      }

      const data = await fetchSalesRecords(from, to)
      setSalesData(data as SalesRecord[])
      setLoading(false)
    }

    fetchSales()
  }, [activeTab, selectedDate, selectedMonth])

  // Fetch monthly cumulative data (MTD) for the daily tab header
  useEffect(() => {
    const fetchMonthlyCumulative = async () => {
      // Get the month from selectedDate
      const [year, month] = selectedDate.split("-")
      const startOfMonth = `${year}-${month}-01T00:00:00`
      // Up to the end of the selected date (current moment for that day)
      const endOfSelectedDate = `${selectedDate}T23:59:59`

      const data = await fetchSalesRecords(startOfMonth, endOfSelectedDate)
      setMonthlyAllData(data as SalesRecord[])
    }

    if (activeTab === "daily") {
      fetchMonthlyCumulative()
    }
  }, [activeTab, selectedDate])

  // Calculate daily summary for the selected date
  const dailySummary = useMemo(() => {
    const cashTotal = salesData
      .filter((r) => r.payment_method === "cash")
      .reduce((sum, r) => sum + r.grand_total, 0)
    const cardTotal = salesData
      .filter((r) => r.payment_method === "card")
      .reduce((sum, r) => sum + r.grand_total, 0)
    return {
      cash: cashTotal,
      card: cardTotal,
      total: cashTotal + cardTotal,
      count: salesData.length,
    }
  }, [salesData])

  // Calculate Monthly Cumulative (MTD) for the daily tab header
  const monthlyCumulative = useMemo(() => {
    const cashTotal = monthlyAllData
      .filter((r) => r.payment_method === "cash")
      .reduce((sum, r) => sum + r.grand_total, 0)
    const cardTotal = monthlyAllData
      .filter((r) => r.payment_method === "card")
      .reduce((sum, r) => sum + r.grand_total, 0)
    return {
      cash: cashTotal,
      card: cardTotal,
      total: cashTotal + cardTotal,
      count: monthlyAllData.length,
    }
  }, [monthlyAllData])

  // Group sales by date for daily tab (chronological)
  const salesGroupedByDate = useMemo(() => {
    const grouped: Record<string, SalesRecord[]> = {}
    
    // Sort chronologically (oldest first for display)
    const sortedData = [...salesData].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    sortedData.forEach((record) => {
      const dateKey = record.created_at.split("T")[0]
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(record)
    })

    // Return sorted by date (oldest first)
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, records]) => {
        const dailyCash = records
          .filter((r) => r.payment_method === "cash")
          .reduce((sum, r) => sum + r.grand_total, 0)
        const dailyCard = records
          .filter((r) => r.payment_method === "card")
          .reduce((sum, r) => sum + r.grand_total, 0)
        return {
          date,
          records,
          dailyCash,
          dailyCard,
          dailyTotal: dailyCash + dailyCard,
          count: records.length,
        }
      })
  }, [salesData])

  // Group by day for monthly view
  const monthlyGrouped = useMemo(() => {
    const grouped: Record<string, { cash: number; card: number; count: number }> = {}

    salesData.forEach((record) => {
      const dateKey = record.created_at.split("T")[0]
      if (!grouped[dateKey]) {
        grouped[dateKey] = { cash: 0, card: 0, count: 0 }
      }
      if (record.payment_method === "cash") {
        grouped[dateKey].cash += record.grand_total
      } else {
        grouped[dateKey].card += record.grand_total
      }
      grouped[dateKey].count++
    })

    return Object.entries(grouped)
      .map(([date, data]) => ({
        date,
        ...data,
        total: data.cash + data.card,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [salesData])

  // Monthly totals
  const monthlyTotals = useMemo(() => {
    return monthlyGrouped.reduce(
      (acc, day) => ({
        cash: acc.cash + day.cash,
        card: acc.card + day.card,
        total: acc.total + day.total,
        count: acc.count + day.count,
      }),
      { cash: 0, card: 0, total: 0, count: 0 }
    )
  }, [monthlyGrouped])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN").format(amount) + " VND"
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Re-fetch function to sync all data from the server route
  const refetchAllData = async () => {
    // Fetch data for the current view (daily or monthly)
    let from: string
    let to: string
    if (activeTab === "daily") {
      from = `${selectedDate}T00:00:00`
      to = `${selectedDate}T23:59:59`
    } else {
      const [year, month] = selectedMonth.split("-")
      from = `${year}-${month}-01T00:00:00`
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
      to = `${year}-${month}-${lastDay}T23:59:59`
    }

    const data = await fetchSalesRecords(from, to)
    setSalesData(data as SalesRecord[])

    // Also refetch monthly cumulative data if on daily tab
    if (activeTab === "daily") {
      const [year, month] = selectedDate.split("-")
      const startOfMonth = `${year}-${month}-01T00:00:00`
      const endOfSelectedDate = `${selectedDate}T23:59:59`

      const monthlyData = await fetchSalesRecords(startOfMonth, endOfSelectedDate)
      setMonthlyAllData(monthlyData as SalesRecord[])
    }
  }

  // Delete handler for individual transaction
  const handleDeleteRecord = async (record: SalesRecord) => {
    if (!canWrite) return // RBAC: read-only managers cannot delete records
    // Open the custom delete confirmation popup
    setDeleteTarget(record)
  }

  // Actual delete execution after confirmation
  const executeDelete = async () => {
    if (!canWrite) return // RBAC: read-only managers cannot delete records
    if (!deleteTarget) {
      return
    }

    // Use bill_id if available, otherwise use record id. Delete via the server
    // route so it targets the same live DB the writes/reads now use.
    const targetBillId = deleteTarget.bill_id
    const targetRecordId = deleteTarget.id

    const params = new URLSearchParams()
    if (targetBillId !== null && targetBillId !== undefined) {
      params.set("billId", String(targetBillId))
    } else {
      params.set("id", String(targetRecordId))
    }

    const res = await adminFetch(`/api/sales?${params.toString()}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error("[v0] Sales delete error:", res.status, err?.error)
      return
    }
    
    // Close the popup
    setDeleteTarget(null)

    // Immediately re-fetch all data from Supabase to ensure sync
    await refetchAllData()
  }

  // Print handler for 장부 인쇄
  const handlePrint = () => {
    const [year, month] = selectedDate.split("-")
    const monthName = `${year}-${month}`
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${t.salesLedger} - ${monthName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Malgun Gothic', sans-serif; 
            font-size: 11px; 
            line-height: 1.4;
            padding: 15px;
          }
          .header { 
            text-align: center; 
            margin-bottom: 15px; 
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
          }
          .header h1 { font-size: 18px; margin-bottom: 5px; }
          .cumulative-box {
            display: flex;
            justify-content: space-around;
            background: #f5f5f5;
            padding: 10px;
            margin-bottom: 15px;
            border: 1px solid #333;
          }
          .cumulative-item { text-align: center; }
          .cumulative-item .label { font-size: 10px; color: #666; }
          .cumulative-item .value { font-size: 14px; font-weight: bold; }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 15px;
          }
          th, td { 
            border: 1px solid #333; 
            padding: 4px 6px; 
            text-align: left;
            font-size: 10px;
          }
          th { background: #e0e0e0; font-weight: bold; }
          .date-header {
            background: #333;
            color: white;
            font-weight: bold;
            font-size: 12px;
            padding: 6px;
          }
          .table-subtotal { background: #f9f9f9; font-style: italic; }
          .daily-total { 
            background: #ffd700; 
            font-weight: bold; 
            font-size: 11px;
          }
          .text-right { text-align: right; }
          .items-list { font-size: 9px; color: #555; }
          @media print {
            body { padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${t.salesLedger}</h1>
          <p>${monthName} (${t.basedOn} ${selectedDate})</p>
        </div>
        
        <div class="cumulative-box">
          <div class="cumulative-item">
            <div class="label">${t.monthlyCashTotal}</div>
            <div class="value">${formatCurrency(monthlyCumulative.cash)}</div>
          </div>
          <div class="cumulative-item">
            <div class="label">${t.monthlyCardTotal}</div>
            <div class="value">${formatCurrency(monthlyCumulative.card)}</div>
          </div>
          <div class="cumulative-item">
            <div class="label">${t.monthlyTotalSales}</div>
            <div class="value">${formatCurrency(monthlyCumulative.total)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 8%">${t.billNumber}</th>
              <th style="width: 8%">Time</th>
              <th style="width: 8%">${t.table}</th>
              <th style="width: 26%">Items</th>
              <th style="width: 8%">${t.paymentMethod}</th>
              <th style="width: 10%">${t.subtotal}</th>
              <th style="width: 8%">VAT</th>
              <th style="width: 8%">${t.discount}</th>
              <th style="width: 8%">${t.cardFee}</th>
              <th style="width: 10%">${t.total}</th>
            </tr>
          </thead>
          <tbody>
            ${salesGroupedByDate.map(dayGroup => `
              <tr>
                <td colspan="10" class="date-header">${dayGroup.date}</td>
              </tr>
              ${dayGroup.records.map(record => `
                <tr>
                  <td>#${record.bill_id ?? record.id}</td>
                  <td>${formatTime(record.created_at)}</td>
                  <td>${record.table_no}</td>
                  <td class="items-list">${record.items.map(item => 
                    `${item.nameKo || item.nameEn} x${item.quantity}`
                  ).join(', ')}</td>
                  <td>${record.payment_method === 'cash' ? t.cash : t.card}</td>
                  <td class="text-right">${formatCurrency(record.subtotal)}</td>
                  <td class="text-right">${record.vat > 0 ? formatCurrency(record.vat) : '-'}</td>
                  <td class="text-right">${record.discount > 0 ? '-' + formatCurrency(record.discount) : '-'}</td>
                  <td class="text-right">${record.card_fee > 0 ? formatCurrency(record.card_fee) : '-'}</td>
                  <td class="text-right"><strong>${formatCurrency(record.grand_total)}</strong></td>
                </tr>
              `).join('')}
              <tr class="daily-total">
                <td colspan="5" style="text-align: center;">${dayGroup.date} ${t.totalSales}</td>
                <td colspan="2" class="text-right">${t.cash}: ${formatCurrency(dayGroup.dailyCash)}</td>
                <td colspan="2" class="text-right">${t.card}: ${formatCurrency(dayGroup.dailyCard)}</td>
                <td class="text-right">${formatCurrency(dayGroup.dailyTotal)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div style="text-align: right; margin-top: 10px; font-size: 10px; color: #666;">
          ${t.printDateTime}: ${new Date().toLocaleString('ko-KR')}
        </div>
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
      }, 250)
    }
  }

  // Export to Excel (CSV) handler for the currently displayed sales ledger
  const handleExportExcel = () => {
    // Escape a value for CSV (wrap in quotes and double any inner quotes)
    const escapeCsv = (value: string | number) => {
      const str = String(value ?? "")
      return `"${str.replace(/"/g, '""')}"`
    }

    // Column headers
    const headers = [
      t.billNumber,
      "Date",
      "Time",
      t.table,
      "Items",
      t.paymentMethod,
      t.subtotal,
      "VAT",
      t.discount,
      t.cardFee,
      t.total,
    ]

    const rows: string[][] = []

    if (activeTab === "daily") {
      salesGroupedByDate.forEach((dayGroup) => {
        dayGroup.records.forEach((record) => {
          rows.push([
            `#${record.bill_id ?? record.id}`,
            formatDate(record.created_at),
            formatTime(record.created_at),
            record.table_no,
            record.items
              .map((item) => `${item.nameKo || item.nameEn} x${item.quantity}`)
              .join(", "),
            record.payment_method === "cash" ? t.cash : t.card,
            String(record.subtotal),
            String(record.vat),
            String(record.discount),
            String(record.card_fee),
            String(record.grand_total),
          ])
        })
      })
    } else {
      // Monthly view: export the per-day summary
      monthlyGrouped.forEach((day) => {
        rows.push([
          "",
          day.date,
          "",
          "",
          `${t.total}: ${day.count}`,
          "",
          "",
          "",
          "",
          "",
          String(day.total),
        ])
      })
    }

    // Build CSV content with a BOM so Excel reads UTF-8 (Korean/Vietnamese/etc.) correctly
    const csvContent =
      "\uFEFF" +
      [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const fileLabel = activeTab === "daily" ? selectedDate : selectedMonth
    link.href = url
    link.download = `sales_${fileLabel}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin" className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{t.salesDashboard}</h1>
          <p className="text-zinc-400 text-sm">Sales Dashboard</p>
        </div>
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("daily")}
          className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === "daily"
              ? "bg-amber-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          }`}
        >
          <Calendar className="w-5 h-5" />
          {t.dailySummary}
        </button>
        <button
          onClick={() => setActiveTab("monthly")}
          className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === "monthly"
              ? "bg-amber-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          {t.monthlySummary}
        </button>
      </div>

      {/* Date Filter */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        {activeTab === "daily" ? (
          <div className="flex items-center gap-3">
            <label className="text-zinc-400">{t.selectDate}:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <label className="text-zinc-400">{t.selectMonth}:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{t.exportExcel}</span>
          </button>

          {/* Print Button - only for daily tab */}
          {activeTab === "daily" && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>{t.printLedger}</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
        </div>
      ) : (
        <>
          {/* Content based on tab */}
          {activeTab === "daily" ? (
            /* Daily View - Monthly Cumulative Header + Grouped by Date */
            <div className="space-y-4">
              {/* Monthly Cumulative Scoreboard (MTD) */}
              <div className="bg-gradient-to-r from-amber-900/40 to-amber-800/20 rounded-xl p-4 border border-amber-700/50">
                <h3 className="text-sm font-medium text-amber-300 mb-3 text-center">
                  {t.monthlyCumulative} ({selectedDate.slice(0, 7)})
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-zinc-400 mb-1">{t.monthlyCashTotal}</p>
                    <p className="text-lg font-bold text-emerald-400">{formatCurrency(monthlyCumulative.cash)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-zinc-400 mb-1">{t.monthlyCardTotal}</p>
                    <p className="text-lg font-bold text-blue-400">{formatCurrency(monthlyCumulative.card)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-zinc-400 mb-1">{t.monthlyTotalSales}</p>
                    <p className="text-lg font-bold text-amber-400">{formatCurrency(monthlyCumulative.total)}</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 text-center mt-2">{t.total} {monthlyCumulative.count}{t.transactions}</p>
              </div>

              {/* Daily Sales Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <Banknote className="w-5 h-5" />
                    <span className="text-sm">{t.cash}</span>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(dailySummary.cash)}</p>
                </div>
                <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <CreditCard className="w-5 h-5" />
                    <span className="text-sm">{t.card}</span>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(dailySummary.card)}</p>
                </div>
                <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700 col-span-2">
                  <div className="flex items-center gap-2 text-amber-400 mb-2">
                    <TrendingUp className="w-5 h-5" />
                    <span className="text-sm">{formatDate(selectedDate)} {t.totalSales} ({dailySummary.count}{t.transactions})</span>
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(dailySummary.total)}</p>
                </div>
              </div>

              {/* Scrollable Sales List Grouped by Date */}
              <div className="overflow-y-auto max-h-[60vh] space-y-4" ref={printRef}>
                <h3 className="text-lg font-semibold text-zinc-300 sticky top-0 bg-zinc-950 py-2 z-10">
                  {formatDate(selectedDate)} {t.detailedRecords} ({salesData.length}{t.transactions})
                </h3>
                
                {salesGroupedByDate.length === 0 ? (
                  <div className="bg-zinc-800 rounded-xl p-8 text-center text-zinc-500">
                    {t.noRecordsForDate}
                  </div>
                ) : (
                  salesGroupedByDate.map((dayGroup) => (
                    <div key={dayGroup.date} className="space-y-3">
                      {/* Date Group Header */}
                      <div className="bg-zinc-700 rounded-lg px-4 py-2 font-semibold text-zinc-200 sticky top-10 z-5">
                        {dayGroup.date}
                      </div>
                      
                      {/* Individual Table Receipt Rows */}
                      {dayGroup.records.map((record) => (
                        <div
                          key={record.id}
                          className="bg-zinc-800 rounded-xl p-4 border border-zinc-700"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <span className="text-zinc-400 text-sm">
                                #{record.bill_id ?? record.id} | {formatTime(record.created_at)}
                              </span>
                              <p className="font-semibold">{t.table}: {record.table_no}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-3 py-1 rounded-full text-sm font-medium ${
                                  record.payment_method === "cash"
                                    ? "bg-emerald-900/50 text-emerald-400"
                                    : "bg-blue-900/50 text-blue-400"
                                }`}
                              >
                                {record.payment_method === "cash" ? t.cash : t.card}
                              </span>
                              {canWrite && (
                                <button
                                  onClick={() => handleDeleteRecord(record)}
                                  className="px-2 py-1 rounded-lg bg-red-900/50 text-red-400 hover:bg-red-800/70 transition-colors text-xs font-medium flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  {t.deleteRecord}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Items */}
                          <div className="bg-zinc-900 rounded-lg p-3 mb-3">
                            {record.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm py-1">
                                <span className="text-zinc-300">
                                  {item.nameKo || item.nameEn} x {item.quantity}
                                </span>
                                <span className="text-zinc-400">
                                  {formatCurrency(item.unitPrice * item.quantity)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Table Subtotal (테이블별 소계) */}
                          <div className="space-y-1 text-sm border-t border-zinc-700 pt-3">
                            <div className="flex justify-between text-zinc-400">
                              <span>{t.subtotal}</span>
                              <span>{formatCurrency(record.subtotal)}</span>
                            </div>
                            {record.vat > 0 && (
                              <div className="flex justify-between text-zinc-400">
                                <span>VAT</span>
                                <span>+{formatCurrency(record.vat)}</span>
                              </div>
                            )}
                            {record.discount > 0 && (
                              <div className="flex justify-between text-red-400">
                                <span>{t.discount}</span>
                                <span>-{formatCurrency(record.discount)}</span>
                              </div>
                            )}
                            {record.card_fee > 0 && (
                              <div className="flex justify-between text-zinc-400">
                                <span>{t.cardFee}</span>
                                <span>+{formatCurrency(record.card_fee)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-bold text-lg pt-2 border-t border-zinc-600">
                              <span>{t.tableTotal}</span>
                              <span className="text-amber-400">{formatCurrency(record.grand_total)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Daily Total (그날의 매출 총액) */}
                      <div className="bg-gradient-to-r from-amber-600/30 to-amber-500/10 rounded-xl p-4 border border-amber-600/50">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-amber-300">
                            {dayGroup.date} {t.totalSales}
                          </span>
                          <div className="text-right">
                            <div className="flex gap-4 text-sm mb-1">
                              <span className="text-emerald-400">{t.cash}: {formatCurrency(dayGroup.dailyCash)}</span>
                              <span className="text-blue-400">{t.card}: {formatCurrency(dayGroup.dailyCard)}</span>
                            </div>
                            <span className="text-xl font-bold text-amber-400">
                              {formatCurrency(dayGroup.dailyTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Monthly View - Grouped by Day */
            <div className="space-y-4">
              {/* Monthly Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <Banknote className="w-5 h-5" />
                    <span className="text-sm">{t.cash}</span>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(monthlyTotals.cash)}</p>
                </div>
                <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <CreditCard className="w-5 h-5" />
                    <span className="text-sm">{t.card}</span>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(monthlyTotals.card)}</p>
                </div>
                <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700 col-span-2">
                  <div className="flex items-center gap-2 text-amber-400 mb-2">
                    <TrendingUp className="w-5 h-5" />
                    <span className="text-sm">{t.totalSales} ({monthlyTotals.count}{t.transactions})</span>
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(monthlyTotals.total)}</p>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-zinc-300">
                {selectedMonth.replace("-", "-")} {t.dailyTotalByDate}
              </h3>
              {monthlyGrouped.length === 0 ? (
                <div className="bg-zinc-800 rounded-xl p-8 text-center text-zinc-500">
                  {t.noRecordsForMonth}
                </div>
              ) : (
                <div className="bg-zinc-800 rounded-xl border border-zinc-700 overflow-hidden">
                  {/* Table Header */}
                  <div className="grid grid-cols-5 gap-2 p-3 bg-zinc-900 text-sm font-semibold text-zinc-400 border-b border-zinc-700">
                    <span>{t.date}</span>
                    <span className="text-right">{t.cash}</span>
                    <span className="text-right">{t.card}</span>
                    <span className="text-right">{t.total}</span>
                    <span className="text-right">{t.count}</span>
                  </div>
                  {/* Table Rows */}
                  {monthlyGrouped.map((day) => (
                    <div
                      key={day.date}
                      className="grid grid-cols-5 gap-2 p-3 border-b border-zinc-700/50 hover:bg-zinc-700/30 transition-colors"
                    >
                      <span className="font-medium">{day.date.slice(5)}</span>
                      <span className="text-right text-emerald-400">
                        {formatCurrency(day.cash)}
                      </span>
                      <span className="text-right text-blue-400">
                        {formatCurrency(day.card)}
                      </span>
                      <span className="text-right font-semibold text-amber-400">
                        {formatCurrency(day.total)}
                      </span>
                      <span className="text-right text-zinc-400">{day.count}{t.transactions}</span>
                    </div>
                  ))}
                  {/* Total Row */}
                  <div className="grid grid-cols-5 gap-2 p-3 bg-zinc-900 font-bold">
                    <span>{t.total}</span>
                    <span className="text-right text-emerald-400">
                      {formatCurrency(monthlyTotals.cash)}
                    </span>
                    <span className="text-right text-blue-400">
                      {formatCurrency(monthlyTotals.card)}
                    </span>
                    <span className="text-right text-amber-400">
                      {formatCurrency(monthlyTotals.total)}
                    </span>
                    <span className="text-right text-zinc-300">{monthlyTotals.count}{t.transactions}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Popup */}
      <DeleteConfirmationPopup
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={executeDelete}
        billId={deleteTarget?.bill_id ?? deleteTarget?.id ?? 0}
        tableNo={deleteTarget?.table_no ?? ""}
        amount={formatCurrency(deleteTarget?.grand_total ?? 0)}
        language={adminLanguage}
      />
    </div>
  )
}
