"use client"

import { useState, useEffect, useCallback } from "react"

// Fallback exchange rates (based on KRW as base currency)
// These are approximate rates and will be updated from API
const FALLBACK_RATES: Record<string, number> = {
  KRW: 1,
  USD: 0.00074,      // ~1350 KRW per USD
  VND: 18.5,         // ~54 KRW per VND  
  JPY: 0.11,         // ~9 KRW per JPY
  CNY: 0.0053,       // ~189 KRW per CNY
  EUR: 0.00068,      // ~1470 KRW per EUR
  THB: 0.026,        // ~38 KRW per THB
}

// Exchange rate API response type
interface ExchangeRateResponse {
  result: string
  base_code: string
  rates: Record<string, number>
}

export function useExchangeRates() {
  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchRates = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Check cache first
      const cached = localStorage.getItem("exchangeRatesCache")
      if (cached) {
        const { rates: cachedRates, timestamp } = JSON.parse(cached)
        const cacheAge = Date.now() - timestamp
        // Use cache if less than 1 hour old
        if (cacheAge < 60 * 60 * 1000) {
          setRates(cachedRates)
          setLastUpdated(new Date(timestamp))
          setLoading(false)
          return
        }
      }

      // Fetch from ExchangeRate-API (free tier)
      // Using KRW as base currency
      const response = await fetch("https://api.exchangerate-api.com/v4/latest/KRW")
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const data: ExchangeRateResponse = await response.json()
      
      if (data.rates) {
        // Add KRW as 1 (base currency)
        const newRates: Record<string, number> = { KRW: 1 }
        
        // Map the rates we need - primary currencies
        if (data.rates.USD) newRates.USD = data.rates.USD
        if (data.rates.VND) newRates.VND = data.rates.VND
        if (data.rates.JPY) newRates.JPY = data.rates.JPY
        if (data.rates.CNY) newRates.CNY = data.rates.CNY
        // Secondary currencies
        if (data.rates.EUR) newRates.EUR = data.rates.EUR
        if (data.rates.THB) newRates.THB = data.rates.THB

        setRates(newRates)
        setLastUpdated(new Date())
        
        // Cache the rates
        localStorage.setItem("exchangeRatesCache", JSON.stringify({
          rates: newRates,
          timestamp: Date.now()
        }))
      }
    } catch (err) {
      console.error("[v0] Error fetching exchange rates:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch rates")
      // Keep using fallback rates
      setRates(FALLBACK_RATES)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRates()
  }, [fetchRates])

  // Convert price from one currency to another
  const convertPrice = useCallback((
    amount: number | null | undefined,
    fromCurrency: string,
    toCurrency: string
  ): number => {
    // Handle null, undefined, or invalid amount
    const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0
    
    if (fromCurrency === toCurrency) return safeAmount
    
    // Convert to KRW first, then to target currency
    const fromRate = rates[fromCurrency] || 1
    const toRate = rates[toCurrency] || 1
    
    // amount is in fromCurrency, convert to KRW
    const amountInKRW = safeAmount / fromRate
    // Convert KRW to target currency
    const convertedAmount = amountInKRW * toRate
    
    // Final NaN check
    return isNaN(convertedAmount) ? 0 : convertedAmount
  }, [rates])

  // Format price based on currency with proper locale and decimal handling
  const formatPrice = useCallback((
    amount: number | null | undefined,
    currency: string
  ): string => {
    // Handle null, undefined, or NaN
    const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0
    
    // Currencies that don't use decimal places
    const noDecimalCurrencies = ["KRW", "VND", "JPY"]
    const useDecimals = !noDecimalCurrencies.includes(currency)
    
    switch (currency) {
      case "KRW":
        return `₩${Math.round(safeAmount).toLocaleString("ko-KR")}`
      case "VND":
        return `₫${Math.round(safeAmount).toLocaleString("vi-VN")}`
      case "USD":
        return `$${safeAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      case "JPY":
        // Japanese Yen - no decimal places
        return `¥${Math.round(safeAmount).toLocaleString("ja-JP")}`
      case "CNY":
        // Chinese Yuan - typically 2 decimal places
        return `¥${safeAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      case "EUR":
        return `€${safeAmount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      case "THB":
        return `฿${Math.round(safeAmount).toLocaleString("th-TH")}`
      default:
        return useDecimals 
          ? safeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : Math.round(safeAmount).toLocaleString()
    }
  }, [])

  return {
    rates,
    loading,
    error,
    lastUpdated,
    convertPrice,
    formatPrice,
    refetch: fetchRates
  }
}
