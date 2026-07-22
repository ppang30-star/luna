"use client"

import { useState } from "react"
import { AlertTriangle, X } from "lucide-react"
import { adminTranslations, type AdminLanguage } from "@/lib/admin-translations"

interface DeleteConfirmationPopupProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  billId: number
  tableNo: string
  amount: string
  language?: AdminLanguage
}

export default function DeleteConfirmationPopup({
  isOpen,
  onClose,
  onConfirm,
  billId,
  tableNo,
  amount,
  language = "ko",
}: DeleteConfirmationPopupProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Get translations
  const t = adminTranslations[language]

  if (!isOpen) return null

  const handleConfirm = async () => {
    setIsDeleting(true)
    try {
      await onConfirm()
    } catch (error) {
      console.error("DeleteConfirmationPopup: onConfirm error:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-zinc-900 rounded-2xl border border-red-900/50 shadow-2xl shadow-red-900/20 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header with red accent */}
        <div className="bg-gradient-to-r from-red-900/60 to-red-800/40 px-6 py-4 border-b border-red-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-600/30">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-red-300">{t.deleteConfirmTitle}</h2>
            </div>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="p-2 rounded-lg hover:bg-red-800/50 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-red-300" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-zinc-300 text-center">
            {t.deleteWarningMessage}
          </p>
          
          {/* Record Info Card */}
          <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-sm">{t.billNumber}</span>
              <span className="text-white font-semibold">#{billId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-sm">{t.table}</span>
              <span className="text-white font-semibold">{tableNo}</span>
            </div>
            <div className="flex justify-between items-center border-t border-zinc-700 pt-2 mt-2">
              <span className="text-zinc-400 text-sm">{t.deleteAmount}</span>
              <span className="text-red-400 font-bold text-lg">{amount}</span>
            </div>
          </div>

          <p className="text-xs text-zinc-500 text-center">
            {t.deletedDataCannotRecover}
          </p>
        </div>

        {/* Footer Buttons */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 py-3 px-4 rounded-xl font-semibold bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition-colors disabled:opacity-50"
          >
            {t.cancelDelete}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex-1 py-3 px-4 rounded-xl font-semibold bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t.deleting}
              </>
            ) : (
              t.confirm
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
