"use client"

import type { Language } from "@/lib/translations"

interface CartGuardPopupProps {
  isOpen: boolean
  onClose: () => void
  onSelectTable: () => void
  language: Language
}

// Translations for the cart guard warning message
const warningTranslations: Record<string, string> = {
  ko: "주문을 위해서는 테이블 번호 선택이 필요합니다. 테이블을 선택하시겠습니까?",
  en: "A table selection is required to add items or place an order. Would you like to select a table now?",
  ja: "注文するにはテーブル番号の選択が必要です。テーブルを選択しますか？",
  zh: "下单需要选择桌号。您要现在选择桌号吗？",
  vi: "Cần chọn số bàn để đặt hàng. Bạn có muốn chọn bàn ngay bây giờ không?",
  hi: "ऑर्डर देने के लिए टेबल नंबर चुनना आवश्यक है। क्या आप अभी टेबल चुनना चाहेंगे?",
}

// Translations for "Yes, Select Table" button
const yesTranslations: Record<string, string> = {
  ko: "네, 테이블 선택",
  en: "Yes, Select Table",
  ja: "はい、テーブル選択",
  zh: "是，选择桌号",
  vi: "Có, chọn bàn",
  hi: "हाँ, टेबल चुनें",
}

// Translations for "Cancel/Back" button
const cancelTranslations: Record<string, string> = {
  ko: "취소 / 계속 둘러보기",
  en: "Cancel / Keep Browsing",
  ja: "キャンセル / 続けて見る",
  zh: "取消 / 继续浏览",
  vi: "Hủy / Tiếp tục xem",
  hi: "रद्द करें / देखते रहें",
}

export default function CartGuardPopup({ isOpen, onClose, onSelectTable, language }: CartGuardPopupProps) {
  if (!isOpen) return null

  const warningMessage = warningTranslations[language] || warningTranslations.en
  const yesText = yesTranslations[language] || yesTranslations.en
  const cancelText = cancelTranslations[language] || cancelTranslations.en

  const handleSelectTable = () => {
    onClose()
    onSelectTable()
  }

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Overlay with blur effect */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      
      {/* Popup Container - Premium Dark Theme */}
      <div 
        className="relative w-full max-w-md bg-gradient-to-b from-zinc-900 via-zinc-900 to-black border border-amber-500/30 rounded-2xl shadow-2xl shadow-amber-500/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative top accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />
        
        {/* Content */}
        <div className="p-8 text-center">
          {/* Cart Icon */}
          <div className="mx-auto w-16 h-16 mb-6 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <svg 
              className="w-8 h-8 text-amber-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" 
              />
            </svg>
          </div>
          
          {/* LUNA Brand */}
          <div className="mb-4">
            <span className="text-xs font-medium tracking-[0.3em] text-amber-500/70 uppercase">
              LUNA Lounge & Bar
            </span>
          </div>
          
          {/* Warning Message */}
          <p className="text-lg font-medium text-white leading-relaxed mb-8">
            {warningMessage}
          </p>
          
          {/* Two Buttons: Yes + Cancel */}
          <div className="flex flex-col gap-3">
            {/* Primary: Yes, Select Table */}
            <button
              onClick={handleSelectTable}
              className="w-full py-4 px-8 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-bold text-base rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/25 active:scale-[0.98]"
            >
              {yesText}
            </button>
            
            {/* Secondary: Cancel/Keep Browsing */}
            <button
              onClick={onClose}
              className="w-full py-3 px-8 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-medium text-base rounded-xl border border-zinc-700 hover:border-zinc-600 transition-all duration-300 active:scale-[0.98]"
            >
              {cancelText}
            </button>
          </div>
        </div>
        
        {/* Decorative corner accents */}
        <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-amber-500/20 rounded-tl-lg pointer-events-none" />
        <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-amber-500/20 rounded-tr-lg pointer-events-none" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-amber-500/20 rounded-bl-lg pointer-events-none" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-amber-500/20 rounded-br-lg pointer-events-none" />
      </div>
    </div>
  )
}
