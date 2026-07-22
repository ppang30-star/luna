"use client"

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'

// Translation dictionary for 6 languages
const translations: Record<string, { text: string; yes: string; goBack: string; tableLabel: string }> = {
  ko: {
    text: '테이블번호가 맞는지 확인해 주세요',
    yes: '네',
    goBack: '돌아가기',
    tableLabel: '테이블 번호'
  },
  en: {
    text: 'Please confirm if the table number is correct.',
    yes: 'Yes',
    goBack: 'Go Back',
    tableLabel: 'Table Number'
  },
  ja: {
    text: 'テーブル番号が正しいか確認してください。',
    yes: 'はい',
    goBack: '戻る',
    tableLabel: 'テーブル番号'
  },
  zh: {
    text: '请确认桌号是否正确。',
    yes: '是',
    goBack: '返回',
    tableLabel: '桌号'
  },
  vi: {
    text: 'Vui lòng xác nhận số bàn có chính xác không.',
    yes: 'Đúng',
    goBack: 'Quay lại',
    tableLabel: 'Số bàn'
  },
  hi: {
    text: 'कृपया पुष्टि करें कि क्या टेबल नंबर सही है।',
    yes: 'हाँ',
    goBack: 'वापस जाएँ',
    tableLabel: 'टेबल नंबर'
  }
}

interface TableConfirmationPopupProps {
  isOpen: boolean
  tableNumber: string
  onConfirm: () => void
  onCancel: () => void
  language?: string
}

export default function TableConfirmationPopup({
  isOpen,
  tableNumber,
  onConfirm,
  onCancel,
  language = 'ko'
}: TableConfirmationPopupProps) {
  const [mounted, setMounted] = useState(false)

  // Ensure we only render portal on client side
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!isOpen || !mounted) return null

  // Get translations for current language (fallback to Korean)
  const t = translations[language] || translations.ko

  // Portal content - renders at document.body level to escape nested parents
  const popupContent = (
    <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center bg-black/80">
      {/* Click outside to cancel */}
      <div 
        className="absolute inset-0"
        onClick={onCancel}
      />
      
      {/* Modal Card - forced column flex layout */}
      <div className="relative flex flex-col items-center justify-center text-center gap-6 w-full max-w-sm mx-auto p-8 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl">
        {/* Warning Icon */}
        <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30 shrink-0">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>

        {/* Table Number Display - capped at text-7xl */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-zinc-400 text-sm font-medium tracking-wider uppercase">
            {t.tableLabel}
          </span>
          
          {/* Table number - massive but capped, bold and bright */}
          <span className="text-6xl sm:text-7xl font-black text-white tracking-tight drop-shadow-[0_0_20px_rgba(251,191,36,0.4)]">
            {tableNumber || "?"}
          </span>
        </div>

        {/* Confirmation Text */}
        <p className="text-zinc-300 text-base leading-relaxed">
          {t.text}
        </p>

        {/* Button Container - horizontal row, always visible */}
        <div className="flex flex-row justify-center w-full gap-4">
          {/* Go Back Button */}
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl border border-zinc-600 transition-all duration-200 hover:border-zinc-500"
          >
            {t.goBack}
          </button>
          
          {/* Yes/Confirm Button */}
          <button
            onClick={onConfirm}
            className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-zinc-900 font-bold rounded-xl transition-all duration-200 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
          >
            {t.yes}
          </button>
        </div>
      </div>
    </div>
  )

  // Use createPortal to render at document.body level, escaping any nested parent positioning
  return createPortal(popupContent, document.body)
}
