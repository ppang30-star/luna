"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { AlertCircle, Edit3, CheckCircle, Share2 } from "lucide-react"

interface ReceiptVerificationModalProps {
  isOpen: boolean
  language: string
  onModify: () => void  // 수정하기 - BillConfigurationModal로 돌아감
  onConfirmShare: () => void  // 확인 및 공유 - Telegram 공유 진행
}

// 6개 언어 번역 (KR, EN, VN, JP, CN, HI)
// All Telegram notifications are sent in Vietnamese automatically
const translations: Record<string, {
  header: string
  message: string
  modifyButton: string
  confirmButton: string
}> = {
  ko: {
    header: "출력 확인",
    message: "출력된 영수증에 이상이 없습니까? Telegram 단체방에 HÓA ĐƠN(영수증)을 공유하고 정산을 종료할까요?",
    modifyButton: "수정하기",
    confirmButton: "확인 및 공유"
  },
  en: {
    header: "Receipt Verification",
    message: "Is the printed receipt correct? Share HÓA ĐƠN (Receipt) to Telegram group and complete settlement?",
    modifyButton: "Modify",
    confirmButton: "Confirm & Share"
  },
  vi: {
    header: "Xác nhận in",
    message: "Hóa đơn in có chính xác không? Chia sẻ HÓA ĐƠN đến nhóm Telegram và hoàn tất thanh toán?",
    modifyButton: "Sửa đổi",
    confirmButton: "Xác nhận & Chia sẻ"
  },
  ja: {
    header: "レシート確認",
    message: "印刷されたレシートは正しいですか？TelegramグループにHÓA ĐƠN(領収書)を共有して決済を完了しますか？",
    modifyButton: "修正する",
    confirmButton: "確認して共有"
  },
  zh: {
    header: "收据确认",
    message: "打印的收据正确吗？分享HÓA ĐƠN(收据)到Telegram群组并完成结算？",
    modifyButton: "修改",
    confirmButton: "确认并分享"
  },
  hi: {
    header: "रसीद सत्यापन",
    message: "क्या प्रिंट की गई रसीद सही है? Telegram ग्रुप में HÓA ĐƠN (रसीद) साझा करें और भुगतान पूरा करें?",
    modifyButton: "संशोधित करें",
    confirmButton: "पुष्टि करें और साझा करें"
  }
}

export default function ReceiptVerificationModal({
  isOpen,
  language,
  onModify,
  onConfirmShare
}: ReceiptVerificationModalProps) {
  const [mounted, setMounted] = useState(false)

  const t = translations[language] || translations.ko

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !isOpen) return null

  const modalContent = (
    <div className="fixed inset-0 z-[10001] w-screen h-screen flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 px-6 py-5 border-b border-zinc-700 bg-gradient-to-r from-amber-900/30 to-orange-900/30">
          <AlertCircle className="w-7 h-7 text-amber-400" />
          <h2 className="text-xl font-bold text-white">{t.header}</h2>
        </div>

        {/* Message Body */}
        <div className="p-6">
          <p className="text-zinc-200 text-center text-lg leading-relaxed">
            {t.message}
          </p>
        </div>

        {/* Action Buttons - Horizontal Layout */}
        <div className="flex gap-3 p-6 pt-2">
          {/* 수정하기 버튼 (왼쪽) */}
          <button
            onClick={onModify}
            className="flex-1 py-4 px-4 rounded-xl font-bold bg-zinc-700 text-white hover:bg-zinc-600 transition-all border border-zinc-600 flex items-center justify-center gap-2"
          >
            <Edit3 className="w-5 h-5" />
            {t.modifyButton}
          </button>
          
          {/* 확인 및 공유 버튼 (오른쪽) */}
          <button
            onClick={onConfirmShare}
            className="flex-1 py-4 px-4 rounded-xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-500 hover:to-green-500 transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            <Share2 className="w-4 h-4" />
            {t.confirmButton}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
