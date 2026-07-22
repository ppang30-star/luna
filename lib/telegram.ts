// Telegram Bot API Integration
// All notifications are sent in Vietnamese for local kitchen/hall staff
// Do NOT touch physical receipt printing logic - this is ONLY for Telegram notifications

const TELEGRAM_BOT_TOKEN = "8915994764:AAG9EL7kBCy5ob6g4KWs93EAPzN56x47uyc"
const TELEGRAM_CHAT_ID = "-5034317914"

interface SelectedModifier {
  modifierId: string
  modifierGroupName: string
  selectedOption: string
  selectedOptionLabel: string
}

interface ComboSelectedOption {
  groupId: string
  groupName: string
  itemId: string
  itemName: string
  quantity: number
}

interface OrderItem {
  nameVi?: string
  nameKo?: string
  nameEn?: string
  quantity: number
  unitPrice?: number
  priceCurrency?: string
  priceAmount?: number
  priceKRW?: number
  selectedModifiers?: SelectedModifier[]
  comboOptions?: ComboSelectedOption[]
}

// Build a compact combo suffix, e.g. " [소주: 참이슬 x1, 처음처럼 x1]".
// Combo sub-items are shown in Korean (the source) so kitchen staff see the
// exact selected drinks alongside the Vietnamese menu name.
const buildComboSuffix = (item: OrderItem): string => {
  if (!item.comboOptions || item.comboOptions.length === 0) return ""
  const parts = item.comboOptions.map((o) => `${o.groupName}: ${o.itemName} x${o.quantity}`)
  return ` [${parts.join(", ")}]`
}

interface TelegramOrderPayload {
  orderNumber: number
  tableNumber: string
  items: OrderItem[]
  dateTime: string
}

interface TelegramReceiptPayload {
  billNumber: number | null
  tableNumber: string
  items: { item: OrderItem; totalQty: number }[]
  paymentMethod: 'cash' | 'card'
  subtotal: number
  vatAmount: number
  discountAmount: number
  discountRate: number
  cardSurcharge: number
  grandTotal: number
  dateTime: string
}

interface TelegramCancellationPayload {
  orderNumber: number
  tableNumber: string
  items: OrderItem[]
  dateTime: string
}

// Get Vietnamese name for menu item (fallback to Korean/English if not available)
const getVietnameseName = (item: OrderItem): string => {
  return item.nameVi || item.nameKo || item.nameEn || "Món ăn"
}

// Format price in VND
const formatVND = (amount: number): string => {
  return amount.toLocaleString('vi-VN') + ' VND'
}

// Generate ORDER message (ĐƠN HÀNG) - Vietnamese only
export const generateTelegramOrderMessage = (payload: TelegramOrderPayload): string => {
  const { orderNumber, tableNumber, items, dateTime } = payload
  
  let message = `🔔 ĐƠN HÀNG (주문서)\n`
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`
  message += `📋 Số đơn hàng: #${orderNumber}\n`
  message += `🪑 Số bàn/phòng: ${tableNumber}\n`
  message += `🕐 Ngày giờ: ${dateTime}\n`
  message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`
  message += `📝 Danh sách món:\n`
  
  items.forEach((item, index) => {
    const name = getVietnameseName(item)
    // Build item description with modifiers inline
    let itemDescription = name
    if (item.selectedModifiers && item.selectedModifiers.length > 0) {
      const modifierStr = item.selectedModifiers
        .map((mod) => `${mod.modifierGroupName}: ${mod.selectedOptionLabel}`)
        .join(", ")
      itemDescription += ` (${modifierStr})`
    }
    itemDescription += buildComboSuffix(item)
    message += `${index + 1}. ${itemDescription} x ${item.quantity}\n`
  })
  
  message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`
  message += `Xin cảm ơn! (감사합니다)`
  
  return message
}

// Generate RECEIPT message (HÓA ĐƠN) - Vietnamese only
export const generateTelegramReceiptMessage = (payload: TelegramReceiptPayload): string => {
  const { 
    billNumber, 
    tableNumber, 
    items, 
    paymentMethod, 
    subtotal,
    vatAmount,
    discountAmount,
    discountRate,
    cardSurcharge,
    grandTotal,
    dateTime 
  } = payload
  
  let message = `🧾 HÓA ĐƠN (영수증)\n`
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`
  message += `📋 Số hóa đơn: #${billNumber || 'N/A'}\n`
  message += `🪑 Số bàn/phòng: ${tableNumber}\n`
  message += `🕐 Ngày giờ: ${dateTime}\n`
  message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`
  message += `📝 Chi tiết đơn hàng:\n`
  message += `────────────────────────\n`
  
  items.forEach((entry) => {
    const name = getVietnameseName(entry.item)
    const unitPrice = entry.item.priceAmount ?? entry.item.priceKRW ?? 0
    const subtotalItem = unitPrice * entry.totalQty
    // Build item name with modifiers inline
    let itemName = name
    if (entry.item.selectedModifiers && entry.item.selectedModifiers.length > 0) {
      const modifierStr = entry.item.selectedModifiers
        .map((mod) => `${mod.modifierGroupName}: ${mod.selectedOptionLabel}`)
        .join(", ")
      itemName += ` (${modifierStr})`
    }
    itemName += buildComboSuffix(entry.item)
    message += `• ${itemName}\n`
    message += `  Đơn giá: ${formatVND(unitPrice)}\n`
    message += `  Số lượng: ${entry.totalQty}\n`
    message += `  Thành tiền: ${formatVND(subtotalItem)}\n\n`
  })
  
  message += `────────────────────────\n`
  message += `Tạm tính: ${formatVND(subtotal)}\n`
  
  if (vatAmount > 0) {
    message += `+ VAT (10%): ${formatVND(vatAmount)}\n`
  }
  
  if (discountAmount > 0) {
    message += `- Giảm giá (${discountRate}%): -${formatVND(discountAmount)}\n`
  }
  
  if (cardSurcharge > 0) {
    message += `+ Phí thẻ (3%): ${formatVND(cardSurcharge)}\n`
  }
  
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`
  message += `💳 Thanh toán: ${paymentMethod === 'cash' ? 'Tiền mặt (현금)' : 'Thẻ (카드)'}\n`
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`
  message += `💰 TỔNG CỘNG: ${formatVND(grandTotal)}\n`
  message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`
  message += `Cảm ơn quý khách! (감사합니다)`
  
  return message
}

// Generate CANCELLATION message (ĐƠN HỦY) - Vietnamese only
export const generateTelegramCancellationMessage = (payload: TelegramCancellationPayload): string => {
  const { orderNumber, tableNumber, items, dateTime } = payload
  
  let message = `🚨 ĐƠN HỦY (주문취소 전표)\n`
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`
  message += `📋 Mã đơn hàng bị hủy: #${orderNumber}\n`
  message += `🪑 Số bàn/phòng: ${tableNumber}\n`
  message += `🕐 Ngày giờ: ${dateTime}\n`
  message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`
  message += `❌ Món đã hủy:\n`
  
  items.forEach((item, index) => {
    const name = getVietnameseName(item)
    // Build item description with modifiers inline
    let itemDescription = name
    if (item.selectedModifiers && item.selectedModifiers.length > 0) {
      const modifierStr = item.selectedModifiers
        .map((mod) => `${mod.modifierGroupName}: ${mod.selectedOptionLabel}`)
        .join(", ")
      itemDescription += ` (${modifierStr})`
    }
    itemDescription += buildComboSuffix(item)
    message += `${index + 1}. ${itemDescription} x ${item.quantity}\n`
  })
  
  message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`
  message += `Đơn hàng đã được hủy.`
  
  return message
}

// Send message to Telegram via our own Next.js API route (server-side proxy).
// This avoids CORS issues that occur when calling the Telegram API directly from the browser.
export const sendTelegramMessage = async (message: string): Promise<boolean> => {
  try {
    const response = await fetch("/api/telegram", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    })

    const data = await response.json().catch(() => null)

    if (!response.ok || !data?.ok) {
      const errorMsg = data?.error || `HTTP ${response.status}: ${response.statusText}`
      console.error("[Telegram] Send failed:", errorMsg)
      alert(`Telegram 전송 실패: ${errorMsg}`)
      return false
    }

    console.log("[Telegram] Message sent successfully")
    return true
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error("[Telegram] Network/Fetch Error:", errorMsg)
    alert(`Telegram 네트워크 오류: ${errorMsg}`)
    return false
  }
}

// Send ORDER notification to Telegram
export const sendTelegramOrder = async (payload: TelegramOrderPayload): Promise<boolean> => {
  const message = generateTelegramOrderMessage(payload)
  return sendTelegramMessage(message)
}

// Send RECEIPT notification to Telegram
export const sendTelegramReceipt = async (payload: TelegramReceiptPayload): Promise<boolean> => {
  const message = generateTelegramReceiptMessage(payload)
  return sendTelegramMessage(message)
}

// Send CANCELLATION notification to Telegram
export const sendTelegramCancellation = async (payload: TelegramCancellationPayload): Promise<boolean> => {
  const message = generateTelegramCancellationMessage(payload)
  return sendTelegramMessage(message)
}
