"use client"

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'

// Translation dictionary (matches the app's supported languages)
const translations: Record<string, { text: string; sub: string; confirm: string; goBack: string; fromLabel: string; toLabel: string }> = {
  ko: {
    text: '테이블 번호를 변경하시겠습니까?',
    sub: '현재 테이블에 장바구니 또는 미정산 주문이 남아 있습니다.',
    confirm: '변경',
    goBack: '취소',
    fromLabel: '현재',
    toLabel: '변경',
  },
  en: {
    text: 'Are you sure you want to change the table number?',
    sub: 'The current table still has items in the cart or unsettled orders.',
    confirm: 'Confirm',
    goBack: 'Cancel',
    fromLabel: 'Current',
    toLabel: 'New',
  },
  ja: {
    text: 'テーブル番号を変更しますか？',
    sub: '現在のテーブルにカートまたは未精算の注文が残っています。',
    confirm: '変更',
    goBack: 'キャンセル',
    fromLabel: '現在',
    toLabel: '変更後',
  },
  zh: {
    text: '确定要更改桌号吗？',
    sub: '当前桌号仍有购物车商品或未结算订单。',
    confirm: '确认',
    goBack: '取消',
    fromLabel: '当前',
    toLabel: '新',
  },
  es: {
    text: '¿Está seguro de que desea cambiar el número de mesa?',
    sub: 'La mesa actual todavía tiene artículos en el carrito o pedidos sin liquidar.',
    confirm: 'Confirmar',
    goBack: 'Cancelar',
    fromLabel: 'Actual',
    toLabel: 'Nueva',
  },
  th: {
    text: 'คุณต้องการเปลี่ยนหมายเลขโต๊ะหรือไม่?',
    sub: 'โต๊ะปัจจุบันยังมีสินค้าในตะกร้าหรือออร์เดอร์ที่ยังไม่ได้ชำระ',
    confirm: 'ยืนยัน',
    goBack: 'ยกเลิก',
    fromLabel: 'ปัจจุบัน',
    toLabel: 'ใหม่',
  },
  vi: {
    text: 'Bạn có chắc muốn đổi số bàn không?',
    sub: 'Bàn hiện tại vẫn còn món trong giỏ hàng hoặc đơn chưa thanh toán.',
    confirm: 'Xác nhận',
    goBack: 'Hủy',
    fromLabel: 'Hiện tại',
    toLabel: 'Mới',
  },
}

interface TableSwitchConfirmationPopupProps {
  isOpen: boolean
  currentTable: string | null
  targetTable: string | null
  onConfirm: () => void
  onCancel: () => void
  language?: string
}

export default function TableSwitchConfirmationPopup({
  isOpen,
  currentTable,
  targetTable,
  onConfirm,
  onCancel,
  language = 'ko',
}: TableSwitchConfirmationPopupProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!isOpen || !mounted) return null

  const t = translations[language] || translations.ko

  const popupContent = (
    <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center bg-black/80">
      {/* Click outside cancels the switch */}
      <div className="absolute inset-0" onClick={onCancel} />

      {/* Modal Card */}
      <div className="relative flex flex-col items-center justify-center text-center gap-6 w-full max-w-sm mx-auto p-8 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl">
        {/* Warning Icon */}
        <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30 shrink-0">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>

        {/* From -> To table numbers */}
        <div className="flex items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <span className="text-zinc-400 text-xs font-medium tracking-wider uppercase">{t.fromLabel}</span>
            <span className="text-3xl font-black text-zinc-300">{currentTable || "?"}</span>
          </div>
          <span className="text-2xl text-amber-400 font-bold">→</span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-zinc-400 text-xs font-medium tracking-wider uppercase">{t.toLabel}</span>
            <span className="text-3xl font-black text-white drop-shadow-[0_0_20px_rgba(251,191,36,0.4)]">{targetTable || "?"}</span>
          </div>
        </div>

        {/* Confirmation Text */}
        <div className="flex flex-col gap-2">
          <p className="text-white text-base font-semibold leading-relaxed">{t.text}</p>
          <p className="text-zinc-400 text-sm leading-relaxed">{t.sub}</p>
        </div>

        {/* Buttons */}
        <div className="flex flex-row justify-center w-full gap-4">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl border border-zinc-600 transition-all duration-200 hover:border-zinc-500"
          >
            {t.goBack}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-zinc-900 font-bold rounded-xl transition-all duration-200 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
          >
            {t.confirm}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(popupContent, document.body)
}
