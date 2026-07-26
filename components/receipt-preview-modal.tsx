"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { X, Printer } from "lucide-react"
import { useMenuNameIndex } from "@/hooks/use-menu-name-index"
import { pickLocalized, resolveOrderItemName } from "@/lib/item-name-localization"

export interface ReceiptPreviewItem {
  /**
   * Fallback display name (the language-frozen string saved at order time).
   * Prefer `menuId`/`names`, which let the receipt re-localize into the
   * selected receipt language instead of showing the frozen text.
   */
  name: string
  /** Menu catalog id, used to look the item up in the live catalog. */
  menuId?: string
  /** Per-language names saved on the order, used when the menu was deleted. */
  names?: Record<string, string | undefined>
  modifierText?: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

interface ReceiptPreviewModalProps {
  isOpen: boolean
  storeName: string
  tableNumber: string
  paymentMethod: "cash" | "card" | "split"
  receiptLanguage: string
  items: ReceiptPreviewItem[]
  subtotal: number
  vatAmount: number
  discountRate: number
  discountAmount: number
  cardSurcharge: number
  grandTotal: number
  cardAmount?: number
  cashAmount?: number
  splitPaymentMode?: boolean
  // 선택된 통화 코드와 포맷터 (없으면 기존 VND 동작으로 폴백)
  currency?: string
  formatCurrency?: (amount: number) => string
  onClose: () => void
  onPrint: () => void
}

// 6개 언어 라벨 (KR, EN, VN, JP, CN, HI)
const translations: Record<
  string,
  {
    preview: string
    receiptTitle: string
    billNo: string
    table: string
    date: string
    time: string
    payment: string
    cash: string
    card: string
    split: string
    qty: string
    subtotal: string
    vat: string
    discount: string
    cardSurcharge: string
    grandTotal: string
    cardAmount: string
    cashAmount: string
    close: string
    print: string
    thankYou: string
  }
> = {
  ko: {
    preview: "영수증 미리보기",
    receiptTitle: "영수증",
    billNo: "빌번호",
    table: "테이블",
    date: "날짜",
    time: "시간",
    payment: "결제 방법",
    cash: "현금",
    card: "카드",
    split: "분할 결제",
    qty: "수량",
    subtotal: "소계",
    vat: "부가세 (10%)",
    discount: "할인",
    cardSurcharge: "카드 수수료 (3%)",
    grandTotal: "최종 합계",
    cardAmount: "카드 결제액",
    cashAmount: "현금 결제액",
    close: "닫기",
    print: "출력하기",
    thankYou: "감사합니다.",
  },
  en: {
    preview: "Receipt Preview",
    receiptTitle: "RECEIPT",
    billNo: "Bill No",
    table: "Table",
    date: "Date",
    time: "Time",
    payment: "Payment",
    cash: "Cash",
    card: "Card",
    split: "Split Payment",
    qty: "Qty",
    subtotal: "Subtotal",
    vat: "VAT (10%)",
    discount: "Discount",
    cardSurcharge: "Card Surcharge (3%)",
    grandTotal: "GRAND TOTAL",
    cardAmount: "Card Amount",
    cashAmount: "Cash Amount",
    close: "Close",
    print: "Print",
    thankYou: "Thank You",
  },
  vi: {
    preview: "Xem trước hóa đơn",
    receiptTitle: "HÓA ĐƠN",
    billNo: "Số hóa đơn",
    table: "Bàn",
    date: "Ngày",
    time: "Giờ",
    payment: "Thanh toán",
    cash: "Tiền mặt",
    card: "Thẻ",
    split: "Thanh toán chia",
    qty: "SL",
    subtotal: "Tạm tính",
    vat: "VAT (10%)",
    discount: "Giảm giá",
    cardSurcharge: "Phụ phí thẻ (3%)",
    grandTotal: "TỔNG CỘNG",
    cardAmount: "Số tiền thẻ",
    cashAmount: "Số tiền mặt",
    close: "Đóng",
    print: "In",
    thankYou: "Cảm ơn quý khách",
  },
  ja: {
    preview: "レシートプレビュー",
    receiptTitle: "レシート",
    billNo: "伝票番号",
    table: "テーブル",
    date: "日付",
    time: "時刻",
    payment: "決済方法",
    cash: "現金",
    card: "カード",
    split: "分割決済",
    qty: "数量",
    subtotal: "小計",
    vat: "消費税 (10%)",
    discount: "割引",
    cardSurcharge: "カード手数料 (3%)",
    grandTotal: "合計金額",
    cardAmount: "カード金額",
    cashAmount: "現金金額",
    close: "閉じる",
    print: "印刷",
    thankYou: "ありがとうございました",
  },
  zh: {
    preview: "收据预览",
    receiptTitle: "收据",
    billNo: "账单号",
    table: "餐桌",
    date: "日期",
    time: "时间",
    payment: "结账方式",
    cash: "现金",
    card: "银行卡",
    split: "分开付款",
    qty: "数量",
    subtotal: "小计",
    vat: "增值税 (10%)",
    discount: "折扣",
    cardSurcharge: "刷卡手续费 (3%)",
    grandTotal: "总计金额",
    cardAmount: "刷卡金额",
    cashAmount: "现金金额",
    close: "关闭",
    print: "打印",
    thankYou: "谢谢惠顾",
  },
  hi: {
    preview: "रसीद पूर्वावलोकन",
    receiptTitle: "रसीद",
    billNo: "बिल नं",
    table: "टेबल",
    date: "दिनांक",
    time: "समय",
    payment: "भुगतान",
    cash: "नकद",
    card: "कार्ड",
    split: "विभाजित भुगतान",
    qty: "मात्रा",
    subtotal: "उप-योग",
    vat: "वैट (10%)",
    discount: "छूट",
    cardSurcharge: "कार्ड शुल्क (3%)",
    grandTotal: "कुल राशि",
    cardAmount: "कार्ड राशि",
    cashAmount: "नकद राशि",
    close: "बंद करें",
    print: "प्रिंट",
    thankYou: "धन्यवाद",
  },
}

export default function ReceiptPreviewModal({
  isOpen,
  storeName,
  tableNumber,
  paymentMethod,
  receiptLanguage,
  items,
  subtotal,
  vatAmount,
  discountRate,
  discountAmount,
  cardSurcharge,
  grandTotal,
  cardAmount,
  cashAmount,
  splitPaymentMode,
  currency = "VND",
  formatCurrency,
  onClose,
  onPrint,
}: ReceiptPreviewModalProps) {
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState<Date | null>(null)
  const [billNumber, setBillNumber] = useState<string>("")

  const t = translations[receiptLanguage] || translations.ko

  // Ordered item names are frozen at order time (usually Korean), so re-resolve
  // them against the live menu catalog using the SELECTED RECEIPT LANGUAGE —
  // deliberately not the admin/UI language.
  const menuNameIndex = useMenuNameIndex(isOpen)
  const localizedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        name:
          resolveOrderItemName(
            { menuId: item.menuId, name: item.names ?? item.name },
            receiptLanguage,
            menuNameIndex,
          ) ||
          pickLocalized(item.names as any, receiptLanguage) ||
          item.name,
      })),
    [items, receiptLanguage, menuNameIndex],
  )

  // 매장명이 비어있으면 기본값 사용
  const resolvedStoreName = storeName?.trim() || "LUNA Lounge & Bar"

  useEffect(() => {
    setMounted(true)
  }, [])

  // Capture the timestamp AND generate a bill number when the preview opens.
  // No dedicated bill-number state exists elsewhere, so we derive one from the
  // current timestamp (YYMMDD-HHmmss) which is unique per order session.
  useEffect(() => {
    if (isOpen) {
      const d = new Date()
      setNow(d)
      const pad = (n: number) => String(n).padStart(2, "0")
      const billNo = `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
      setBillNumber(billNo)
    }
  }, [isOpen])

  // 통화 단위 포함 포맷터. 부모가 formatCurrency를 넘기면 선택된 통화 심볼(₩/₫/$ 등)을
  // 반영하고, 없으면 기존 "숫자 + 통화코드" 형태로 폴백한다.
  const fmt = (amount: number) =>
    formatCurrency ? formatCurrency(amount) : `${Math.round(amount).toLocaleString()} ${currency}`

  const paymentLabel =
    paymentMethod === "cash" ? t.cash : paymentMethod === "card" ? t.card : t.split

  if (!mounted || !isOpen) return null

  const modalContent = (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 px-5 py-3">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">{t.preview}</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 transition-colors hover:text-white" aria-label={t.close}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Thermal receipt paper */}
        <div className="overflow-y-auto bg-zinc-800/60 p-4">
          <div className="mx-auto max-w-[300px] bg-neutral-50 px-5 py-6 font-mono text-[13px] leading-relaxed text-neutral-900 shadow-lg">
            {/* 1. Main title + 2. Store name (both center-aligned) */}
            <div className="text-center">
              <p className="text-2xl font-extrabold tracking-[0.25em]">{t.receiptTitle}</p>
              <p className="mt-1 text-base font-bold tracking-wide text-balance">{resolvedStoreName}</p>
            </div>

            <div className="my-3 border-t border-dashed border-neutral-400" />

            {/* 4. Compact metadata — two items per row to keep the receipt short.
                Row 1: Date | Time   Row 2: Bill No | Table   Row 3: Payment.
                text-xs + tight tracking + min-w-0/truncate keep longer EN/VI
                labels from overflowing the receipt width. */}
            <div className="space-y-1 text-xs tracking-tight">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate whitespace-nowrap">
                  <span className="text-neutral-500">{t.date}: </span>
                  <span className="font-semibold">{now ? now.toLocaleDateString() : ""}</span>
                </span>
                <span className="min-w-0 shrink-0 whitespace-nowrap text-right">
                  <span className="text-neutral-500">{t.time}: </span>
                  <span className="font-semibold">{now ? now.toLocaleTimeString() : ""}</span>
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate whitespace-nowrap">
                  <span className="text-neutral-500">{t.billNo}: </span>
                  <span className="font-semibold">{billNumber.includes("-") ? billNumber.split("-")[1] : billNumber.slice(-6)}</span>
                </span>
                <span className="min-w-0 shrink-0 whitespace-nowrap text-right">
                  <span className="text-neutral-500">{t.table}: </span>
                  <span className="font-semibold">{tableNumber}</span>
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-neutral-500">{t.payment}</span>
                <span className="font-semibold">{paymentLabel}</span>
              </div>
            </div>

            <div className="my-3 border-t border-dashed border-neutral-400" />

            {/* Items */}
            <div className="space-y-2">
              {localizedItems.map((item, index) => (
                <div key={`${item.name}-${item.modifierText ?? ""}-${index}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex-1 font-semibold text-pretty">{item.name}</span>
                    <span className="whitespace-nowrap">{fmt(item.lineTotal)}</span>
                  </div>
                  {item.modifierText && (
                    <p className="pl-2 text-[11px] text-neutral-500">└ {item.modifierText}</p>
                  )}
                  <div className="flex justify-between pl-2 text-[11px] text-neutral-500">
                    <span>
                      {t.qty} {item.quantity} × {fmt(item.unitPrice)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="my-3 border-t border-dashed border-neutral-400" />

            {/* Totals */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>{t.subtotal}</span>
                <span>{fmt(subtotal)}</span>
              </div>
              {vatAmount > 0 && (
                <div className="flex justify-between">
                  <span>+ {t.vat}</span>
                  <span>{fmt(vatAmount)}</span>
                </div>
              )}
              {discountRate > 0 && discountAmount > 0 && (
                <div className="flex justify-between">
                  <span>
                    - {t.discount} ({discountRate}%)
                  </span>
                  <span>-{fmt(discountAmount)}</span>
                </div>
              )}
              {cardSurcharge > 0 && (
                <div className="flex justify-between">
                  <span>+ {t.cardSurcharge}</span>
                  <span>{fmt(cardSurcharge)}</span>
                </div>
              )}
            </div>

            <div className="my-3 border-t-2 border-double border-neutral-500" />

            {/* Grand total */}
            <div className="flex items-center justify-between text-base font-bold">
              <span>{t.grandTotal}</span>
              <span>{fmt(grandTotal)}</span>
            </div>

            {/* Split breakdown */}
            {splitPaymentMode && (
              <div className="mt-2 space-y-1 text-[11px] text-neutral-600">
                <div className="flex justify-between">
                  <span>{t.cashAmount}</span>
                  <span>{fmt(cashAmount || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t.cardAmount}</span>
                  <span>{fmt(cardAmount || 0)}</span>
                </div>
              </div>
            )}

            <div className="my-3 border-t border-dashed border-neutral-400" />

            {/* 9. Footer (center-aligned) */}
            <p className="pt-1 text-center text-[13px] font-semibold tracking-wide text-neutral-700">
              {t.thankYou}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-zinc-700 p-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            {t.close}
          </button>
          <button
            onClick={onPrint}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-3 font-bold text-white shadow-lg shadow-amber-600/30 transition-all hover:from-amber-500 hover:to-orange-500"
          >
            <Printer className="h-5 w-5" />
            {t.print}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
