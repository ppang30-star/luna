'use client'

import { useContext, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Lock } from 'lucide-react'
import { verifyManagerPassword, setSessionAdjustment, logPriceAdjustment } from '@/lib/manager-price'
import { LanguageContext } from '@/lib/context'
import { translations, type Language } from '@/lib/translations'

interface PriceAdjustmentModalProps {
  isOpen: boolean
  onClose: () => void
  itemId: string
  itemName: string
  originalPrice: number
  currentAdjustedPrice: number
  onSuccess?: (adjustedPrice: number) => void
}

export default function PriceAdjustmentModal({
  isOpen,
  onClose,
  itemId,
  itemName,
  originalPrice,
  currentAdjustedPrice,
  onSuccess
}: PriceAdjustmentModalProps) {
  const [adjustedPrice, setAdjustedPrice] = useState(currentAdjustedPrice)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [managerName, setManagerName] = useState('')
  const [managerPassword, setManagerPassword] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Pull the current language from the app's i18n context (falls back to Korean)
  const language = (useContext(LanguageContext) as Language) || 'ko'
  const t = translations[language]?.priceEdit ?? translations.ko.priceEdit

  if (!isOpen) return null

  const priceChange = adjustedPrice - originalPrice
  const canIncrease = (adjustedPrice + 50000) <= (originalPrice * 1.5) // Max 50% increase
  const canDecrease = (adjustedPrice - 50000) >= (originalPrice * 0.5) // Min 50% decrease

  const handleIncrease = () => {
    if (canIncrease) {
      setAdjustedPrice(adjustedPrice + 50000)
    }
  }

  const handleDecrease = () => {
    if (canDecrease) {
      setAdjustedPrice(adjustedPrice - 50000)
    }
  }

  const handleReset = () => {
    setAdjustedPrice(originalPrice)
  }

  const handleUpdateClick = () => {
    if (priceChange === 0) {
      onClose()
      return
    }
    setShowPasswordModal(true)
  }

  const handleVerifyPassword = async () => {
    if (!managerName.trim() || !managerPassword.trim()) {
      setError(t.enterCredentials)
      return
    }

    setIsVerifying(true)
    setError('')

    try {
      const isValid = await verifyManagerPassword(managerName, managerPassword)
      
      if (isValid) {
        // Log the adjustment
        await logPriceAdjustment(itemId, itemName, originalPrice, adjustedPrice, managerName)
        
        // Store the adjustment in session
        setSessionAdjustment(itemId, {
          itemId,
          originalPrice,
          adjustedPrice,
          managerName,
          adjustmentTime: Date.now()
        })

        setSuccessMessage(t.updateSuccess)
        setTimeout(() => {
          setShowPasswordModal(false)
          setManagerName('')
          setManagerPassword('')
          setSuccessMessage('')
          onSuccess?.(adjustedPrice)
          onClose()
        }, 1500)
      } else {
        setError(t.invalidCredentials)
        setManagerPassword('')
      }
    } catch (err) {
      setError(t.verificationFailed)
      console.error('[v0] Password verification error:', err)
    } finally {
      setIsVerifying(false)
    }
  }

  // Password modal
  if (showPasswordModal) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-card rounded-lg p-6 max-w-sm w-full mx-4 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-500" />
              {t.managerVerification}
            </h3>
            <button onClick={() => setShowPasswordModal(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          {successMessage ? (
            <div className="bg-green-500/10 border border-green-500 rounded-lg p-4 text-center">
              <p className="text-green-600 font-medium">{successMessage}</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">{t.managerName}</label>
                  <Input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder={t.managerNamePlaceholder}
                    disabled={isVerifying}
                    className="bg-background border-border"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">{t.password}</label>
                  <Input
                    type="password"
                    value={managerPassword}
                    onChange={(e) => setManagerPassword(e.target.value)}
                    placeholder={t.passwordPlaceholder}
                    disabled={isVerifying}
                    className="bg-background border-border"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !isVerifying) {
                        handleVerifyPassword()
                      }
                    }}
                  />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500 rounded-lg p-3">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-6">
                <Button
                  onClick={handleVerifyPassword}
                  disabled={isVerifying}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {isVerifying ? t.verifying : t.verifyAndUpdate}
                </Button>
                <Button
                  onClick={() => setShowPasswordModal(false)}
                  disabled={isVerifying}
                  variant="outline"
                  className="flex-1"
                >
                  {t.cancel}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // Price adjustment modal
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">{itemName}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Original Price */}
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">{t.basePrice}</p>
            <p className="text-2xl font-bold text-foreground">
              {originalPrice.toLocaleString()} VND
            </p>
          </div>

          {/* Adjusted Price with +/- buttons */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t.adjustPrice}</p>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleDecrease}
                disabled={!canDecrease}
                variant="outline"
                className="w-12 h-12 p-0 text-xl font-bold"
              >
                −
              </Button>
              <div className="flex-1 bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-foreground">
                  {adjustedPrice.toLocaleString()} VND
                </p>
                <p className={`text-xs mt-1 ${priceChange > 0 ? 'text-red-500' : priceChange < 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                  {priceChange > 0 ? '+' : ''}{priceChange.toLocaleString()} VND
                </p>
              </div>
              <Button
                onClick={handleIncrease}
                disabled={!canIncrease}
                variant="outline"
                className="w-12 h-12 p-0 text-xl font-bold"
              >
                +
              </Button>
            </div>
          </div>

          {/* Reset button */}
          {priceChange !== 0 && (
            <Button
              onClick={handleReset}
              variant="ghost"
              className="w-full text-xs"
            >
              {t.resetToBasePrice}
            </Button>
          )}

          {/* Update button (red) */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleUpdateClick}
              disabled={priceChange === 0}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {t.updatePrice}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              {t.cancel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
