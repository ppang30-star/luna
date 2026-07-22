"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { X, ClipboardList, Share2 } from 'lucide-react'
import { sendTelegramMessage, generateTelegramOrderMessage } from "@/lib/telegram"

interface BillData {
  id: number | null
  table_no: string
  total_amount: string
  bill_text: string
}

interface LUNAMenuControlPopupProps {
  billData: BillData
  onClose: () => void
  onOpenCart: () => void
  language: string
  onSessionReset?: () => void
}

// ============================================================
// LUNAMenuControlPopup - 중간 주문용 액션 패널 (Intermediate Order Only)
// ============================================================
// 주의: 이 컴포넌트는 오직 중간 주문 (주문하기)에서만 사용됨
// 최종 계산 (최종계산요청)은 cart-popup에서 직접 처리함
// 이 팝업에서는 절대로 Billing Configuration Modal을 표시하지 않음
// 텔레그램 전송 버튼 클릭시 Telegram Bot API로 전송 (아이템+수량만, 금액 없음)
// ============================================================
export default function LUNAMenuControlPopup({ 
  billData, 
  onClose, 
  onOpenCart,
  language
}: LUNAMenuControlPopupProps) {
  // 텔레그램 전송 락 - sessionStorage 기반 물리적 락
  const TELEGRAM_SHARE_LOCK_KEY = 'telegram_share_lock'
  const [isSending, setIsSending] = useState(false)

  // 컴포넌트 마운트시 락 해제 (Lifecycle Reset)
  useEffect(() => {
    try {
      sessionStorage.removeItem(TELEGRAM_SHARE_LOCK_KEY)
    } catch (e) {
      // sessionStorage 접근 실패시 무시
    }
  }, [])

  // ============================================================
  // 텔레그램 전송 - Telegram Bot API 직접 호출
  // bill_text를 그대로 전송 (이미 한국어 주문서 형식)
  // ============================================================
  const handleTelegramShare = useCallback(async () => {
    // ★ 1. sessionStorage 물리적 락 체크 (가장 먼저 - 재실행 방지)
    try {
      if (sessionStorage.getItem(TELEGRAM_SHARE_LOCK_KEY) === 'true') {
        return
      }
    } catch (e) {
      // sessionStorage 접근 실패시 계속 진행
    }

    // ★ 2. 즉시 sessionStorage 락 설정
    try {
      sessionStorage.setItem(TELEGRAM_SHARE_LOCK_KEY, 'true')
    } catch (e) {
      // sessionStorage 접근 실패시 계속 진행
    }

    setIsSending(true)

    try {
      // bill_text에서 아이템 파싱
      const items: { nameVi: string; nameKo: string; nameEn: string; quantity: number }[] = []
      
      if (billData.bill_text) {
        const lines = billData.bill_text.split('\n')
        for (const line of lines) {
          // "- 메뉴명 x 수량" 형식 파싱
          const match = line.match(/^-\s*(.+?)\s*x\s*(\d+)$/i)
          if (match) {
            items.push({
              nameVi: match[1].trim(),
              nameKo: match[1].trim(),
              nameEn: match[1].trim(),
              quantity: parseInt(match[2], 10) || 1
            })
          }
        }
      }

      const telegramDateTime = new Date().toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })

      // Generate Vietnamese formatted message
      const telegramMessage = generateTelegramOrderMessage({
        orderNumber: Date.now() % 100000,
        tableNumber: billData.table_no || 'N/A',
        items: items.length > 0 ? items : [{ nameVi: 'Đơn hàng mới', nameKo: '새 주문', nameEn: 'New Order', quantity: 1 }],
        dateTime: telegramDateTime
      })

      // Send directly via Telegram Bot API
      const success = await sendTelegramMessage(telegramMessage)
      
      if (success) {
        console.log('[v0] Telegram message sent successfully')
      } else {
        console.error('[v0] Telegram message failed to send')
      }

      // UI 상태 변경
      onClose()
    } catch (error) {
      console.error("[v0] 텔레그램 전송 실패:", error)
    } finally {
      setIsSending(false)
      // 3초 후 락 해제 (새 공유 가능하도록)
      setTimeout(() => {
        try {
          sessionStorage.removeItem(TELEGRAM_SHARE_LOCK_KEY)
        } catch (e) {}
      }, 3000)
    }
  }, [billData, onClose])

  return (
    <div className="fixed bottom-4 left-4 bg-zinc-900 p-4 rounded-xl shadow-2xl border border-zinc-700 z-50 flex flex-col gap-2 w-72 animate-in slide-in-from-left-4 duration-300">
      {/* 헤더 */}
      <div className="flex justify-between items-center border-b border-zinc-700 pb-2 mb-1">
        <span className="font-bold text-sm text-zinc-200">
          {language === "ko" ? "주문 공유" : "Share Order"}
        </span>
        <button 
          onClick={onClose} 
          className="text-zinc-400 hover:text-white font-bold p-1 rounded hover:bg-zinc-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 테이블 번호 표시 */}
      {billData.table_no && billData.table_no !== 'N/A' && (
        <div className="text-center mb-1">
          <span className="text-xs bg-zinc-800 text-amber-400 px-3 py-1 rounded-full border border-zinc-700">
            {language === "ko" ? `테이블 ${billData.table_no}` : `Table ${billData.table_no}`}
          </span>
        </div>
      )}
      
      {/* 주문내역 확인 버튼 */}
      <button 
        onClick={onOpenCart}
        className="flex items-center justify-center gap-2 bg-zinc-800 text-zinc-200 py-2.5 rounded-lg font-medium text-sm hover:bg-zinc-700 transition-colors"
      >
        <ClipboardList className="w-4 h-4" />
        {language === "ko" ? "주문내역 확인" : "Order History"}
      </button>
      
      {/* 텔레그램 전송 버튼 - Telegram Bot API 사용 */}
      <button 
        onClick={handleTelegramShare}
        disabled={isSending}
        className="flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-blue-500 active:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Share2 className="w-4 h-4" />
        {isSending 
          ? (language === "ko" ? "전송 중..." : "Sending...") 
          : (language === "ko" ? "텔레그램 전송" : "Send to Telegram")}
      </button>
    </div>
  )
}
