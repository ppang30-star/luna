"use client"

import type { Language } from "@/lib/translations"

interface TableWarningPopupProps {
  isOpen: boolean
  onClose: () => void
  onSelectTable: () => void  // 테이블 선택 버튼 클릭
  onBrowseMode: () => void   // 둘러보기 버튼 클릭
  language: Language
}

// Translations for the warning message
const warningTranslations: Record<string, string> = {
  ko: "테이블 선택을 먼저 해주세요.",
  en: "Please select a table first.",
  ja: "先にテーブルを選択してください。",
  zh: "请先选择您的桌号。",
  vi: "Vui lòng chọn bàn trước.",
  hi: "कृपया पहले एक टेबल चुनें।",
}

// Translations for "Select Table" button
const selectTableTranslations: Record<string, string> = {
  ko: "테이블 선택",
  en: "Select Table",
  ja: "テーブル選択",
  zh: "选择桌号",
  vi: "Chọn bàn",
  hi: "टेबल चुनें",
}

// Translations for "Browse Menu" button
const browseModeTranslations: Record<string, string> = {
  ko: "둘러보기",
  en: "Browse Menu",
  ja: "メニューを見る",
  zh: "浏览菜单",
  vi: "Xem thực đơn",
  hi: "मेन्यू देखें",
}

export default function TableWarningPopup({ isOpen, onClose, onSelectTable, onBrowseMode, language }: TableWarningPopupProps) {
  if (!isOpen) return null

  const warningMessage = warningTranslations[language] || warningTranslations.en
  const selectTableText = selectTableTranslations[language] || selectTableTranslations.en
  const browseModeText = browseModeTranslations[language] || browseModeTranslations.en

  const handleSelectTable = () => {
    onClose()
    onSelectTable()
  }

  const handleBrowseMode = () => {
    onClose()
    onBrowseMode()
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
          {/* Warning Icon */}
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
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
          
          {/* Two Buttons: Select Table + Browse Mode */}
          <div className="flex flex-col gap-3">
            {/* Primary: Select Table */}
            <button
              onClick={handleSelectTable}
              className="w-full py-4 px-8 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-bold text-base rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/25 active:scale-[0.98]"
            >
              {selectTableText}
            </button>
            
            {/* Secondary: Browse Mode */}
            <button
              onClick={handleBrowseMode}
              className="w-full py-3 px-8 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-medium text-base rounded-xl border border-zinc-700 hover:border-zinc-600 transition-all duration-300 active:scale-[0.98]"
            >
              {browseModeText}
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
