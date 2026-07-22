"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { currencies } from "@/lib/currencies"
import { getCustomRates, updateCustomRate, deleteCustomRate } from "@/lib/custom-exchange-rates"
import { adminTranslations } from "@/lib/admin-translations"

interface ExchangeRateManagerProps {
  language?: string
}

export default function ExchangeRateManager({ language = "ko" }: ExchangeRateManagerProps) {
  const t = adminTranslations[language as keyof typeof adminTranslations]
  const [customRates, setCustomRatesState] = useState<Record<string, number>>({})
  const [mounted, setMounted] = useState(false)
  const [editingCurrency, setEditingCurrency] = useState<string | null>(null)
  const [editingRate, setEditingRate] = useState<string>("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const rates = getCustomRates()
    setCustomRatesState(rates)
    setMounted(true)
  }, [])

  const handleAddRate = (currency: string) => {
    if (editingRate && !isNaN(Number.parseFloat(editingRate))) {
      const rate = Number.parseFloat(editingRate)
      updateCustomRate(currency, rate)
      setCustomRatesState((prev) => ({
        ...prev,
        [currency]: rate,
      }))
      setEditingCurrency(null)
      setEditingRate("")
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const handleDeleteRate = (currency: string) => {
    deleteCustomRate(currency)
    setCustomRatesState((prev) => {
      const updated = { ...prev }
      delete updated[currency]
      return updated
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!mounted) return null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t.exchangeRateTitle}</CardTitle>
          <CardDescription>{t.exchangeRateDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.keys(customRates).length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">{t.customRates}</h3>
                <div className="border border-border rounded-lg divide-y">
                  {Object.entries(customRates).map(([currency, rate]) => (
                    <div key={currency} className="flex items-center justify-between p-4">
                      <div className="flex-1">
                        <p className="font-semibold">{currency}</p>
                        <p className="text-sm text-muted-foreground">
                          {currencies[currency as keyof typeof currencies]?.name || currency}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary">1 KRW = {rate}</p>
                          <p className="text-sm text-muted-foreground">
                            {t.example}: 450,000 KRW = {Math.round(450000 * rate).toLocaleString()}
                          </p>
                        </div>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteRate(currency)}>
                          {t.delete}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3 border-t border-border pt-6">
              <h3 className="font-semibold text-lg">{t.addEditRate}</h3>
              <div className="space-y-4">
                {Object.entries(currencies).map(([code, info]) => (
                  <div key={code} className="space-y-2">
                    <Label className="text-base font-semibold">
                      {code} - {info.name}
                    </Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Input
                          type="number"
                          step="0.0001"
                          placeholder={t.exchangeRatePlaceholder}
                          value={
                            editingCurrency === code
                              ? editingRate
                              : customRates[code] !== undefined
                                ? customRates[code]
                                : ""
                          }
                          onChange={(e) => {
                            if (editingCurrency === code) {
                              setEditingRate(e.target.value)
                            }
                          }}
                          onFocus={() => {
                            setEditingCurrency(code)
                            setEditingRate(customRates[code]?.toString() || "")
                          }}
                          className="text-base"
                        />
                      </div>
                      {editingCurrency === code && (
                        <Button
                          onClick={() => handleAddRate(code)}
                          disabled={!editingRate || isNaN(Number.parseFloat(editingRate))}
                          className="px-4"
                        >
                          {t.save}
                        </Button>
                      )}
                    </div>
                    {editingCurrency === code && editingRate && !isNaN(Number.parseFloat(editingRate)) && (
                      <p className="text-sm text-muted-foreground">
                        {t.example}: 450,000 KRW ={" "}
                        {Math.round(450000 * Number.parseFloat(editingRate)).toLocaleString()} {code}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {saved && (
              <div className="p-4 bg-green-100 border border-green-300 rounded-lg text-green-800">
                {t.customRateSaved}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
