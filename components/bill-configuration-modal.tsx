"use client"

import { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { X, Percent, CreditCard, Banknote, Calculator, Printer, Share2, Globe, ChevronDown, Eye } from "lucide-react"
import ReceiptPreviewModal, { type ReceiptPreviewItem } from "@/components/receipt-preview-modal"

interface BillConfigurationModalProps {
  isOpen: boolean
  subtotal: number  // 소계 (아이템 합계) — 이미 선택된 통화로 환산된 값
  language: string
  onConfirm: (config: BillConfiguration) => void
  onCancel: () => void
  // 영수증 미리보기용 데이터 (선택)
  storeName?: string
  tableNumber?: string
  receiptItems?: ReceiptPreviewItem[]
  // 현재 선택된 통화 코드 (예: "VND", "KRW", "USD") 및 통화 포맷터.
  // 전달되지 않으면 기존 동작(VND)으로 폴백한다.
  currency?: string
  formatCurrency?: (amount: number) => string
}

export interface BillConfiguration {
  applyVat: boolean
  vatAmount: number
  discountRate: number  // 0, 5, 10, 15
  discountAmount: number
  paymentMethod: 'cash' | 'card' | 'split'
  cardSurcharge: number
  grandTotal: number
  receiptLanguage: string  // 영수증 출력 언어 (UI 언어와 독립적)
  // Split payment fields
  cardAmount?: number
  cashAmount?: number
  splitPaymentMode?: boolean
}

// 지원되는 언어 목록
const SUPPORTED_LANGUAGES = [
  { code: 'ko', label: '한국어 (KR)' },
  { code: 'en', label: 'English (EN)' },
  { code: 'vi', label: 'Tiếng Việt (VN)' },
  { code: 'ja', label: '日本語 (JP)' },
  { code: 'zh', label: '中文 (CN)' },
  { code: 'hi', label: 'हिन्दी (HI)' }
]

// 6개 언어 번역 (KR, EN, VN, JP, CN, HI)
const translations: Record<string, {
  title: string
  vatLabel: string
  yes: string
  no: string
  discountLabel: string
  noDiscount: string
  apply: string
  paymentLabel: string
  cash: string
  card: string
  subtotal: string
  vat: string
  discount: string
  cardSurcharge: string
  grandTotal: string
  confirm: string
  cancel: string
  receiptLanguageLabel: string  // 영수증 출력 언어 라벨
  splitPaymentMode: string
  cardAmount: string
  cashAmount: string
  general: string
  split: string
}> = {
  ko: {
    title: "계산서 옵션 설정",
    vatLabel: "VAT 적용 여부",
    yes: "네",
    no: "아니오",
    discountLabel: "할인 적용",
    noDiscount: "적용안함",
    apply: "적용",
    paymentLabel: "결제 방법",
    cash: "현금",
    card: "카드",
    subtotal: "소계",
    vat: "부가가치세 (10%)",
    discount: "할인",
    cardSurcharge: "카드 수수료 (3%)",
    grandTotal: "최종 합계 금액",
    confirm: "기기공유 (영수증출력)",
    cancel: "돌아가기",
    receiptLanguageLabel: "영수증 출력 언어",
    splitPaymentMode: "결제 모드",
    cardAmount: "카드 결제액",
    cashAmount: "현금 결제액",
    general: "일반",
    split: "분할"
  },
  en: {
    title: "Bill Configuration",
    vatLabel: "Apply VAT?",
    yes: "Yes",
    no: "No",
    discountLabel: "Apply Discount",
    noDiscount: "No Discount",
    apply: "Apply",
    paymentLabel: "Payment Method",
    cash: "Cash",
    card: "Card",
    subtotal: "Subtotal",
    vat: "VAT (10%)",
    discount: "Discount",
    cardSurcharge: "Card Surcharge (3%)",
    grandTotal: "GRAND TOTAL",
    confirm: "Print & Share",
    cancel: "Go Back",
    receiptLanguageLabel: "Receipt Language",
    splitPaymentMode: "Payment Mode",
    cardAmount: "Card Amount",
    cashAmount: "Cash Amount",
    general: "General",
    split: "Split"
  },
  vi: {
    title: "Cấu hình hóa đơn",
    vatLabel: "Áp dụng VAT?",
    yes: "Có",
    no: "Không",
    discountLabel: "Áp dụng giảm giá",
    noDiscount: "Không giảm giá",
    apply: "Áp dụng",
    paymentLabel: "Phương thức thanh toán",
    cash: "Tiền mặt",
    card: "Thẻ",
    subtotal: "Tạm tính",
    vat: "Thuế VAT (10%)",
    discount: "Giảm giá",
    cardSurcharge: "Phụ phí thẻ (3%)",
    grandTotal: "TỔNG CỘNG THÀNH TOÁN",
    confirm: "In & Chia sẻ",
    cancel: "Quay lại",
    receiptLanguageLabel: "Ngôn ngữ in hóa đơn",
    splitPaymentMode: "Chế độ thanh toán",
    cardAmount: "Số tiền thẻ",
    cashAmount: "Số tiền mặt",
    general: "Chung",
    split: "Chia sẻ"
  },
  ja: {
    title: "請求書オプション",
    vatLabel: "VATを適用しますか？",
    yes: "はい",
    no: "いいえ",
    discountLabel: "割引適用",
    noDiscount: "適用しない",
    apply: "適用",
    paymentLabel: "決済方法",
    cash: "現金",
    card: "カード",
    subtotal: "小計",
    vat: "消費税 (10%)",
    discount: "割引",
    cardSurcharge: "カード手数料 (3%)",
    grandTotal: "合計金額",
    confirm: "印刷 & 共有",
    cancel: "戻る",
    receiptLanguageLabel: "レシート言語",
    splitPaymentMode: "決済モード",
    cardAmount: "カード金額",
    cashAmount: "現金金額",
    general: "通常",
    split: "分割"
  },
  zh: {
    title: "账单选项",
    vatLabel: "是否应用增值税？",
    yes: "是",
    no: "否",
    discountLabel: "应用折扣",
    noDiscount: "不应用",
    apply: "应用",
    paymentLabel: "结账方式",
    cash: "现金",
    card: "银行卡",
    subtotal: "小计",
    vat: "增值税 (10%)",
    discount: "折扣",
    cardSurcharge: "刷卡手续费 (3%)",
    grandTotal: "总计金额",
    confirm: "打印 & 分享",
    cancel: "返回",
    receiptLanguageLabel: "收据语言",
    splitPaymentMode: "付款方式",
    cardAmount: "刷卡金额",
    cashAmount: "现金金额",
    general: "通常",
    split: "分割"
  },
  hi: {
    title: "बिल सेटिंग्स",
    vatLabel: "वैट लागू करें?",
    yes: "हाँ",
    no: "नहीं",
    discountLabel: "छूट लागू करें",
    noDiscount: "कोई छूट नहीं",
    apply: "लागू करें",
    paymentLabel: "भुगतान की विधि",
    cash: "नकद",
    card: "कार्ड",
    subtotal: "उप-योग",
    vat: "वैट (10%)",
    discount: "छूट",
    cardSurcharge: "कार्ड शुल्क (3%)",
    grandTotal: "कुल राशि",
    confirm: "प्रिंट और शेयर",
    cancel: "वापस जाएं",
    receiptLanguageLabel: "रसीद भाषा",
    splitPaymentMode: "भुगतान मोड",
    cardAmount: "कार्ड राशि",
    cashAmount: "नकद राशि",
    general: "सामान्य",
    split: "विभाजित"
  }
}

// 미리보기 버튼 라벨 (6개 언어)
const previewButtonLabels: Record<string, string> = {
  ko: "영수증 미리보기",
  en: "Receipt Preview",
  vi: "Xem trước hóa đơn",
  ja: "レシートプレビュー",
  zh: "收据预览",
  hi: "रसीद पूर्वावलोकन",
}

export default function BillConfigurationModal({
  isOpen,
  subtotal,
  language,
  onConfirm,
  onCancel,
  storeName = "",
  tableNumber = "",
  receiptItems = [],
  currency = "VND",
  formatCurrency
}: BillConfigurationModalProps) {
  const [mounted, setMounted] = useState(false)
  const applyVat = true // VAT (10%) is always applied unconditionally
  const [discountRate, setDiscountRate] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'split'>('cash')
  const [receiptLanguage, setReceiptLanguage] = useState(language)  // 기본값: 현재 UI 언어
  const [splitPaymentMode, setSplitPaymentMode] = useState(false)
  const [cashAmount, setCashAmount] = useState(0)
  const [showPreview, setShowPreview] = useState(false)  // 영수증 미리보기 모달 표시 여부

  const t = translations[language] || translations.ko
  const previewLabel = previewButtonLabels[language] || previewButtonLabels.ko

  useEffect(() => {
    setMounted(true)
  }, [])

  // UI 언어가 변경되면 영수증 언어도 동기화 (초기값 설정)
  useEffect(() => {
    setReceiptLanguage(language)
  }, [language])

  // 실시간 계산
  const calculations = useMemo(() => {
    // Split Payment 모드 처리
    if (splitPaymentMode) {
      // VAT (10%) is always applied, so the total owed = subtotal + VAT.
      const vatAmount = applyVat ? Math.round(subtotal * 0.1) : 0
      const baseTotal = subtotal + vatAmount
      // User only enters cash; card auto-calculates as the remaining balance.
      const cardAmount = Math.max(0, baseTotal - cashAmount)
      // 3% card fee applies ONLY to the auto-calculated card amount.
      const cardSurcharge = cardAmount > 0 ? Math.round(cardAmount * 0.03) : 0
      const grandTotal = baseTotal + cardSurcharge
      
      return {
        vatAmount,
        discountAmount: 0,
        cardSurcharge,
        grandTotal,
        cardAmount,
        cashAmount
      }
    }
    
    // 일반 결제 모드 (기존 로직)
    // 1. VAT 계산 (소계의 10%)
    const vatAmount = applyVat ? Math.round(subtotal * 0.1) : 0
    
    // 2. 할인 계산 (소계 + VAT에서 할인)
    const afterVat = subtotal + vatAmount
    const discountAmount = discountRate > 0 ? Math.round(afterVat * (discountRate / 100)) : 0
    
    // 3. 카드 수수료 계산 (할인 후 금액의 3%)
    const afterDiscount = afterVat - discountAmount
    const cardSurcharge = paymentMethod === 'card' ? Math.round(afterDiscount * 0.03) : 0
    
    // 4. 최종 금액
    const grandTotal = afterDiscount + cardSurcharge

    return {
      vatAmount,
      discountAmount,
      cardSurcharge,
      grandTotal,
      // 일반 결제 모드에서는 분할 금액이 없으므로 0으로 채워 형태를 일관되게 유지
      cardAmount: 0,
      cashAmount: 0
    }
  }, [subtotal, applyVat, discountRate, paymentMethod, splitPaymentMode, cashAmount])

  const handleConfirm = () => {
    onConfirm({
      applyVat,
      vatAmount: calculations.vatAmount,
      discountRate,
      discountAmount: calculations.discountAmount,
      paymentMethod: splitPaymentMode ? 'split' : paymentMethod,
      cardSurcharge: calculations.cardSurcharge,
      grandTotal: calculations.grandTotal,
      receiptLanguage,
      splitPaymentMode,
      cardAmount: splitPaymentMode ? calculations.cardAmount : undefined,
      cashAmount: splitPaymentMode ? calculations.cashAmount : undefined
    })
  }

  // 금액 포맷팅 (천단위 콤마)
  const formatAmount = (amount: number) => {
    return amount.toLocaleString()
  }

  // 통화 단위까지 포함한 포맷터. 부모가 formatCurrency를 넘기면 그것을 사용하고
  // (선택된 통화 심볼 ₩/₫/$ 등 반영), 없으면 기존 "숫자 + 통화코드" 형태로 폴백한다.
  const fmt = (amount: number) =>
    formatCurrency ? formatCurrency(amount) : `${formatAmount(amount)} ${currency}`

  if (!mounted || !isOpen) return null

  const modalContent = (
    <div className="fixed inset-0 z-[10000] w-screen h-screen flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700 bg-gradient-to-r from-zinc-800 to-zinc-900">
          <div className="flex items-center gap-3">
            <Calculator className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl font-bold text-white">{t.title}</h2>
          </div>
          <button
            onClick={onCancel}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Split Payment Mode Toggle */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-purple-400" />
              {t.splitPaymentMode}
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSplitPaymentMode(false)
                  setPaymentMethod('cash')
                }}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                  !splitPaymentMode
                    ? 'bg-zinc-700 text-white shadow-lg shadow-zinc-700/30'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                }`}
              >
                {t.general}
              </button>
              <button
                onClick={() => setSplitPaymentMode(true)}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                  splitPaymentMode
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                }`}
              >
                {t.split}
              </button>
            </div>
          </div>

          {/* Split Payment Input Fields */}
          {splitPaymentMode && (
            <div className="space-y-3 bg-zinc-800/30 rounded-xl p-4 border border-zinc-700">
              <div>
                <label className="text-sm font-medium text-zinc-300 block mb-2">{t.cashAmount}</label>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(Math.max(0, Number(e.target.value)))}
                  className="w-full py-2 px-3 rounded-lg font-medium bg-zinc-700 text-white border border-zinc-600 focus:border-purple-500 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-300 block mb-2">{t.cardAmount}</label>
                <input
                  type="number"
                  value={calculations.cardAmount}
                  readOnly
                  className="w-full py-2 px-3 rounded-lg font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-not-allowed focus:outline-none"
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {/* Discount Section */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Percent className="w-4 h-4 text-emerald-400" />
              {t.discountLabel}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[0, 5, 10, 15].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setDiscountRate(rate)}
                  className={`py-3 px-2 rounded-xl font-medium text-sm transition-all ${
                    discountRate === rate
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  {rate === 0 ? t.noDiscount : `${rate}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method Section - Only show in General Mode */}
          {!splitPaymentMode && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-400" />
                {t.paymentLabel}
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    paymentMethod === 'cash'
                      ? 'bg-green-600 text-white shadow-lg shadow-green-600/30'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <Banknote className="w-5 h-5" />
                  {t.cash}
                </button>
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    paymentMethod === 'card'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  {t.card}
                </button>
              </div>
            </div>
          )}

          {/* Real-time Preview */}
          <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-4 space-y-3">
            {splitPaymentMode ? (
              // Split Payment Preview
              <>
                <div className="flex justify-between items-center text-zinc-300">
                  <span>{t.cashAmount}</span>
                  <span className="font-medium text-green-400">{fmt(cashAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-zinc-300">
                  <span>{t.cardAmount}</span>
                  <span className="font-medium text-blue-400">{fmt(calculations.cardAmount)}</span>
                </div>
                {calculations.cardAmount > 0 && (
                  <div className="flex justify-between items-center text-blue-400">
                    <span>+ {t.cardSurcharge}</span>
                    <span className="font-medium">{fmt(calculations.cardSurcharge)}</span>
                  </div>
                )}
              </>
            ) : (
              // General Payment Preview
              <>
                <div className="flex justify-between items-center text-zinc-300">
                  <span>{t.subtotal}</span>
                  <span className="font-medium">{fmt(subtotal)}</span>
                </div>
                
                {applyVat && (
                  <div className="flex justify-between items-center text-amber-400">
                    <span>+ {t.vat}</span>
                    <span className="font-medium">{fmt(calculations.vatAmount)}</span>
                  </div>
                )}
                
                {discountRate > 0 && (
                  <div className="flex justify-between items-center text-emerald-400">
                    <span>- {t.discount} ({discountRate}%)</span>
                    <span className="font-medium">-{fmt(calculations.discountAmount)}</span>
                  </div>
                )}
                
                {paymentMethod === 'card' && (
                  <div className="flex justify-between items-center text-blue-400">
                    <span>+ {t.cardSurcharge}</span>
                    <span className="font-medium">{fmt(calculations.cardSurcharge)}</span>
                  </div>
                )}
              </>
            )}
            
            <div className="border-t border-zinc-600 pt-3 mt-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-white">{t.grandTotal}</span>
                <span className="text-2xl font-bold text-amber-400">
                  {fmt(calculations.grandTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Receipt Language Selector - 영수증 출력 언어 선택 (UI 언어와 독립) */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-purple-400" />
              {t.receiptLanguageLabel}
            </label>
            <div className="relative">
              <select
                value={receiptLanguage}
                onChange={(e) => setReceiptLanguage(e.target.value)}
                className="w-full py-3 px-4 pr-10 rounded-xl font-medium bg-zinc-800 text-white border border-zinc-700 hover:border-zinc-600 focus:border-purple-500 focus:outline-none appearance-none cursor-pointer transition-colors"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
            </div>
          </div>

          {/* Receipt Preview Button - 영수증 미리보기 (출력 전 확인) */}
          <button
            onClick={() => setShowPreview(true)}
            className="w-full py-3 px-4 rounded-xl font-medium bg-zinc-800 text-white border border-zinc-600 hover:bg-zinc-700 hover:border-zinc-500 transition-all flex items-center justify-center gap-2"
          >
            <Eye className="w-5 h-5 text-amber-400" />
            {previewLabel}
          </button>
        </div>

        {/* Footer Buttons */}
        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition-colors"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-4 px-4 rounded-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500 transition-all shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2"
          >
            <Printer className="w-5 h-5" />
            <Share2 className="w-4 h-4" />
            {t.confirm}
          </button>
        </div>
      </div>

      {/* 영수증 미리보기 모달 (출력 전 확인 단계) */}
      <ReceiptPreviewModal
        isOpen={showPreview}
        storeName={storeName}
        tableNumber={tableNumber}
        paymentMethod={splitPaymentMode ? "split" : paymentMethod}
        receiptLanguage={receiptLanguage}
        items={receiptItems}
        subtotal={subtotal}
        vatAmount={calculations.vatAmount}
        discountRate={discountRate}
        discountAmount={calculations.discountAmount}
        cardSurcharge={calculations.cardSurcharge}
        grandTotal={calculations.grandTotal}
        cardAmount={calculations.cardAmount}
        cashAmount={calculations.cashAmount}
        splitPaymentMode={splitPaymentMode}
        currency={currency}
        formatCurrency={formatCurrency}
        onClose={() => setShowPreview(false)}
        onPrint={() => {
          setShowPreview(false)
          handleConfirm()
        }}
      />
    </div>
  )

  return createPortal(modalContent, document.body)
}
