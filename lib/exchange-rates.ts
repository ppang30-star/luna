export async function fetchExchangeRates(): Promise<Record<string, number>> {
  try {
    // exchangerate-api.com - 다양한 은행의 공시 환율을 수집하여 제공
    const response = await fetch("https://api.exchangerate-api.com/v4/latest/KRW")
    const data = await response.json()

    if (data.rates) {
      console.log("[v0] 공시 환율 조회 성공:", data.rates)
      return data.rates
    }
  } catch (error) {
    console.error("[v0] 공시 환율 조회 오류:", error)
  }

  // API 실패 시 기본 폴백 환율 반환
  return {
    USD: 0.00077,
    JPY: 0.115,
    EUR: 0.00073,
    GBP: 0.00061,
    CNY: 0.0056,
    THB: 0.027,
    SGD: 0.001,
    AUD: 0.0012,
    CAD: 0.001,
    CHF: 0.00068,
    HKD: 0.006,
    TWD: 0.026,
    MYR: 0.0034,
    PHP: 0.044,
    VND: 18.6,
  }
}

export function getCachedRates(): Record<string, number> | null {
  if (typeof window === "undefined") return null

  const cached = localStorage.getItem("exchangeRates")
  if (!cached) return null

  try {
    const { rates, timestamp } = JSON.parse(cached)
    // 24시간 이내의 캐시만 사용
    if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
      return rates
    }
  } catch {
    // 캐시 파싱 실패
  }

  return null
}

export function setCachedRates(rates: Record<string, number>): void {
  if (typeof window === "undefined") return

  localStorage.setItem(
    "exchangeRates",
    JSON.stringify({
      rates,
      timestamp: Date.now(),
    }),
  )
}

export async function refreshExchangeRates(): Promise<Record<string, number>> {
  const rates = await fetchExchangeRates()
  setCachedRates(rates)
  return rates
}
