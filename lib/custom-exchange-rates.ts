export interface CustomExchangeRates {
  [key: string]: number
}

export function getCustomRates(): CustomExchangeRates {
  if (typeof window === "undefined") return {}

  const saved = localStorage.getItem("customExchangeRates")
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      return {}
    }
  }
  return {}
}

export function setCustomRates(rates: CustomExchangeRates): void {
  localStorage.setItem("customExchangeRates", JSON.stringify(rates))
}

export function updateCustomRate(currency: string, rate: number): void {
  const current = getCustomRates()
  current[currency] = rate
  setCustomRates(current)
}

export function deleteCustomRate(currency: string): void {
  const current = getCustomRates()
  delete current[currency]
  setCustomRates(current)
}
