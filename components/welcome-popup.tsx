"use client"

import { useState, useEffect } from "react"
import { RotateCcw } from "lucide-react"

interface WelcomePopupProps {
  onLanguageSelect: (lang: string) => void
  onRestoreOrder?: () => void
  hasPreviousBackup?: boolean
}

const languages = [
  { code: "ko", label: "한국어", subtitle: "Korean" },
  { code: "en", label: "English", subtitle: "영어" },
  { code: "ja", label: "日本語", subtitle: "Japanese" },
  { code: "zh", label: "中文", subtitle: "Chinese" },
  { code: "vi", label: "Tiếng Việt", subtitle: "Vietnamese" },
  { code: "hi", label: "हिन्दी", subtitle: "Hindi" },
]

const WELCOME_POPUP_KEY = "welcomePopupShown"

export default function WelcomePopup({ onLanguageSelect, onRestoreOrder, hasPreviousBackup }: WelcomePopupProps) {
  // Initialize to true so popup shows immediately on first render
  const [showPopup, setShowPopup] = useState(true)
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false)

  // Check localStorage after mount to determine if popup should stay visible
  useEffect(() => {
    const hasShown = localStorage.getItem(WELCOME_POPUP_KEY)
    if (hasShown === "true") {
      setShowPopup(false)
    }
    setHasCheckedStorage(true)
  }, [])

  const handleLanguageSelect = (langCode: string) => {
    // Save that popup has been shown
    localStorage.setItem(WELCOME_POPUP_KEY, "true")
    localStorage.setItem("selectedLanguage", langCode)
    setShowPopup(false)
    onLanguageSelect(langCode)
  }

  // Don't render anything if popup should be hidden and we've checked storage
  if (!showPopup && hasCheckedStorage) {
    return null
  }

  // Premium dark overlay with very high z-index
  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
    >
      {/* Premium Card Container */}
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        
        {/* Elegant Header with Welcome Text */}
        <div className="px-8 pt-10 pb-6 text-center border-b border-white/10">
          {/* Logo/Brand Area */}
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="text-2xl font-bold text-zinc-900">L</span>
            </div>
          </div>
          
          {/* Welcome Message - Prominent and Centered */}
          <h1 className="text-2xl font-light text-white tracking-wide mb-3">
            Welcome to
          </h1>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 mb-4">
            LUNA Lounge & Bar
          </h2>
          <p className="text-zinc-400 text-sm font-light tracking-wide">
            Please select your preferred language
          </p>
        </div>
        
        {/* Premium Language Grid */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-3">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageSelect(lang.code)}
                className="group relative flex flex-col items-center justify-center p-5 rounded-xl 
                         bg-zinc-800/50 border border-white/10 
                         hover:bg-zinc-800 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10
                         transition-all duration-300 ease-out"
              >
                {/* Language Name */}
                <span className="text-lg font-semibold text-white group-hover:text-amber-400 transition-colors duration-300">
                  {lang.label}
                </span>
                {/* Subtitle */}
                <span className="text-xs text-zinc-500 mt-1 group-hover:text-zinc-400 transition-colors duration-300">
                  {lang.subtitle}
                </span>
                
                {/* Hover Glow Effect */}
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-500/5 to-orange-500/5" />
                </div>
              </button>
            ))}
          </div>
        </div>
        
        {/* Restore Previous Order Button - Only shown if backup exists */}
        {hasPreviousBackup && onRestoreOrder && (
          <div className="px-6 pb-4">
            <button
              onClick={onRestoreOrder}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                       bg-zinc-800/80 border border-amber-500/30 
                       hover:bg-zinc-700/80 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10
                       transition-all duration-300 ease-out group"
            >
              <RotateCcw className="w-4 h-4 text-amber-400 group-hover:rotate-[-30deg] transition-transform duration-300" />
              <span className="text-sm font-medium text-amber-400">
                이전 주문 복원
              </span>
              <span className="text-xs text-zinc-500 ml-1">
                (Restore Previous Order)
              </span>
            </button>
          </div>
        )}
        
        {/* Elegant Footer */}
        <div className="px-8 pb-6 text-center">
          <p className="text-zinc-600 text-xs tracking-widest uppercase">
            Premium Lounge Experience
          </p>
        </div>
      </div>
    </div>
  )
}
