// Primary supported currencies for the menu app
export const currencies = {
  KRW: { symbol: "₩", name: "한국 원", rate: 1, locale: "ko-KR", decimals: 0 },
  USD: { symbol: "$", name: "미국 달러", rate: 0.00074, locale: "en-US", decimals: 2 },
  VND: { symbol: "₫", name: "베트남 동", rate: 18.5, locale: "vi-VN", decimals: 0 },
  JPY: { symbol: "¥", name: "일본 엔", rate: 0.11, locale: "ja-JP", decimals: 0 },
  CNY: { symbol: "¥", name: "중국 위안", rate: 0.0053, locale: "zh-CN", decimals: 2 },
  // Secondary currencies (available for extension)
  EUR: { symbol: "€", name: "유로", rate: 0.00068, locale: "de-DE", decimals: 2 },
  GBP: { symbol: "£", name: "영국 파운드", rate: 0.00061, locale: "en-GB", decimals: 2 },
  THB: { symbol: "฿", name: "태국 바트", rate: 0.026, locale: "th-TH", decimals: 0 },
  SGD: { symbol: "$", name: "싱가포르 달러", rate: 0.001, locale: "en-SG", decimals: 2 },
  AUD: { symbol: "A$", name: "호주 달러", rate: 0.0012, locale: "en-AU", decimals: 2 },
  CAD: { symbol: "C$", name: "캐나다 달러", rate: 0.001, locale: "en-CA", decimals: 2 },
  CHF: { symbol: "₣", name: "스위스 프랑", rate: 0.00068, locale: "fr-CH", decimals: 2 },
  HKD: { symbol: "HK$", name: "홍콩 달러", rate: 0.006, locale: "zh-HK", decimals: 2 },
  TWD: { symbol: "NT$", name: "대만 달러", rate: 0.026, locale: "zh-TW", decimals: 0 },
  MYR: { symbol: "RM", name: "말레이시아 링깃", rate: 0.0034, locale: "ms-MY", decimals: 2 },
  PHP: { symbol: "₱", name: "필리핀 페소", rate: 0.044, locale: "tl-PH", decimals: 2 },
}

// Primary currencies displayed in the selector dropdown
export const PRIMARY_CURRENCY_CODES = ["KRW", "USD", "VND", "JPY", "CNY"] as const

export type Currency = keyof typeof currencies
export type PrimaryCurrency = typeof PRIMARY_CURRENCY_CODES[number]
