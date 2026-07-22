"use client"

import { useContext, useEffect, useState, useCallback } from "react"
import { LanguageContext, CurrencyContext } from "@/lib/context"
import { type CartItem, type ComboSelectedOption } from "@/lib/cart-context"
import { useTranslatedText } from "@/hooks/use-translated-text"
import { ShoppingCart, Minus, Plus, Trash2, Receipt, CreditCard, Printer, Undo2, Pencil } from "lucide-react"
import { sendTelegramOrder, sendTelegramReceipt, sendTelegramCancellation } from "@/lib/telegram"
import { Separator } from "@/components/ui/separator"
import { useExchangeRates } from "@/hooks/use-exchange-rates"
import { useStoreSettings } from "@/hooks/use-store-settings"
import { createClient } from "@/lib/supabase/client"
import TableConfirmationPopup from "@/components/table-confirmation-popup"
import BillConfigurationModal, { type BillConfiguration } from "@/components/bill-configuration-modal"
  import ReceiptVerificationModal from "@/components/receipt-verification-modal"
import PriceAdjustmentModal from "@/components/price-adjustment-modal"
import { getAdjustmentInfo } from "@/lib/manager-price"

// 언어 및 통화 타입 정의
type Language = "ko" | "en" | "ja" | "zh" | "vi" | "hi"
type Currency = "KRW" | "VND" | "USD" | "JPY" | "CNY" | "THB"

// 다국어 번역 객체
const translations: Record<Language, {
  cart: string
  noItems: string
  totalQuantity: string
  totalPrice: string
  order: string
  telegram?: { table: string }
  accumulated?: {
    orderHistory: string
    accumulatedTotal: string
    billPlease: string
    addedToOrder: string
    orderNumber: string
    noOrders: string
  }
}> = {
  ko: {
    cart: "장바구니",
    noItems: "장바구니가 비어있습니다",
    totalQuantity: "총 수량",
    totalPrice: "총액",
    order: "주문하기",
    telegram: { table: "테이블" },
    accumulated: {
      orderHistory: "주문 내역",
      accumulatedTotal: "누적 금액",
      billPlease: "계산서 요청",
      addedToOrder: "주문이 추가되었습니다",
      orderNumber: "주문",
      noOrders: "아직 주문 내역이 없습니다"
    }
  },
  en: {
    cart: "Cart",
    noItems: "Your cart is empty",
    totalQuantity: "Total Qty",
    totalPrice: "Total",
    order: "Place Order",
    telegram: { table: "Table" },
    accumulated: {
      orderHistory: "Order History",
      accumulatedTotal: "Accumulated Total",
      billPlease: "Request Bill",
      addedToOrder: "Added to order",
      orderNumber: "Order",
      noOrders: "No orders yet"
    }
  },
  ja: {
    cart: "カート",
    noItems: "カートは空です",
    totalQuantity: "合計数量",
    totalPrice: "合計",
    order: "注文する",
    telegram: { table: "テーブル" },
    accumulated: {
      orderHistory: "注文履歴",
      accumulatedTotal: "累計金額",
      billPlease: "お会計",
      addedToOrder: "注文に追加しました",
      orderNumber: "注文",
      noOrders: "まだ注文がありません"
    }
  },
  zh: {
    cart: "购物车",
    noItems: "购物车是空的",
    totalQuantity: "总数量",
    totalPrice: "总计",
    order: "下单",
    telegram: { table: "桌号" },
    accumulated: {
      orderHistory: "订单历史",
      accumulatedTotal: "累计金额",
      billPlease: "结账",
      addedToOrder: "已添加到订单",
      orderNumber: "订单",
      noOrders: "暂无订单"
    }
  },
  vi: {
    cart: "Giỏ hàng",
    noItems: "Giỏ hàng trống",
    totalQuantity: "Tổng SL",
    totalPrice: "Tổng",
    order: "Đặt hàng",
    telegram: { table: "Bàn" },
    accumulated: {
      orderHistory: "Lịch sử",
      accumulatedTotal: "Tổng tích lũy",
      billPlease: "Tính tiền",
      addedToOrder: "Đã thêm vào đơn",
      orderNumber: "Đơn",
      noOrders: "Chưa có đơn hàng"
    }
  },
  hi: {
    cart: "कार्ट",
    noItems: "कार्ट खाली है",
    totalQuantity: "कुल मात्रा",
    totalPrice: "कुल",
    order: "ऑर्डर करें",
    telegram: { table: "टेबल" },
    accumulated: {
      orderHistory: "ऑर्डर इतिहास",
      accumulatedTotal: "कुल राशि",
      billPlease: "बिल दें",
      addedToOrder: "ऑर्डर में जोड़ा गया",
      orderNumber: "ऑर्डर",
      noOrders: "अभी तक कोई ऑर्डर नहीं"
    }
  }
}

// 누적 주문 아이템 타입 - POS/Settlement용 전체 재무 데이터 포함
interface OrderHistoryItem extends CartItem {
  orderedAt: number
  uniqueId: string // 고유 ID (ID 중복 방지)
  // POS/Settlement용 재무 데이터
  tableNumber?: string
  orderDateTime?: string  // ISO 8601 형식
  unitPrice?: number
  unitPriceCurrency?: string
  subtotal?: number
  subtotalCurrency?: string
}

// ============================================================
// RECEIPT-ONLY aggregation (Preview + Physical Print).
// Merges staff-variant rows (e.g. "Lady Charge - Luna / Lin / Alice") back into
// ONE line per base menu item, summing quantities and hiding staff names so the
// physical receipt stays short. This does NOT mutate cart state, orderHistory,
// the Telegram payload, or sales_records — those keep the detailed breakdown.
function aggregateForReceipt(
  source: { item: OrderHistoryItem; totalQty: number }[],
): { item: OrderHistoryItem; totalQty: number }[] {
  const grouped = new Map<string, { item: OrderHistoryItem; totalQty: number }>()
  source.forEach(({ item, totalQty }) => {
    // Combo menus keep their sub-item selections on the receipt, so they must NOT
    // merge with other combos that have different selections. Key them by their
    // combo option signature; regular items merge by base menu id as before.
    const isCombo = Array.isArray(item.comboOptions) && item.comboOptions.length > 0
    const comboKey = isCombo
      ? item.comboOptions!.map((o) => `${o.groupId}.${o.itemId}x${o.quantity}`).join("_")
      : ""
    const key = isCombo ? `${item.id}::${comboKey}` : item.id
    const existing = grouped.get(key)
    if (existing) {
      existing.totalQty += totalQty
    } else {
      // Clone + strip staff modifiers so no staff name renders on the receipt.
      // Combo sub-items are intentionally preserved.
      grouped.set(key, { item: { ...item, selectedModifiers: undefined }, totalQty })
    }
  })
  return Array.from(grouped.values())
}

// Renders one combo sub-item inside a cart line, with +/- controls. The Korean
// source name is translated at render time via useTranslatedText (same mechanism
// as the Main Menu) so it matches the customer's selected language.
function ComboOptionRow({
  cartItemKey,
  option,
  language,
  onUpdateComboOptionQuantity,
}: {
  cartItemKey: string
  option: ComboSelectedOption
  language: string
  onUpdateComboOptionQuantity?: (id: string, comboItemId: string, quantity: number) => void
}) {
  const label = useTranslatedText(option.itemName, language)
  const groupLabel = useTranslatedText(option.groupName, language)
  return (
    <div className="flex items-center justify-between gap-2 pl-3 py-1">
      <p className="text-xs text-zinc-300 truncate flex-1 min-w-0">
        <span className="text-zinc-500">{groupLabel}:</span> {label}
      </p>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() =>
            onUpdateComboOptionQuantity?.(cartItemKey, option.itemId, Math.max(0, (option.quantity || 1) - 1))
          }
          className="w-6 h-6 rounded-full bg-zinc-700 active:bg-zinc-600 flex items-center justify-center text-white touch-manipulation cursor-pointer"
          aria-label="minus"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="w-6 text-center text-white text-xs font-medium">{option.quantity}</span>
        <button
          type="button"
          onClick={() =>
            onUpdateComboOptionQuantity?.(cartItemKey, option.itemId, (option.quantity || 1) + 1)
          }
          className="w-6 h-6 rounded-full bg-zinc-700 active:bg-zinc-600 flex items-center justify-center text-white touch-manipulation cursor-pointer"
          aria-label="plus"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

interface CartPopupProps {
  isOpen: boolean
  onClose: () => void
  cart: CartItem[]
  onUpdateQuantity: (id: string, quantity: number) => void
  onRemove: (id: string) => void
  onUpdatePrice?: (id: string, priceAmount: number) => void
  onUpdateComboOptionQuantity?: (id: string, comboItemId: string, quantity: number) => void
  onClearCart?: () => void
  selectedTable?: string | null
  onSessionReset?: () => void
}

export default function CartPopup({ 
  isOpen, 
  onClose, 
  cart, 
  onUpdateQuantity, 
  onRemove, 
  onUpdatePrice,
  onUpdateComboOptionQuantity,
  onClearCart, 
  selectedTable,
  onSessionReset
}: CartPopupProps) {
  const language = useContext(LanguageContext) as Language
  const currency = useContext(CurrencyContext) as Currency
  
  // 핵심 State: 누적 주문 내역 (독립된 useState)
  const [orderHistory, setOrderHistory] = useState<OrderHistoryItem[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  
  // 처리 중 상태 (Ghost Click 및 중복 실행 방지)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // 장바구니 내 가격 수정 모달 대상 아이템
  const [priceAdjustItem, setPriceAdjustItem] = useState<CartItem | null>(null)
  
  // STEP 1 & 2: 체크아웃 플로��� 모달 상태 (오직 ���종계산요청에서만 사용)
  // 주의: 이 상태들은 절대로 handleOrder (주문하기)에서 변경하지 않음
  const [showTableConfirmation, setShowTableConfirmation] = useState(false)
  const [showBillConfig, setShowBillConfig] = useState(false)
  const [pendingBillData, setPendingBillData] = useState<{
    billNumber: number | null
    totalAmount: number
    historySnapshot: { item: OrderHistoryItem; totalQty: number }[]
    tableSnapshot: string | null | undefined
  } | null>(null)
  
  // STEP 5: 영수증 확인 모달 상태 (인쇄 후, Telegram 공유 전 버퍼)
  const [showReceiptVerification, setShowReceiptVerification] = useState(false)
  const [pendingBillText, setPendingBillText] = useState<string>("")
  const [pendingBillConfig, setPendingBillConfig] = useState<BillConfiguration | null>(null)
  
  // 블루투스 프린터 연결 상태
  const [btPrinterConnected, setBtPrinterConnected] = useState(false)
  const [btPrinterName, setBtPrinterName] = useState<string | null>(null)
  const [btPrinting, setBtPrinting] = useState(false)
  
  // ★ 직전 주문 취소를 위한 상태 (Last Order Bundle)
  const [lastOrderBundle, setLastOrderBundle] = useState<OrderHistoryItem[] | null>(null)
  const [lastOrderNumber, setLastOrderNumber] = useState<number | null>(null)
  const [orderCounter, setOrderCounter] = useState<number>(1)
  
  // 무한 루프 방지 - sessionStorage 기반 물리적 락
  // useRef/useState는 iOS에서 페이지 포커스 복귀시 JS 재실행되어도 초기화됨
  // sessionStorage는 브라우저 탭 세션 동안 유지되므로 확실한 차단 가능
  const TELEGRAM_ORDER_LOCK_KEY = 'telegram_order_lock'
  const TELEGRAM_BILL_LOCK_KEY = 'telegram_bill_lock'
  
  const { convertPrice: convertPriceWithRates, formatPrice, loading: ratesLoading } = useExchangeRates()

  // localStorage 키 (테이블별)
  const getStorageKey = useCallback(() => {
    return `orderHistory_${selectedTable || 'default'}`
  }, [selectedTable])
  
  // 직전 주문 백업 키 (테이블별)
  const getLastOrderKey = useCallback(() => {
    return `lastOrderBundle_${selectedTable || 'default'}`
  }, [selectedTable])
  
  // 주문 번호 카운터 키 (테이블별)
  const getOrderCounterKey = useCallback(() => {
    return `orderCounter_${selectedTable || 'default'}`
  }, [selectedTable])

  // 컴포넌트 마운트 시 누적 주문 로드 + sessionStorage 락 해제 (Lifecycle Reset)
  useEffect(() => {
    // 무한 루프 방지 락 해제 - 컴포넌트가 새로 마운트되면 새 주문 가능
    try {
      sessionStorage.removeItem(TELEGRAM_ORDER_LOCK_KEY)
      sessionStorage.removeItem(TELEGRAM_BILL_LOCK_KEY)
    } catch (e) {
      // sessionStorage 접근 실패시 무시
    }
    
    const stored = localStorage.getItem(getStorageKey())
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setOrderHistory(Array.isArray(parsed) ? parsed : [])
      } catch {
        setOrderHistory([])
      }
    } else {
      setOrderHistory([])
    }
    
    // 직전 주문 백업 로드
    const lastOrderStored = localStorage.getItem(getLastOrderKey())
    if (lastOrderStored) {
      try {
        const parsed = JSON.parse(lastOrderStored)
        setLastOrderBundle(Array.isArray(parsed) ? parsed : null)
      } catch {
        setLastOrderBundle(null)
      }
    }
    
    // 주문 카운터 로드
    const counterStored = localStorage.getItem(getOrderCounterKey())
    if (counterStored) {
      try {
        setOrderCounter(parseInt(counterStored, 10) || 1)
      } catch {
        setOrderCounter(1)
      }
    }
    
    setIsInitialized(true)
  }, [getStorageKey, getLastOrderKey, getOrderCounterKey])

  // 팝업이 열릴 때마다 모달 상태를 명시적으로 초기화
  // 이렇게 하면 주문하기 버튼으로 인해 모달이 열리는 버그 방지
  useEffect(() => {
    if (isOpen) {
      // 팝업이 새로 열릴 때 모든 모달 상태를 false로 리셋
      setShowTableConfirmation(false)
      setShowBillConfig(false)
      setPendingBillData(null)
    }
  }, [isOpen])

  // orderHistory가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(getStorageKey(), JSON.stringify(orderHistory))
    }
  }, [orderHistory, getStorageKey, isInitialized])

  const t = translations[language]
  const accT = (t as any).accumulated || {
    orderHistory: "주문 내역",
    accumulatedTotal: "누적 금액",
    billPlease: "계산서 요청",
    addedToOrder: "주문이 추가되었습니다",
    orderNumber: "주문",
    noOrders: "아직 주문 내역이 없습니다",
  }

  const getMenuName = (item: CartItem | OrderHistoryItem): string => {
    const nameKey =
      `name${language === "ko" ? "Ko" : language === "en" ? "En" : language === "ja" ? "Ja" : language === "zh" ? "Zh" : language === "vi" ? "Vi" : language === "hi" ? "Hi" : "Ko"}` as keyof CartItem
    return (item[nameKey] as unknown as string) || item.nameKo || "메뉴"
  }

  // 영수증 출력용 메뉴 이름 (선택된 영수증 언어 사용)
  const getMenuNameForReceipt = (item: CartItem | OrderHistoryItem, receiptLang: string): string => {
    const nameKey =
      `name${receiptLang === "ko" ? "Ko" : receiptLang === "en" ? "En" : receiptLang === "ja" ? "Ja" : receiptLang === "zh" ? "Zh" : receiptLang === "vi" ? "Vi" : receiptLang === "hi" ? "Hi" : "Ko"}` as keyof CartItem
    return (item[nameKey] as unknown as string) || item.nameKo || "메뉴"
  }

  // 금액 변환
  const convertAmount = (amount: number, sourceCurrency: string): number => {
    if (sourceCurrency === currency) {
      return amount
    }
    return convertPriceWithRates(amount, sourceCurrency, currency)
  }

  // 아이템 가격 포맷팅
  const getItemPrice = (item: CartItem | OrderHistoryItem): string => {
    const sourceCurrency = item.priceCurrency || "KRW"
    const sourceAmount = item.priceAmount ?? item.priceKRW ?? 0
    const convertedPrice = convertAmount(sourceAmount, sourceCurrency)
    return formatPrice(convertedPrice, currency)
  }

  // 아��템 총액 계산
  const getItemTotal = (item: CartItem | OrderHistoryItem): number => {
    const sourceCurrency = item.priceCurrency || "KRW"
    const sourceAmount = item.priceAmount ?? item.priceKRW ?? 0
    const quantity = Number(item.quantity) || 0
    return convertAmount(sourceAmount, sourceCurrency) * quantity
  }

  // 현재 장바구니 총액
  const cartTotal = cart.reduce((sum, item) => sum + getItemTotal(item), 0)
  const cartQuantity = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)

  // 누적 주문 총액 계산 (동일 메뉴 합산)
  // AGGREGATE BY cartItemKey: items are combined ONLY when their unique cartItemKey
  // matches (e.g. "lady-charge-Luna"). This keeps distinct staff selections
  // (Luna / Lin / Alice) as separate rows while still summing the quantities of
  // truly identical items submitted across multiple orders. Falls back to the base
  // id for plain items that carry no modifiers.
  const getMergedOrderHistory = useCallback(() => {
    // Use a Map to guarantee insertion order and avoid key collisions with object prototypes.
    const merged = new Map<string, { item: OrderHistoryItem; totalQty: number }>()

    orderHistory.forEach((historyItem) => {
      const aggregationKey = historyItem.cartItemKey || historyItem.id
      const existing = merged.get(aggregationKey)
      if (existing) {
        // Same unique key already in history -> add the new quantity to that row.
        existing.totalQty += Number(historyItem.quantity) || 0
      } else {
        // New unique key -> append as a fresh row, preserving selectedModifiers.
        merged.set(aggregationKey, {
          item: historyItem,
          totalQty: Number(historyItem.quantity) || 0,
        })
      }
    })

    return Array.from(merged.values())
  }, [orderHistory])

  const mergedHistory = getMergedOrderHistory()
  const orderHistoryTotal = orderHistory.reduce((sum, item) => sum + getItemTotal(item), 0)

  // 매장 설정 (영수증 상단 매장명)
  const { settings: storeSettings } = useStoreSettings()

  // 영수증 미리보기용 아이템 목록 — cartItemKey 기반 합산 결과를 다시 "품명" 단위로 병합.
  // 스태프 이름(모디파이어)은 영수증에서 숨기고 동일 품목의 수량/금액만 합산한다.
  // 결제 진행 시 스냅샷(pendingBillData.historySnapshot)이 있으면 그것을, 없으면 현재 mergedHistory를 사용.
  const receiptPreviewSource = aggregateForReceipt(pendingBillData?.historySnapshot || mergedHistory)
  const receiptPreviewItems = receiptPreviewSource.map(({ item, totalQty }) => {
    const sourceCurrency = item.priceCurrency || "KRW"
    const sourceAmount = item.priceAmount ?? item.priceKRW ?? 0
    const unitPrice = convertAmount(sourceAmount, sourceCurrency)
    // 스태프 이름은 영수증에 표시하지 않으므로 modifierText 없음.
    return {
      name: getMenuName(item),
      quantity: totalQty,
      unitPrice,
      lineTotal: unitPrice * totalQty,
    }
  })


  // ============================================================
  // 주문서 텍스트 생성 (전체 재무 데이터 포함)
  // ============================================================
  const generateOrderText = (items: CartItem[], table: string | null | undefined, total: number): string => {
    const now = new Date()
    
    // 언어별 날짜/시간 포맷
    const localeMap: Record<Language, string> = {
      ko: 'ko-KR',
      en: 'en-US',
      ja: 'ja-JP',
      zh: 'zh-CN',
      es: 'es-ES',
      th: 'th-TH',
      vi: 'vi-VN'
    }
    const locale = localeMap[language] || 'ko-KR'
    const dateStr = now.toLocaleDateString(locale)
    const timeStr = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    
    // 언어별 텍스트 템플릿
    const templates: Record<Language, {
      header: string
      table: string
      tableNotSet: string
      time: string
      total: string
      footer: string
    }> = {
      ko: {
        header: '[주문서 접수]',
        table: '테이블',
        tableNotSet: '미지정',
        time: '시간',
        total: '총 금액',
        footer: '주문 확인 부탁드립니다!'
      },
      en: {
        header: '[Order Receipt]',
        table: 'Table',
        tableNotSet: 'Not assigned',
        time: 'Time',
        total: 'Total',
        footer: 'Please confirm the order!'
      },
      ja: {
        header: '[注文書]',
        table: 'テーブル',
        tableNotSet: '未指定',
        time: '時間',
        total: '合計金額',
        footer: 'ご���認お願いします！'
      },
      zh: {
        header: '[订单收据]',
        table: '桌号',
        tableNotSet: '未指定',
        time: '时间',
        total: '总金额',
        footer: '请确认订单！'
      },
      es: {
        header: '[Recibo de Pedido]',
        table: 'Mesa',
        tableNotSet: 'No asignada',
        time: 'Hora',
        total: 'Total',
        footer: '¡Por favor confirme el pedido!'
      },
      th: {
        header: '[ใ�������������เสร็จคำสั่งซื้อ]',
        table: 'โต๊ะ',
        tableNotSet: 'ไม่ระบุ',
        time: 'เวลา',
        total: 'ยอดรวม',
        footer: '���ร�������า���ืนยันคำสั่งซื้อ!'
      },
      vi: {
        header: '[Đơn hàng mới]',
        table: 'Bàn',
        tableNotSet: 'Chưa chỉ định',
        time: 'Thời gian',
        total: 'Tổng tiền',
        footer: 'Vui lòng xác nh��n đơn hàng!'
      }
    }
    
    const tmpl = templates[language] || templates.ko
    
    let text = `${tmpl.header}\n`
    text += `━━━━━━━━━━━━━���������━━\n`
    text += `${tmpl.table}: ${table || tmpl.tableNotSet}\n`
    text += `${tmpl.time}: ${dateStr} ${timeStr}\n`
    text += `━━━━━━━━━━━━━━━━\n\n`
    
    // 베트남어: "Chi tiết đơn hàng:" 추가
    if (language === 'vi') {
      text += `Chi tiết đơn hàng:\n`
    }
    
    items.forEach((item, index) => {
      const itemName = getMenuName(item) // 이미 언어별 이름 반환
      const qty = item.quantity || 1
      text += `${index + 1}. ${itemName} x ${qty}\n`
    })
    
    text += `\n━━━━━━━━━━━━━━━━\n`
    text += `${tmpl.total}: ${formatPrice(total, currency)}\n`
    text += `━━━━━━━━━━━━━━━━\n`
    text += `\n${tmpl.footer}`
    
    return text
  }

  // ============================================================
  // Telegram 메시지 생성 - 간결한 알림용 (가격 제외, 아이템명과 수량만)
  // Format: [LUNA Lounge & Bar - New Order]
  //         Table Number: (테이블)
  //         Time: (시간)
  //         Items: - 메뉴명 x 수량
  // ============================================================
  const generateTelegramMessage = (items: CartItem[], table: string | null | undefined): string => {
    const now = new Date()
    const dateStr = now.toLocaleDateString('ko-KR')
    const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    
    let text = `[LUNA Lounge & Bar - New Order]\n\n`
    text += `Table Number: ${table || 'N/A'}\n`
    text += `Time: ${dateStr} ${timeStr}\n\n`
    text += `Items:\n`
    
    items.forEach((item) => {
      // 영어 이름 우선, 없으면 한국어 이름
      const itemName = item.nameEn || item.nameKo || 'Menu Item'
      const qty = item.quantity || 1
      text += `- ${itemName} x ${qty}\n`
    })
    
    return text
  }

  // ============================================================
  // [주문하기] 버튼 핸들러 - 중간 주문 전용 (Intermediate Order)
  // 주의: 이 핸들러는 절대로 showTableConfirmation 또는 showBillConfig를 변경하지 않음
  // 모달은 오직 handleRequestBill (최종계산요청)에서만 열림
  // ============================================================
  // 플로우: 클립보드 복사 + Telegram Bot API 전송 (아이템명/수량만, 금액 없음)
  // 무한 루프 방지: sessionStorage 물리적 락 사용
  // ============================================================
  const handleOrder = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    // ★ 1. sessionStorage 물리적 락 체크 (가장 먼저 - 재실행 방지)
    try {
      if (sessionStorage.getItem(TELEGRAM_ORDER_LOCK_KEY) === 'true') {
        return // 페이지 복귀시 재실행되어도 여기서 차단됨
      }
    } catch (e) {
      // sessionStorage 접근 실패시 계속 진행
    }

    // 2. 이벤트 버블링 완벽 차단
    if (e) {
      e.preventDefault()
      e.stopPropagation()
      if ('nativeEvent' in e && e.nativeEvent?.stopImmediatePropagation) {
        e.nativeEvent.stopImmediatePropagation()
      }
    }

    // 3. 중복 실행 방지 (Ghost Click 방지)
    if (isProcessing) return
    
    // 4. 장바구니가 비어있으면 리턴
    if (cart.length === 0) {
      return
    }

    // ★ 5. 즉시 sessionStorage 락 설정 (Telegram 호출 전에 반드시)
    try {
      sessionStorage.setItem(TELEGRAM_ORDER_LOCK_KEY, 'true')
    } catch (e) {
      // sessionStorage 접근 실패시 계속 진행
    }
    
    // 6. 처리 시작 - 버튼 즉시 비활성화
    setIsProcessing(true)

    // 주문 데이터를 미리 복사 (클로저 문제 방지)
    const cartSnapshot = [...cart]
    const tableSnapshot = selectedTable
    const cartTotalSnapshot = cartTotal

    // 클립보드용 전체 주문서 텍스트 (재무 데이터 포함)
    const orderText = generateOrderText(cartSnapshot, tableSnapshot, cartTotalSnapshot)
    
    // Telegram용 간결한 메시지 (가격 제외, 아이템명과 수량만)
    const telegramMessage = generateTelegramMessage(cartSnapshot, tableSnapshot)

    // 7. 상태 업데이트의 안전한 지연 (300ms) - 터치 이벤트 완전 종�� 후 실행
    setTimeout(async () => {
      try {
        // 1단계: cart를 orderHistory에 ������ (전체 재무 데�����터 포함)
        // POS/Settlement용 데이터: 테이���번호, 주문일시, 메뉴명, 수량, 단가, 소계
        const timestamp = Date.now()
        const orderDateTime = new Date(timestamp).toISOString()
        const currentOrderNumber = orderCounter
        
        // ★ 주문 내역/영수증 저장용: 가격이 0인 아이템(예: 얼음, 직원 호출)은 제외
        // Telegram 알림에는 전체 아이템이 포함되지만, 누적 내역/청구서에는 price > 0 아이템만 저장
        const billableCartSnapshot = cartSnapshot.filter((item) => {
          const unitPrice = item.priceAmount ?? item.priceKRW ?? 0
          return unitPrice > 0
        })

        const newHistoryItems: OrderHistoryItem[] = billableCartSnapshot.map((item, index) => {
          const sourceCurrency = item.priceCurrency || "KRW"
          const unitPrice = item.priceAmount ?? item.priceKRW ?? 0
          const quantity = Number(item.quantity) || 1
          const subtotal = unitPrice * quantity
          
          return {
            ...item,
            // 주문 추적용 메타데이터
            orderedAt: timestamp,
            uniqueId: `${item.id}_${timestamp}_${index}`,
            // POS/Settlement용 재무 데이터
            tableNumber: tableSnapshot || 'N/A',
            orderDateTime: orderDateTime,
            unitPrice: unitPrice,
            unitPriceCurrency: sourceCurrency,
            subtotal: subtotal,
            subtotalCurrency: sourceCurrency,
          }
        })

        // ★ Telegram ORDER 알림 전송 (Vietnamese only)
        const telegramDateTime = new Date(timestamp).toLocaleString('vi-VN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
        
        await sendTelegramOrder({
          orderNumber: currentOrderNumber,
          tableNumber: tableSnapshot || 'N/A',
          items: cartSnapshot.map(item => ({
            nameVi: item.nameVi,
            nameKo: item.nameKo,
            nameEn: item.nameEn,
            quantity: item.quantity,
            selectedModifiers: item.selectedModifiers,
            comboOptions: item.comboOptions
          })),
          dateTime: telegramDateTime
        })

        // 2단계: setOrderHistory로 병합
        setOrderHistory(prev => {
          const updated = [...prev, ...newHistoryItems]
          try {
            localStorage.setItem(getStorageKey(), JSON.stringify(updated))
          } catch (storageError) {
            console.error("localStorage 저장 실패:", storageError)
          }
          return updated
        })
        
        // ★ 직전 주문 백업 저장 (취소용)
        setLastOrderBundle(newHistoryItems)
        setLastOrderNumber(currentOrderNumber)
        try {
          localStorage.setItem(getLastOrderKey(), JSON.stringify(newHistoryItems))
          localStorage.setItem(getLastOrderKey() + '_number', String(currentOrderNumber))
        } catch (e) {
          console.error("직전 주문 저장 실패:", e)
        }
        
        // ★ 주문 번호 증가
        const nextOrderNumber = currentOrderNumber + 1
        setOrderCounter(nextOrderNumber)
        try {
          localStorage.setItem(getOrderCounterKey(), String(nextOrderNumber))
        } catch (e) {
          console.error("주문 번호 저장 실패:", e)
        }

        // 3단�������: �����바구니 �����������우기
        if (onClearCart) {
          onClearCart()
        }

        // ★ 4단계: UI - 팝업 닫지 않고 테이블누적내역 화면 유지
        // onClose() 호출 제거 - 사용자가 바로 누적내역 확인 가능

      } catch (error) {
        console.error("주문 처리 중 오류:", error)
        // 오류 발생시 락 해제
        try {
          sessionStorage.removeItem(TELEGRAM_ORDER_LOCK_KEY)
        } catch (e) {}
      } finally {
        // 처리 완료 (버튼 다시 활성화)
        setIsProcessing(false)
        // 3초 후 락 해제 (새 주문 가능하도록)
        setTimeout(() => {
          try {
            sessionStorage.removeItem(TELEGRAM_ORDER_LOCK_KEY)
          } catch (e) {}
        }, 3000)
      }
    }, 300) // 300ms 지연으로 터치 이벤트 완전 종료 보장

  }, [cart, onClearCart, selectedTable, getStorageKey, getLastOrderKey, getOrderCounterKey, orderCounter, formatPrice, cartTotal, currency, isProcessing, language])

  // ============================================================
  // 최종 계산서 텍스트 생성 - 언어별 다국어 지원 + 빌 번호 포함
  // ============================================================
  // 최종 계산서 텍스트 생성 - Telegram 메시지 & 영수증 동일 포맷
  // 전체 재무 데이터 포함: 단가, 소계, 총액
  // ============================================================
  const generateBillText = (
    historyItems: { item: OrderHistoryItem; totalQty: number }[], 
    table: string | null | undefined, 
    total: number,
    billNumber?: number | null  // 빌 번호 추가
  ): string => {
    const now = new Date()
    
    // 언어별 날짜/시간 포맷
    const localeMap: Record<string, string> = {
      ko: 'ko-KR',
      en: 'en-US',
      ja: 'ja-JP',
      zh: 'zh-CN',
      vi: 'vi-VN',
      hi: 'hi-IN'
    }
    const locale = localeMap[language] || 'ko-KR'
    const dateStr = now.toLocaleDateString(locale)
    const timeStr = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    
    // 언어별 텍스트 템플��� (��체 ����� 데이터 포함)
  const templates: Record<string, {
  header: string
  billNo: string
  table: string
  tableNotSet: string
  date: string
  itemsHeader: string
  total: string
  footer: string
  qty: string
  unitPrice: string
  }> = {
  ko: {
  header: '[LUNA Lounge & Bar - 최종 계산서]',
  billNo: '빌 번호',
  table: '테이블',
  tableNotSet: '미지정',
  date: '일시',
  itemsHeader: '주문 내역',
  total: '총 금액',
  footer: '계산 부탁드립니다!',
  qty: '수량',
  unitPrice: '단가'
  },
  en: {
  header: '[LUNA Lounge & Bar - Final Bill]',
  billNo: 'Bill No',
  table: 'Table',
  tableNotSet: 'Not assigned',
  date: 'Date',
  itemsHeader: 'Order Details',
  total: 'TOTAL AMOUNT',
  footer: 'Thank you for visiting!',
  qty: 'Qty',
  unitPrice: 'Unit'
  },
  ja: {
  header: '[LUNA Lounge & Bar - 最終請求書]',
  billNo: '伝票番号',
  table: 'テーブル',
  tableNotSet: '未指定',
  date: '日時',
  itemsHeader: '注文内容',
  total: '合計金額',
  footer: 'ご利用ありがとうございます！',
  qty: '数量',
  unitPrice: '単価'
  },
  zh: {
  header: '[LUNA Lounge & Bar - 最终账单]',
  billNo: '账单号',
  table: '桌号',
  tableNotSet: '未指定',
  date: '日期',
  itemsHeader: '订单明细',
  total: '总金额',
  footer: '感谢光临！',
  qty: '数量',
  unitPrice: '单价'
  },
  es: {
  header: '[LUNA Lounge & Bar - Cuenta Final]',
  billNo: 'Número',
  table: 'Mesa',
  tableNotSet: 'No asignada',
  date: 'Fecha',
  itemsHeader: 'Detalles del pedido',
  total: 'TOTAL',
  footer: '¡Gracias por su visita!',
  qty: 'Cant',
  unitPrice: 'P.Unit'
  },
  th: {
  header: '[LUNA Lounge & Bar - บิลสุดท้าย]',
  billNo: 'หมายเลขบิล',
  table: 'โต๊ะ',
  tableNotSet: 'ไม่ระบุ',
  date: 'วันที่',
  itemsHeader: 'รายการสั่งซื้อ',
  total: 'ยอดรวม',
  footer: 'ขอบคุณที่มาเยี่ยมชม!',
  qty: '���น.',
  unitPrice: 'ราคา'
  },
  vi: {
  header: '[LUNA Lounge & Bar - Hóa đơn cuối]',
  billNo: 'Số HD',
  table: 'Bàn',
  tableNotSet: 'Chưa chỉ định',
  date: 'Ngày',
  itemsHeader: 'Chi ti���t đơn hàng',
  total: 'TỔNG CỘNG',
  footer: 'Cảm ơn quý khách!',
  qty: 'SL',
  unitPrice: 'Đơn giá'
  },
  hi: {
  header: '[LUNA Lounge & Bar - अंतिम बिल]',
  billNo: 'बिल नंबर',
  table: 'टेबल',
  tableNotSet: 'निर्धारित नहीं',
  date: 'दिनांक',
  itemsHeader: 'आर्डर विवरण',
  total: 'कुल राशि',
  footer: 'आने के लिए धन्यवाद!',
  qty: 'मात्रा',
  unitPrice: 'इकाई मूल्य'
  }
  }
    
    const tmpl = templates[language] || templates.ko
    
    // 헤더 섹션
    let text = `${tmpl.header}\n`
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`
    if (billNumber) {
      text += `${tmpl.billNo}: #${billNumber}\n`
    }
    text += `${tmpl.table}: ${table || tmpl.tableNotSet}\n`
    text += `${tmpl.date}: ${dateStr} ${timeStr}\n`
    text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`
    
    // 아이템 헤더
    text += `📋 ${tmpl.itemsHeader}\n`
    text += `────────────────────────\n`
    
    // 각 아이템 상세 (단가, 수량, 소계 포함)
    historyItems.forEach((entry) => {
      const item = entry.item
      const qty = entry.totalQty
      const unitPrice = item.priceAmount ?? item.priceKRW ?? 0
      const subtotal = unitPrice * qty
      
  // 메뉴 이름 (언어별)
  const itemName = getMenuName(item)
      
      // 포맷: 메뉴명 x 수량 : 단가 → 소계
      text += `• ${itemName} x ${qty}\n`
      text += `  ${formatPrice(unitPrice, currency)} → ${formatPrice(subtotal, currency)}\n`
    })
    
    // 총액 섹션
    text += `\n━━━━━━━━━━━━━━━━━━━━━━\n`
    text += `💰 ${tmpl.total}: ${formatPrice(total, currency)}\n`
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`
    text += `\n${tmpl.footer}`
    
    return text
  }

  // ============================================================
  // [최종 계산서 요청] 버튼 핸들러 - 최종 체크아웃 전용
  // STEP 1: 테이�� 확인 모달 표시 (setShowTableConfirmation)
  // 주의: 이것은 오직 최종계산요청 버튼에서만 호출됨
  // ============================================================
  const handleRequestBill = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    // 이벤트 버블링 차단
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    // 중복 실행 방지
    if (isProcessing) return
    if (orderHistory.length === 0) return

    // STEP 1: 테이블 확인 모달 표���
    setShowTableConfirmation(true)
  }, [orderHistory, isProcessing])

  // ============================================================
  // STEP 2: 테이블 확인 완료 -> 빌 번호 생성 후 빌 설정 모달 표시
  // ============================================================
  const handleTableConfirmed = useCallback(async () => {
    setShowTableConfirmation(false)
    setIsProcessing(true)

    // 데이터 스냅샷 (클로저 문제 방지)
    const totalAmount = orderHistoryTotal
    const historySnapshot = [...mergedHistory]
    const tableSnapshot = selectedTable

    // 주문 상세 정보 생성 (JSONB로 저장)
    const orderDetails = historySnapshot.map(({ item, totalQty }) => ({
      menuId: item.id,
      nameKo: item.nameKo,
      nameEn: item.nameEn,
      nameVi: item.nameVi,
      quantity: totalQty,
      unitPrice: item.priceAmount ?? item.priceKRW ?? 0,
      currency: item.priceCurrency || "KRW",
    }))

    try {
      // Supabase 클라이언트 생성
      const supabase = createClient()
      let billNumber: number | null = null

      if (supabase) {
        // Supabase bills 테이���에 insert하����� 생성된 id(빌 번호)를 받아옴
        const { data, error } = await supabase
          .from('bills')
          .insert({
            table_no: tableSnapshot || 'N/A',
            order_details: orderDetails,
            total_amount: totalAmount,
            currency: currency,
          })
          .select('id')
          .single()

        if (error) {
          console.error("빌 생성 실패:", error)
          setIsProcessing(false)
          return
        }

        billNumber = data?.id ?? null
      }

      // 빌 데이터 저장 (STEP 3에서 사용)
      setPendingBillData({
        billNumber,
        totalAmount,
        historySnapshot,
        tableSnapshot
      })

      // STEP 2: 빌 설정 모달 표시
      setShowBillConfig(true)
      setIsProcessing(false)

    } catch (error) {
      console.error("빌 생성 중 오류:", error)
      setIsProcessing(false)
    }
  }, [orderHistoryTotal, mergedHistory, selectedTable, currency])

  // ============================================================
  // STEP 4: 빌 설정 완료 -> 새 창 인쇄 + 확인 모�� ���시
  // ★ 완전 리팩토링: @media print CSS 방식 폐기, 격리된 인쇄 창 사용
  // ============================================================
  const handleBillConfigConfirm = useCallback(async (config: BillConfiguration) => {
    if (!pendingBillData) return

    const { billNumber, totalAmount, historySnapshot, tableSnapshot } = pendingBillData

    // 금액 포맷팅 함수
    const formatAmount = (amount: number) => amount.toLocaleString()

    // 6개 언�� ���원 메시지 템플릿 (KR, EN, VN, JP, CN, HI)
    const templates: Record<string, {
      header: string
      billNo: string
      table: string
      date: string
      subtotal: string
      vat: string
      discount: string
      cardSurcharge: string
      payment: string
      cash: string
      card: string
      split: string
      grandTotal: string
      footer: string
      thankYou: string
    }> = {
      ko: {
        header: 'LUNA LOUNGE & BAR',
        billNo: '빌 번호',
        table: '테이블',
        date: '일시',
        subtotal: '소계',
        vat: '부가가치세 (10%)',
        discount: '할인',
        cardSurcharge: '카드 수수료 (3%)',
        payment: '결제 방법',
        cash: '현금',
        card: '카드',
        split: '분할',
        grandTotal: '최종 합계',
        footer: '감사합니다',
        thankYou: '또 뵙겠습니다'
      },
      en: {
        header: 'LUNA LOUNGE & BAR',
        billNo: 'Bill No',
        table: 'Table',
        date: 'Date',
        subtotal: 'Subtotal',
        vat: 'VAT (10%)',
        discount: 'Discount',
        cardSurcharge: 'Card Fee (3%)',
        payment: 'Payment',
        cash: 'Cash',
        card: 'Card',
        split: 'Split',
        grandTotal: 'GRAND TOTAL',
        footer: 'Thank you',
        thankYou: 'See you again'
      },
      vi: {
        header: 'LUNA LOUNGE & BAR',
        billNo: 'Số HD',
        table: 'Bàn',
        date: 'Ngày',
        subtotal: 'Tạm tính',
        vat: 'VAT (10%)',
        discount: 'Giảm giá',
        cardSurcharge: 'Phí thẻ (3%)',
        payment: 'Thanh toán',
        cash: 'Tiền mặt',
        card: 'Thẻ',
        split: 'Chia sẻ',
        grandTotal: 'TỔNG CỘNG',
        footer: 'Cảm ơn quý khách',
        thankYou: 'Hẹn gặp lại'
      },
      ja: {
        header: 'LUNA LOUNGE & BAR',
        billNo: '伝票番号',
        table: 'テーブル',
        date: '日時',
        subtotal: '小計',
        vat: '消費税 (10%)',
        discount: '割引',
        cardSurcharge: 'カード手数料 (3%)',
        payment: '決済方法',
        cash: '現金',
        card: 'カード',
        split: '分割',
        grandTotal: '合計金額',
        footer: 'ありがとう',
        thankYou: 'ま���お越しください'
      },
      zh: {
        header: 'LUNA LOUNGE & BAR',
        billNo: '账单号',
        table: '桌号',
        date: '日期',
        subtotal: '小计',
        vat: '增值税 (10%)',
        discount: '折扣',
        cardSurcharge: '刷卡费 (3%)',
        payment: '支付方式',
        cash: '现金',
        card: '银行卡',
        split: '分割',
        grandTotal: '总计',
        footer: '谢谢',
        thankYou: '欢迎再来'
      },
      hi: {
        header: 'LUNA LOUNGE & BAR',
        billNo: 'बिल नंबर',
        table: 'टेबल',
        date: 'दिनांक',
        subtotal: 'उप-योग',
        vat: 'वैट (10%)',
        discount: 'छूट',
        cardSurcharge: 'कार्ड शुल्क (3%)',
        payment: 'भुगतान',
        cash: 'नकद',
        card: 'कार्ड',
        split: 'विभाजित',
        grandTotal: 'कुल राशि',
        footer: 'धन्यवाद',
        thankYou: 'फ���र मिलेंगे'
      }
    }

    // ★ 핵심: config.receiptLanguage 사용 (UI 언어가 아닌 선택된 영수증 언어)
    const receiptLang = config.receiptLanguage || language
    const tmpl = templates[receiptLang] || templates.ko
    const now = new Date()
    const dateStr = now.toLocaleDateString()
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // ★ pendingBillText는 오직 디버깅/로깅 목적으로만 사용 (Telegram은 별도 Vietnamese 템플릿 사용)
    setPendingBillText(`Bill #${billNumber} - Table ${tableSnapshot} - ${formatAmount(config.grandTotal)} VND`)
    setPendingBillConfig(config)
    
    // BillConfigurationModal 먼저 닫기
    setShowBillConfig(false)

  // ============================================================
  // ★ Physical Receipt Printing (Sewoo Print Service Intent)
  // ★ 물리적 영수증은 선택된 receiptLanguage (한국어/영어/베트남어 등) 사용
  // ★ Telegram은 별도로 Vietnamese 전용 템플릿 사용 (sendTelegramReceipt)
  // ============================================================
  // ★ Sewoo Print Service Intent (Web Bluetooth 우회)
  // 태블릿 OS가 Web Bluetooth 차단 → Sewoo 앱으로 직접 전송
  // ============================================================
  
  setBtPrinting(true)
  
  // 영수증 텍스트 포맷 (RawBT용) - receiptLanguage 템플릿 사용
  let receiptText = `[${tmpl.header}]\n`
  receiptText += `--------------------------------\n`
  receiptText += `${tmpl.billNo}: #${billNumber || 'N/A'}\n`
  receiptText += `${tmpl.table}: ${tableSnapshot || 'N/A'}\n`
  receiptText += `${tmpl.date}: ${dateStr} ${timeStr}\n`
  receiptText += `--------------------------------\n`
  
  // ★ 물리적 영수증도 미리보기와 동일하게 품명 단위로 병합 (스태프 이름 숨김).
  // ★ Telegram/sales_records는 아래에서 원본 historySnapshot을 그대로 사용하므로 영향 없음.
  aggregateForReceipt(historySnapshot).forEach((entry) => {
    const qty = entry.totalQty
    const unitPrice = entry.item.priceAmount ?? entry.item.priceKRW ?? 0
    const subtotal = unitPrice * qty
    const itemName = getMenuNameForReceipt(entry.item, receiptLang)
    receiptText += `${itemName}\n`
    receiptText += `  ${qty} x ${formatAmount(unitPrice)} = ${formatAmount(subtotal)}\n`
  })
  
  receiptText += `--------------------------------\n`
  receiptText += `${tmpl.subtotal}: ${formatAmount(totalAmount)} VND\n`
  
  if (config.applyVat && config.vatAmount > 0) {
    receiptText += `+ ${tmpl.vat}: ${formatAmount(config.vatAmount)} VND\n`
  }
  if (config.discountRate > 0 && config.discountAmount > 0) {
    receiptText += `- ${tmpl.discount} (${config.discountRate}%): -${formatAmount(config.discountAmount)} VND\n`
  }
  if (config.paymentMethod === 'card' && config.cardSurcharge > 0) {
    receiptText += `+ ${tmpl.cardSurcharge}: ${formatAmount(config.cardSurcharge)} VND\n`
  }
  
  receiptText += `--------------------------------\n`
  
  // ★ Split Payment Mode: Display card and cash breakdown
  if (config.splitPaymentMode && config.cardAmount !== undefined && config.cashAmount !== undefined) {
    receiptText += `${tmpl.payment} (${tmpl.split}):\n`
    if (config.cardAmount > 0) {
      receiptText += `  ${tmpl.card}: ${formatAmount(config.cardAmount)} VND\n`
      if (config.cardSurcharge > 0) {
        receiptText += `  + ${tmpl.cardSurcharge}: ${formatAmount(config.cardSurcharge)} VND\n`
      }
    }
    if (config.cashAmount > 0) {
      receiptText += `  ${tmpl.cash}: ${formatAmount(config.cashAmount)} VND\n`
    }
  } else {
    // General Payment Mode: Single payment method
    receiptText += `${tmpl.payment}: ${config.paymentMethod === 'cash' ? tmpl.cash : tmpl.card}\n`
  }
  
  receiptText += `--------------------------------\n`
  receiptText += `${tmpl.grandTotal}: ${formatAmount(config.grandTotal)} VND\n`
  receiptText += `--------------------------------\n`
  receiptText += `${tmpl.footer}\n`
  receiptText += `${tmpl.thankYou}\n`
  
  // ★ RawBT Android Intent - Pure plain text via Intent URI Scheme
  // ★ 실제 태블릿(Android)에서만 intent를 실행한다. 데스크톱/미리보기 환경에서는
  //    intent: 네비게이션이 페이지를 깨뜨리므로 건너뛰고 곧바로 확인 단계로 진행한다.
  //    → 실제 하드웨어 동작은 전혀 바뀌지 않음(안드로이드에서는 종전과 동일하게 인쇄).
  const canPrintViaIntent =
    typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)

  if (canPrintViaIntent) {
    window.location.href = "intent:" + encodeURIComponent(receiptText) + "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;"
  } else {
    console.log("[v0] Non-Android 환경 감지: RawBT 인쇄 intent를 건너뜁니다(미리보기 테스트용). 결제 흐름은 정상 진행됩니다.")
  }
  
  // Immediately display Print Confirmed modal after intent trigger
  setBtPrinting(false)
  setShowReceiptVerification(true)

  }, [pendingBillData, language, currency, formatPrice, getMenuNameForReceipt])

  // ============================================================
  // STEP 5: 영수증 확인 모달 - 수정하기 (BillConfigurationModal로 돌아가기)
  // ============================================================
  const handleReceiptModify = useCallback(() => {
    // 영수증 확인 모달 닫기
    setShowReceiptVerification(false)
    
    // BillConfigurationModal 다시 열기 (pendingBillData와 config는 그대로 유지됨)
    setShowBillConfig(true)
  }, [])

  // ============================================================
  // STEP 6: 영수증 확인 모달 - 확인 및 공유 (Telegram 공유 + 세션 리셋)
  // ★ 매출 기록을 sales_records 테이블에 저장
  // ★ Telegram RECEIPT (HÓA ĐƠN) 전송 - Vietnamese only
  // ============================================================
  const handleReceiptConfirmShare = useCallback(async () => {
    // 영수증 확인 모달 닫기
    setShowReceiptVerification(false)

    // ★ Telegram RECEIPT 알림 전송 (Vietnamese only)
    if (pendingBillConfig && pendingBillData) {
      const telegramDateTime = new Date().toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
      
      await sendTelegramReceipt({
        billNumber: pendingBillData.billNumber,
        tableNumber: pendingBillData.tableSnapshot || 'N/A',
        items: pendingBillData.historySnapshot.map(({ item, totalQty }) => ({
          item: {
            nameVi: item.nameVi,
            nameKo: item.nameKo,
            nameEn: item.nameEn,
            quantity: totalQty,
            priceAmount: item.priceAmount,
            priceKRW: item.priceKRW,
            priceCurrency: item.priceCurrency,
            selectedModifiers: item.selectedModifiers,
            comboOptions: item.comboOptions
          },
          totalQty
        })),
        paymentMethod: pendingBillConfig.paymentMethod,
        subtotal: pendingBillData.totalAmount,
        vatAmount: pendingBillConfig.vatAmount || 0,
        discountAmount: pendingBillConfig.discountAmount || 0,
        discountRate: pendingBillConfig.discountRate || 0,
        cardSurcharge: pendingBillConfig.cardSurcharge || 0,
        grandTotal: pendingBillConfig.grandTotal,
        dateTime: telegramDateTime
      })
    }

    // ★ sales_records에 매출 데이터 저장 (bill_id 포함 - 통일된 빌 번호)
    if (pendingBillConfig && pendingBillData) {
      try {
        const supabase = createClient()
        if (supabase) {
          const salesRecord = {
            bill_id: pendingBillData.billNumber, // ★ bills 테이블의 id를 통일된 빌 번호로 저장
            table_no: pendingBillData.tableSnapshot || 'N/A',
            items: pendingBillData.historySnapshot.map(({ item, totalQty }) => ({
              menuId: item.id,
              nameKo: item.nameKo,
              nameEn: item.nameEn,
              quantity: totalQty,
              unitPrice: item.priceAmount ?? item.priceKRW ?? 0,
              // ★ 추가(비파괴): 직원별 정산 리포트를 위해 스태프(모디파이어) 정보를 함께 저장.
              // JSONB 컬럼이라 기존 저장 흐름을 바꾸지 않고 필드만 덧붙인다.
              selectedModifiers: item.selectedModifiers ?? null,
              // ★ 콤보 메뉴: 고객이 선택한 세부 항목(예: 소주 → 참이슬)을 통계용으로 저장.
              // 한국어 원문만 저장하고, 조회 화면에서 번역한다.
              comboOptions: item.comboOptions ?? null,
            })),
            payment_method: pendingBillConfig.paymentMethod,
            subtotal: pendingBillData.totalAmount,
            vat: pendingBillConfig.vatAmount || 0,
            discount: pendingBillConfig.discountAmount || 0,
            card_fee: pendingBillConfig.cardSurcharge || 0,
            grand_total: pendingBillConfig.grandTotal,
          }
          
          const { data: insertedSale, error } = await supabase
            .from('sales_records')
            .insert(salesRecord)
            .select('id')
            .single()
          
          if (error) {
            console.error("매출 기록 저장 실패:", error)
          }

          // ★ 추가(비파괴): 통계용 평탄화 테이블(sale_line_items)에 동시 저장(dual-write).
          // 기존 sales_records(JSONB)는 그대로 유지되며, 이 블록이 실패해도
          // 결제 흐름/기존 UI에는 절대 영향을 주지 않는다(격리된 try/catch).
          if (!error && insertedSale?.id) {
            try {
              const lineItems: any[] = []
              for (const { item, totalQty } of pendingBillData.historySnapshot) {
                const unitPrice = item.priceAmount ?? item.priceKRW ?? 0
                // 상위 메뉴 라인
                lineItems.push({
                  sale_record_id: insertedSale.id,
                  bill_id: pendingBillData.billNumber,
                  line_type: 'item',
                  parent_menu_id: String(item.id),
                  parent_name_ko: item.nameKo,
                  parent_name_en: item.nameEn,
                  item_name_ko: item.nameKo,
                  item_name_en: item.nameEn,
                  quantity: totalQty,
                  unit_price: unitPrice,
                  line_total: unitPrice * totalQty,
                  payment_method: pendingBillConfig.paymentMethod,
                })
                // 콤보 세부 항목(소주 → 참이슬 등) 라인
                if (Array.isArray(item.comboOptions)) {
                  for (const opt of item.comboOptions) {
                    lineItems.push({
                      sale_record_id: insertedSale.id,
                      bill_id: pendingBillData.billNumber,
                      line_type: 'combo_option',
                      parent_menu_id: String(item.id),
                      parent_name_ko: item.nameKo,
                      parent_name_en: item.nameEn,
                      combo_group_ko: opt.groupName ?? null,
                      item_name_ko: opt.itemName,
                      item_name_en: opt.itemName,
                      quantity: (opt.quantity ?? 0) * totalQty,
                      unit_price: 0,
                      line_total: 0,
                      payment_method: pendingBillConfig.paymentMethod,
                    })
                  }
                }
              }
              if (lineItems.length > 0) {
                const { error: lineError } = await supabase
                  .from('sale_line_items')
                  .insert(lineItems)
                if (lineError) {
                  console.error("[v0] sale_line_items 저장 실패:", lineError)
                }
              }
            } catch (lineErr) {
              console.error("[v0] sale_line_items 저장 중 오류:", lineErr)
            }
          }
        }
      } catch (err) {
        console.error("매출 기록 저장 중 오류:", err)
      }
    }
    
    // orderHistory 완전 초기화
    setOrderHistory([])
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify([]))
    } catch (storageError) {
      console.error("localStorage 저장 실패:", storageError)
    }
    
    // 직전 주문 백업 초기화
    setLastOrderBundle(null)
    try {
      localStorage.removeItem(getLastOrderKey())
    } catch (e) {}
    
    // 주문 카운터 리셋
    setOrderCounter(1)
    try {
      localStorage.setItem(getOrderCounterKey(), '1')
    } catch (e) {}
    
    // 모�� 모달 상태 초기화
    setPendingBillData(null)
    setPendingBillConfig(null)
    onClose()
    
    // 세션 완전 리셋 (Welcome 화면으로 돌아가기)
    setTimeout(() => {
      if (onSessionReset) {
        onSessionReset()
      }
    }, 100)
    
    // 빌 텍스트 초기화
    setPendingBillText("")
  }, [pendingBillText, pendingBillConfig, pendingBillData, getStorageKey, getLastOrderKey, getOrderCounterKey, onClose, onSessionReset])

  // 빌 설정 취소 핸들러
  const handleBillConfigCancel = useCallback(() => {
    setShowBillConfig(false)
    setPendingBillData(null)
    setIsProcessing(false)
  }, [])

  // ============================================================
  // [직전 취소] 핸들러 - 마지막 주문 번들만 취소
  // ★ Telegram CANCELLATION (ĐƠN HỦY) 전송 - Vietnamese only
  // ★ Order ID (주문번호) 포함하여 전송
  // ============================================================
  const handleCancelLastOrder = useCallback(async () => {
    if (!lastOrderBundle || lastOrderBundle.length === 0) {
      return
    }
    
    if (isProcessing) return
    setIsProcessing(true)
    
    try {
      // ★ Telegram 취소 알림 전송 (Vietnamese only) - Order ID 포함
      const telegramDateTime = new Date().toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
      
      await sendTelegramCancellation({
        orderNumber: lastOrderNumber || (orderCounter - 1),
        tableNumber: selectedTable || 'N/A',
        items: lastOrderBundle.map(item => ({
          nameVi: item.nameVi,
          nameKo: item.nameKo,
          nameEn: item.nameEn,
          quantity: item.quantity,
          comboOptions: item.comboOptions
        })),
        dateTime: telegramDateTime
      })
      
      // 직전 주문 아이템들의 uniqueId 목�� 추출
      const lastOrderIds = new Set(lastOrderBundle.map(item => item.uniqueId))
      
      // orderHistory에서 직전 주문 아이템들 제거
      setOrderHistory(prev => {
        const updated = prev.filter(item => !lastOrderIds.has(item.uniqueId))
        try {
          localStorage.setItem(getStorageKey(), JSON.stringify(updated))
        } catch (e) {
          console.error("localStorage 저장 실패:", e)
        }
        return updated
      })
      
      // 직��� 주문 백업 초기화 (한 번만 취소 가��)
      setLastOrderBundle(null)
      setLastOrderNumber(null)
      try {
        localStorage.removeItem(getLastOrderKey())
        localStorage.removeItem(getLastOrderKey() + '_number')
      } catch (e) {}
      
    } catch (error) {
      console.error("직전 주문 취소 중 오류:", error)
    } finally {
      setIsProcessing(false)
    }
  }, [lastOrderBundle, lastOrderNumber, orderCounter, selectedTable, getStorageKey, getLastOrderKey, isProcessing])

  // 로딩 중이거나 열려있지 않으면 렌더링 안함
  if (ratesLoading || !isOpen) return null

  return (
    <>
      {/* 배경 오���레이 */}
      <div 
        className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      {/* 메인 팝업 - 최대 높이 80vh로 제한 */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-lg mx-auto">
        <div className="bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-700 overflow-hidden max-h-[80vh] h-[80vh] flex flex-col">
          
          {/* 헤더 - 고정 (flex-shrink-0) */}
          <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 px-6 py-4 border-b border-zinc-700 flex-shrink-0">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-6 h-6 text-amber-400" />
                <div>
                  <h2 className="text-xl font-bold text-white">{t.cart || "장바구니"}</h2>
                  {selectedTable && (
                    <span className="text-xs text-zinc-400">
                      {t.telegram?.table || "테이블"}: {selectedTable}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-zinc-400 hover:text-white transition-colors text-3xl font-light leading-none"
              >
                &times;
              </button>
            </div>
          </div>

          {/* 스크롤 가���한 컨텐츠 영역 - flex-1로 남은 공간 차지, overflow-y-auto로 내부 스크롤 */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="p-4 space-y-4">
              
              {/* ========== 상단 영역: 현재 장바구니 ========== */}
              <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 overflow-hidden">
                <div className="bg-amber-600/20 px-4 py-3 border-b border-zinc-700">
                  <h3 className="text-amber-400 font-semibold flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4" />
                    {language === "ko" ? "현재 장바구니" : "Current Cart"}
                    {cart.length > 0 && (
                      <span className="ml-2 bg-amber-600 text-white text-xs px-2 py-0.5 rounded-full">
                        {cartQuantity}개
                      </span>
                    )}
                  </h3>
                </div>
                
                <div className="p-4">
                  {cart.length === 0 ? (
                    <p className="text-zinc-500 text-center py-6">
                      {t.noItems || "장바구니가 비어있습니다"}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div
                          key={item.cartItemKey || item.id}
                          className="bg-zinc-800 rounded-lg p-3 border border-zinc-700"
                        >
                          <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">{getMenuName(item)}</p>
                            {/* Display selected modifiers if any */}
                            {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                              <div className="text-xs text-zinc-400 mt-1 space-y-0.5">
                                {item.selectedModifiers.map((mod, idx) => (
                                  <p key={idx}>
                                    <span className="text-zinc-500">{mod.modifierGroupName}:</span> {mod.selectedOptionLabel}
                                  </p>
                                ))}
                              </div>
                            )}
                            <p className="text-sm text-amber-400 mt-1">{getItemPrice(item)}</p>
                          </div>
                          
                          <div className="flex items-center gap-2 ml-3">
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.cartItemKey || item.id, Math.max(1, (Number(item.quantity) || 1) - 1))}
                              className="w-8 h-8 rounded-full bg-zinc-700 active:bg-zinc-600 flex items-center justify-center text-white transition-colors touch-manipulation cursor-pointer"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center text-white font-medium">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.cartItemKey || item.id, (Number(item.quantity) || 1) + 1)}
                              className="w-8 h-8 rounded-full bg-zinc-700 active:bg-zinc-600 flex items-center justify-center text-white transition-colors touch-manipulation cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            {item.can_adjust_price && (
                              <button
                                type="button"
                                onClick={() => setPriceAdjustItem(item)}
                                className="w-8 h-8 rounded-full bg-amber-900/50 active:bg-amber-800 flex items-center justify-center text-amber-400 active:text-amber-300 transition-colors ml-1 touch-manipulation cursor-pointer"
                                aria-label={language === "ko" ? "가격 수정" : "Adjust price"}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onRemove(item.cartItemKey || item.id)}
                              className="w-8 h-8 rounded-full bg-red-900/50 active:bg-red-800 flex items-center justify-center text-red-400 active:text-red-300 transition-colors ml-1 touch-manipulation cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          </div>
                          {/* Combo sub-items with per-item quantity adjusters */}
                          {Array.isArray(item.comboOptions) && item.comboOptions.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-zinc-700 space-y-0.5">
                              {item.comboOptions.map((opt) => (
                                <ComboOptionRow
                                  key={opt.itemId}
                                  cartItemKey={item.cartItemKey || item.id}
                                  option={opt}
                                  language={language}
                                  onUpdateComboOptionQuantity={onUpdateComboOptionQuantity}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {/* 현재 장바구니 합계 */}
                      <div className="pt-3 border-t border-zinc-700">
                        <div className="flex justify-between items-center text-sm text-zinc-400 mb-1">
                          <span>{t.totalQuantity || "총 수량"}</span>
                          <span>{cartQuantity}개</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-white font-medium">{t.totalPrice || "총액"}</span>
                          <span className="text-xl font-bold text-amber-400">
                            {formatPrice(cartTotal, currency)}
                          </span>
                        </div>
                      </div>
                      
                      {/* [주문하기] 버튼 */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleOrder}
                          disabled={cart.length === 0 || isProcessing}
                          className="w-full bg-amber-600 active:bg-amber-500 hover:bg-amber-500 text-white font-bold py-4 text-lg rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation cursor-pointer select-none"
                        >
                          {isProcessing ? (language === "ko" ? "처리 중..." : "Processing...") : (t.order || "주문하기")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator className="bg-zinc-700" />

              {/* ========== 하단 영역: 테이블 누적 내역 ========== */}
              <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 overflow-hidden">
                <div className="bg-emerald-600/20 px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
                  <h3 className="text-emerald-400 font-semibold flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    {language === "ko" ? "주문누적내역" : "Table Order History"}
                    {orderHistory.length > 0 && (
                      <span className="ml-2 bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full">
                        {mergedHistory.length}종
                      </span>
                    )}
                  </h3>
                  
                  {/* ★ 직전 취소 버튼 */}
                  {lastOrderBundle && lastOrderBundle.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCancelLastOrder}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-400 hover:text-red-300 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      {language === "ko" ? "직전 취소" : "Cancel Last"}
                    </button>
                  )}
                </div>
                
                <div className="p-4">
                  {orderHistory.length === 0 ? (
                    <p className="text-zinc-500 text-center py-6">
                      {accT.noOrders}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {/* 합산된 누적 주문 목록 */}
                      {mergedHistory.map(({ item, totalQty }) => (
                        <div
                          key={item.cartItemKey || item.uniqueId || item.id}
                          className="flex items-center justify-between bg-zinc-800 rounded-lg p-3 border border-emerald-900/30"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">{getMenuName(item)}</p>
                            {/* Display modifiers if present */}
                            {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                              <p className="text-xs text-zinc-400 mt-1">
                                {item.selectedModifiers
                                  .map((mod) => `${mod.modifierGroupName}: ${mod.selectedOptionLabel}`)
                                  .join(", ")}
                              </p>
                            )}
                            {/* Combo sub-items are intentionally hidden from the cumulative
                                sales display so staff only see the main combo menu, its total
                                quantity and price. The nested sub-items are still preserved in
                                orderHistory state and are sent to Telegram (kitchen) and saved
                                to sales_records for stats. */}
                            <p className="text-sm text-emerald-400">{getItemPrice(item)}</p>
                          </div>
                          <div className="text-right ml-3">
                            <span className="text-lg font-bold text-white">x {totalQty}</span>
                            <p className="text-sm text-zinc-400">
                              {formatPrice(getItemTotal({ ...item, quantity: totalQty }), currency)}
                            </p>
                          </div>
                        </div>
                      ))}
                      
                      {/* 누적 총액 */}
                      <div className="pt-4 border-t border-zinc-700">
                        <div className="flex justify-between items-center bg-gradient-to-r from-emerald-900/30 to-emerald-800/20 rounded-lg p-4 border border-emerald-700/50">
                          <span className="text-emerald-300 font-medium text-lg">
                            {accT.accumulatedTotal}
                          </span>
                          <span className="text-2xl font-bold text-emerald-400">
                            {formatPrice(orderHistoryTotal, currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
            </div>
          </div>

  {/* 하단 고정 버튼 영역 - flex-shrink-0으로 고정 */}
  {orderHistory.length > 0 && (
  <div className="flex-shrink-0 p-4 bg-zinc-900 border-t border-zinc-700 space-y-3">
  {/* Sewoo Print Service 상태 표시 */}
  <div className="flex items-center justify-center bg-zinc-800 rounded-lg px-3 py-2">
    <div className="flex items-center gap-2 text-sm">
      <Printer className="w-4 h-4 text-blue-400" />
      <span className="text-zinc-400">{language === 'ko' ? 'Sewoo Print Service 사용' : 'Using Sewoo Print Service'}</span>
    </div>
  </div>
  
  <button
  type="button"
  onClick={handleRequestBill}
  disabled={orderHistory.length === 0 || isProcessing || btPrinting}
  className="w-full bg-gradient-to-r from-red-600 to-rose-600 active:from-red-500 active:to-rose-500 hover:from-red-500 hover:to-rose-500 text-white font-bold py-5 text-xl rounded-xl transition-all shadow-lg shadow-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 touch-manipulation cursor-pointer select-none"
  >
  <CreditCard className="w-6 h-6" />
  {btPrinting 
    ? (language === "ko" ? "인쇄 중..." : "Printing...") 
    : isProcessing 
      ? (language === "ko" ? "처리 중..." : "Processing...") 
      : (language === "ko" ? "최종 계산서 요청" : "Request Final Bill")}
  </button>
  </div>
  )}
        </div>
      </div>

      {/* STEP 1: 테��블 확인 모달 */}
      <TableConfirmationPopup
        isOpen={showTableConfirmation}
        tableNumber={selectedTable || 'N/A'}
        onConfirm={handleTableConfirmed}
        onCancel={() => setShowTableConfirmation(false)}
        language={language}
      />

      {/* STEP 2-3: 빌 설정 모달 (VAT, 할인, 결제방법) */}
      <BillConfigurationModal
        isOpen={showBillConfig}
        subtotal={pendingBillData?.totalAmount || orderHistoryTotal}
        language={language}
        onConfirm={handleBillConfigConfirm}
        onCancel={handleBillConfigCancel}
        storeName="LUNA Lounge & Bar"
        tableNumber={pendingBillData?.tableSnapshot || selectedTable || "N/A"}
        receiptItems={receiptPreviewItems}
        currency={currency}
        formatCurrency={(amount) => formatPrice(amount, currency)}
      />

      {/* STEP 4-5: ��������� 확인 모달 (인쇄 후, Telegram 공유 전 버퍼) */}
      <ReceiptVerificationModal
        isOpen={showReceiptVerification}
        language={language}
        onModify={handleReceiptModify}
        onConfirmShare={handleReceiptConfirmShare}
      />

      {/* 장바구니 내 가격 수정 모달 */}
      {priceAdjustItem && (() => {
        const currentPrice = priceAdjustItem.priceAmount ?? priceAdjustItem.priceKRW ?? 0
        const adjInfo = getAdjustmentInfo(priceAdjustItem.id)
        const basePrice = adjInfo ? adjInfo.originalPrice : currentPrice
        return (
          <PriceAdjustmentModal
            isOpen={true}
            onClose={() => setPriceAdjustItem(null)}
            itemId={priceAdjustItem.id}
            itemName={getMenuName(priceAdjustItem)}
            originalPrice={basePrice}
            currentAdjustedPrice={currentPrice}
            onSuccess={(newPrice) => {
              onUpdatePrice?.(priceAdjustItem.id, newPrice)
              setPriceAdjustItem(null)
            }}
          />
        )
      })()}
    </>
  )
}
