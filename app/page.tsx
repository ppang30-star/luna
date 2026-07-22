"use client"

import { useState, useEffect } from "react"
import LanguageSelector from "@/components/language-selector"
import CurrencySelector from "@/components/currency-selector"
import MenuDisplay from "@/components/menu-display"
import TableSelector from "@/components/table-selector"
import TableSwitchConfirmationPopup from "@/components/table-switch-confirmation-popup"
import WelcomePopup from "@/components/welcome-popup"
  import { LanguageContext, CurrencyContext } from "@/lib/context"
  import { translations, type Language } from "@/lib/translations"
import { CartContext, type CartItem } from "@/lib/cart-context"
import { useRouter } from "next/navigation"
import { useRealtimeMenu } from "@/hooks/use-realtime-menu"
import { useStoreSettings, useSelectedTable } from "@/hooks/use-store-settings"
import type { MenuItemData } from "@/lib/menu-data"

interface LocalPageSettings {
  title: string
  subtitle: string
  backgroundImage: string
}

interface Category {
  id: string
  ko: string
  en: string
  ja: string
  zh: string
  es: string
  th: string
  vi: string
}

const DEFAULT_LOCAL_SETTINGS: LocalPageSettings = {
  title: "셀프 메뉴판",
  subtitle: "프리미엄 음료 선택",
  backgroundImage: "",
}

const DEFAULT_CATEGORIES = [
  {
    id: "spirits",
    ko: "위스키",
    en: "Spirits",
    ja: "ウイスキー",
    zh: "威士忌",
    es: "Espíritus",
    th: "วิสกี้",
    vi: "Rượu mạnh",
  },
  { id: "beers", ko: "맥주", en: "Beer", ja: "ビール", zh: "啤酒", es: "Cerveza", th: "เบียร์", vi: "Bia" },
  { id: "wines", ko: "와인", en: "Wine", ja: "ワイン", zh: "葡萄酒", es: "Vino", th: "ไวน์", vi: "Rượu vang" },
  {
    id: "cocktails",
    ko: "칵테일",
    en: "Cocktail",
    ja: "カクテル",
    zh: "鸡尾酒",
    es: "Cóctel",
    th: "ค็อกเทล",
    vi: "Cocktail",
  },
  {
    id: "liqueurs",
    ko: "리큐르",
    en: "Liqueur",
    ja: "リキュール",
    zh: "利口酒",
    es: "Licor",
    th: "ลิเคียร์",
    vi: "Rượu Liqueur",
  },
] as const satisfies readonly Category[]

export default function MenuPage() {
  // Initialize showWelcomePopup to true so it appears on first load
  const [showWelcomePopup, setShowWelcomePopup] = useState(true)
  const [language, setLanguage] = useState<string>("ko")
  const [currency, setCurrency] = useState<string | null>(null)
  const [currencyInitialized, setCurrencyInitialized] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [localSettings, setLocalSettings] = useState<LocalPageSettings>(DEFAULT_LOCAL_SETTINGS)
  // Per-table cart map: each table number keeps its own independent cart,
  // keyed by table number (falling back to "default" when no table is selected).
  const [cartsByTable, setCartsByTable] = useState<Record<string, CartItem[]>>({})
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false)
  const router = useRouter()
  const headerT = translations[language as Language]?.header ?? translations.ko.header
  
  // Supabase realtime menu data
  const { categories: realtimeCategories, menuItems: realtimeMenuItems, loading: realtimeLoading } = useRealtimeMenu()
  
  // Supabase store settings (global state for table numbers)
  const { settings: storeSettings, loading: storeSettingsLoading } = useStoreSettings()
  
  // Table numbers from global Supabase store
  const tableNumbers = storeSettings.table_numbers || []
  
  // Selected table (stored in localStorage per device)
  const { selectedTable, selectTable, mounted: tableMounted } = useSelectedTable(tableNumbers)

  // The current table's cart is derived from the per-table map.
  const tableKey = selectedTable || "default"
  const cart = cartsByTable[tableKey] || []

  // Persist a table's cart to both in-memory map and localStorage (scoped per table).
  const commitCart = (tableK: string, next: CartItem[]) => {
    setCartsByTable((prev) => ({ ...prev, [tableK]: next }))
    try {
      localStorage.setItem(`cart_${tableK}`, JSON.stringify(next))
    } catch {
      // ignore storage errors
    }
  }

  // FUNCTIONAL updater — the ONLY safe way to mutate the cart from a rapid loop
  // (e.g. the modifier modal dispatching several staff members in one forEach).
  // Each call derives `next` from the freshest `prev` state, so no dispatch can
  // clobber a sibling dispatch with a stale closure. localStorage is synced from
  // inside the updater to stay consistent with whatever state React committed.
  const commitCartUpdate = (tableK: string, updater: (prevCart: CartItem[]) => CartItem[]) => {
    setCartsByTable((prev) => {
      const prevCart = prev[tableK] || []
      const next = updater(prevCart)
      try {
        localStorage.setItem(`cart_${tableK}`, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      return { ...prev, [tableK]: next }
    })
  }

  // Load ONLY the selected table's cart whenever the table changes.
  // Other tables' in-memory carts are preserved untouched.
  useEffect(() => {
    let parsed: CartItem[] = []
    const saved = localStorage.getItem(`cart_${tableKey}`)
    if (saved) {
      try {
        parsed = JSON.parse(saved)
      } catch {
        parsed = []
      }
    }
    setCartsByTable((prev) => ({ ...prev, [tableKey]: parsed }))
  }, [tableKey])

  // Pending table awaiting confirmation before switching.
  const [pendingTable, setPendingTable] = useState<string | null>(null)

  // Returns true if the currently selected table has a non-empty cart or
  // unsettled accumulated orders (orderHistory_<table> is a non-empty array).
  const currentTableHasUnfinishedWork = () => {
    if (cart.length > 0) return true
    try {
      const stored = localStorage.getItem(`orderHistory_${selectedTable || "default"}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) return true
      }
    } catch {
      // ignore parse/storage errors
    }
    return false
  }

  // Guarded table switch: if switching to a different table while the current
  // one still has a cart or unsettled orders, ask for confirmation first.
  const handleTableSwitchRequest = (newTable: string) => {
    if (newTable === selectedTable) return
    if (selectedTable && currentTableHasUnfinishedWork()) {
      setPendingTable(newTable)
      return
    }
    selectTable(newTable)
  }

  // Detect dominant currency from menu data
  useEffect(() => {
    if (!currencyInitialized && !realtimeLoading && realtimeMenuItems.length > 0) {
      const currencyCounts: Record<string, number> = {}
      realtimeMenuItems.forEach((item) => {
        const itemCurrency = item.priceCurrency || "KRW"
        currencyCounts[itemCurrency] = (currencyCounts[itemCurrency] || 0) + 1
      })
      
      let dominantCurrency = "KRW"
      let maxCount = 0
      Object.entries(currencyCounts).forEach(([curr, count]) => {
        if (count > maxCount) {
          maxCount = count
          dominantCurrency = curr
        }
      })
      
      setCurrency(dominantCurrency)
      setCurrencyInitialized(true)
    } else if (!currencyInitialized && !realtimeLoading && realtimeMenuItems.length === 0) {
      setCurrency("KRW")
      setCurrencyInitialized(true)
    }
  }, [realtimeLoading, realtimeMenuItems, currencyInitialized])
  
  // Determine data source based on Supabase connection
  const categories: Category[] = isSupabaseConnected ? realtimeCategories : [...DEFAULT_CATEGORIES]
  const menuItemsToShow = isSupabaseConnected ? realtimeMenuItems : []

  const cartContextValue = {
    cart,
    addItem: (item: CartItem) => {
      // STRICT ID CHECK: prefer the unique cartItemKey (e.g. `${id}-Luna`) and only
      // fall back to the base id for plain items. This is what keeps
      // "Lady Charge + Luna" / "+ Lin" / "+ Alice" as three independent rows.
      const itemKey = item.cartItemKey || item.id

      // FUNCTIONAL update so a forEach loop of dispatches never loses rows to a
      // stale closure — each call sees the cart produced by the previous call.
      commitCartUpdate(tableKey, (prevCart) => {
        const existingItem = prevCart.find((c) => (c.cartItemKey || c.id) === itemKey)

        console.log("[v0] addItem called:", {
          itemKey,
          itemName: item.nameKo,
          modifiers: item.selectedModifiers?.length || 0,
          existingItemFound: !!existingItem,
          prevCartSize: prevCart.length,
        })

        // If the unique key already exists, bump its quantity; otherwise APPEND a
        // brand-new row even when the base menuItem.id matches an existing item.
        return existingItem
          ? prevCart.map((c) =>
              (c.cartItemKey || c.id) === itemKey ? { ...c, quantity: c.quantity + 1 } : c,
            )
          : [...prevCart, { ...item, createdAt: Date.now() }]
      })
    },
    removeItem: (id: string) => {
      // id here is actually the cartItemKey or id
      commitCartUpdate(tableKey, (prevCart) =>
        prevCart.filter((item) => (item.cartItemKey || item.id) !== id),
      )
    },
    updateQuantity: (id: string, quantity: number) => {
      // id here is actually the cartItemKey or id
      commitCartUpdate(tableKey, (prevCart) =>
        quantity <= 0
          ? prevCart.filter((item) => (item.cartItemKey || item.id) !== id)
          : prevCart.map((item) =>
              (item.cartItemKey || item.id) === id ? { ...item, quantity } : item,
            ),
      )
    },
    updatePrice: (id: string, priceAmount: number) => {
      // id here is actually the cartItemKey or id
      commitCartUpdate(tableKey, (prevCart) =>
        prevCart.map((item) =>
          (item.cartItemKey || item.id) === id
            ? { ...item, priceAmount, priceKRW: priceAmount }
            : item,
        ),
      )
    },
    updateComboOptionQuantity: (id: string, comboItemId: string, quantity: number) => {
      // Adjust the quantity of a single combo sub-item within a cart line. Removing
      // the last unit drops that sub-item from the line (quantity <= 0).
      commitCartUpdate(tableKey, (prevCart) =>
        prevCart.map((item) => {
          if ((item.cartItemKey || item.id) !== id || !Array.isArray(item.comboOptions)) return item
          const nextOptions = item.comboOptions
            .map((opt) => (opt.itemId === comboItemId ? { ...opt, quantity } : opt))
            .filter((opt) => opt.quantity > 0)
          return { ...item, comboOptions: nextOptions }
        }),
      )
    },
  }

  const handleAddToCart = (item: MenuItemData | CartItem) => {
    // Handle both MenuItemData (from direct menu clicks) and CartItem (from modifier modal)
    // CartItem includes cartItemKey for modifier-based items
    const cartItem: CartItem = { 
      ...item, 
      quantity: 1,
      priceCurrency: item.priceCurrency || "KRW",
      priceAmount: item.priceAmount ?? item.priceKRW,
      // Preserve cartItemKey if it exists (from modifier modal)
      ...(item.cartItemKey && { cartItemKey: item.cartItemKey }),
    }
    
    console.log("[v0] handleAddToCart called:", {
      itemName: cartItem.nameKo,
      cartItemKey: cartItem.cartItemKey,
      hasModifiers: !!cartItem.selectedModifiers?.length,
    })
    
    cartContextValue.addItem(cartItem)
  }

  // Check Supabase connection status
  useEffect(() => {
    if (!realtimeLoading) {
      if (realtimeCategories.length > 0 || realtimeMenuItems.length > 0) {
        setIsSupabaseConnected(true)
      } else {
        setIsSupabaseConnected(false)
      }
    }
  }, [realtimeLoading, realtimeCategories.length, realtimeMenuItems.length])

  // Load local settings and cart on mount.
  // Title/subtitle are only seeded from localStorage here as a fast first paint;
  // the Supabase store_settings values (below) are the source of truth and will
  // override these once loaded, keeping every device in sync.
  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem("pageSettings")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setLocalSettings({
          title: parsed.title || DEFAULT_LOCAL_SETTINGS.title,
          subtitle: parsed.subtitle || DEFAULT_LOCAL_SETTINGS.subtitle,
          backgroundImage: parsed.backgroundImage || "",
        })
      } catch {
        setLocalSettings(DEFAULT_LOCAL_SETTINGS)
      }
    }
    // Per-table carts are loaded by the tableKey-scoped effect above.
  }, [])

  // ★ Title/subtitle come from Supabase store_settings (shared across all devices).
  // This effect makes admin edits appear on every device and prevents reverting.
  useEffect(() => {
    if (!storeSettingsLoading) {
      setLocalSettings((prev) => ({
        ...prev,
        title: storeSettings.page_title || prev.title,
        subtitle: storeSettings.page_subtitle || prev.subtitle,
      }))
    }
  }, [storeSettingsLoading, storeSettings.page_title, storeSettings.page_subtitle])

  const setCategories = (newCategories: Category[]) => {
    // Handle category update logic here
  }

  // Handler for when user selects language from welcome popup
  const handleWelcomeLanguageSelect = (lang: string) => {
    setLanguage(lang)
    setShowWelcomePopup(false)
  }

  // Session reset handler - called after "최종계산요청" (Request Final Bill) is processed
  // This resets the session for the next customer at the table
  const handleSessionReset = () => {
    // ★ CRITICAL: Database is NOT touched - all backend records are preserved
    
    // ★ Clear ONLY local UI state for next customer
    // Step 1: Empty ONLY this table's cart; other tables stay untouched.
    setCartsByTable((prev) => {
      const next = { ...prev }
      delete next[tableKey]
      return next
    })
    try {
      localStorage.removeItem(`cart_${tableKey}`)
    } catch {
      // ignore storage errors
    }
    
    // Step 2: Clear the selected table state
    selectTable(null)
    localStorage.removeItem("selectedTable")
    
    // Step 3: Reset language and show language popup
    localStorage.removeItem("welcomePopupShown")
    localStorage.removeItem("selectedLanguage")
    setLanguage("ko")
    setShowWelcomePopup(true)
  }

  // 이전 주문 복원 핸들러
  const handleRestoreOrder = () => {
    try {
      const backup = localStorage.getItem("previousCartBackup")
      if (!backup) return
      
      const { cart: backupCart, table: backupTable, orderHistory: backupOrderHistory } = JSON.parse(backup)
      
      // 장바구니 복원 (해당 테이블 전용 장바구니로 복원)
      if (backupCart && backupCart.length > 0) {
        commitCart(backupTable || "default", backupCart)
      }
      
      // 테이블 번호 복원
      if (backupTable) {
        selectTable(backupTable)
      }
      
      // 주문 내역 복원
      if (backupOrderHistory && backupTable) {
        localStorage.setItem(`orderHistory_${backupTable}`, backupOrderHistory)
      }
      
      // 백업 삭제 (한 번만 복원 가능)
      localStorage.removeItem("previousCartBackup")
      
      // Welcome popup 숨기기 및 언어 설정 복원
      localStorage.setItem("welcomePopupShown", "true")
      setShowWelcomePopup(false)
    } catch (error) {
      console.error("주문 복원 실패:", error)
    }
  }

  // 이전 주문 백업 존재 여부 확인
  const hasPreviousBackup = () => {
    try {
      const backup = localStorage.getItem("previousCartBackup")
      if (!backup) return false
      const { timestamp } = JSON.parse(backup)
      // 1시간 이내의 백업만 유효
      return Date.now() - timestamp < 60 * 60 * 1000
    } catch {
      return false
    }
  }

  // 테이블 선택 요청 핸들러 (Browse Mode에서 장바구니 시도 시 호출)
  // Welcome Popup을 다시 표시하여 테이블을 선택하도록 유도
  const handleRequestTableSelection = () => {
    setShowWelcomePopup(true)
  }

  // Check if welcome popup was already shown (on mount)
  useEffect(() => {
    const hasShownPopup = localStorage.getItem("welcomePopupShown")
    if (hasShownPopup === "true") {
      setShowWelcomePopup(false)
      // Also restore previously selected language if available
      const savedLang = localStorage.getItem("selectedLanguage")
      if (savedLang) {
        setLanguage(savedLang)
      }
    }
  }, [])

  // Don't render until initialized
  if (!mounted || !currencyInitialized || currency === null) return null

  return (
    <LanguageContext.Provider value={language}>
      <CurrencyContext.Provider value={currency}>
        <CartContext.Provider value={cartContextValue}>
          {/* Welcome Popup - shown on first load with high z-index */}
          {showWelcomePopup && (
            <WelcomePopup 
              onLanguageSelect={handleWelcomeLanguageSelect} 
              onRestoreOrder={handleRestoreOrder}
              hasPreviousBackup={hasPreviousBackup()}
            />
          )}
          
          <main
            className="min-h-screen bg-background text-foreground"
            style={
              localSettings.backgroundImage
                ? {
                    backgroundImage: `url(${localSettings.backgroundImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundAttachment: "fixed",
                  }
                : {
                    // Deep dark leather backdrop with a dramatic central light bloom and a
                    // heavy vignette for pronounced 3D depth (grain applied in overlay below).
                    backgroundColor: "#100a08",
                    backgroundImage: [
                      // central warm light bloom
                      "radial-gradient(85% 60% at 50% 34%, rgba(255,176,120,0.12) 0%, rgba(255,150,90,0) 55%)",
                      // burgundy glow anchoring the lower-right
                      "radial-gradient(120% 90% at 85% 100%, rgba(123,30,43,0.30) 0%, rgba(123,30,43,0) 52%)",
                      // dramatic vignette darkening the edges
                      "radial-gradient(130% 120% at 50% 42%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.55) 74%, rgba(0,0,0,0.9) 100%)",
                    ].join(", "),
                    backgroundAttachment: "fixed",
                  }
            }
          >
            {localSettings.backgroundImage && <div className="fixed inset-0 bg-black/40 pointer-events-none" />}
            {/* Pronounced embossed leather-grain overlay: SVG diffuse-lighting produces
                strong, clearly visible grain with real highlights and shadows for a
                tactile 3D finish. Sits behind content (z-0) so text stays perfectly sharp. */}
            {!localSettings.backgroundImage && (
              <div
                aria-hidden="true"
                className="fixed inset-0 pointer-events-none z-0 opacity-[0.4] mix-blend-overlay"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='280' height='280'%3E%3Cfilter id='leather'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.045 0.06' numOctaves='4' seed='11' stitchTiles='stitch' result='n'/%3E%3CfeDiffuseLighting in='n' lighting-color='%23ffffff' surfaceScale='5' diffuseConstant='1.25'%3E%3CfeDistantLight azimuth='235' elevation='48'/%3E%3C/feDiffuseLighting%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23leather)'/%3E%3C/svg%3E\")",
                  backgroundSize: "280px 280px",
                }}
              />
            )}
            <header className="border-b border-border bg-card/95 backdrop-blur sticky top-0 z-50 shadow-sm">
              <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex-1">
                  <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent drop-shadow-md truncate">
                    {localSettings.title}
                  </h1>
                  <p className="text-foreground text-xs sm:text-sm mt-2 font-semibold tracking-wide truncate">{localSettings.subtitle}</p>
                </div>
                <div className="flex gap-2 sm:gap-4 flex-wrap items-center w-full sm:w-auto justify-end">
                  {/* Table selector - only shows when admin has configured tables */}
                  {!storeSettingsLoading && tableNumbers.length > 0 && tableMounted && (
                    <TableSelector
                      tables={tableNumbers}
                      currentTable={selectedTable}
                      onTableSelect={handleTableSwitchRequest}
                    />
                  )}
                  <LanguageSelector value={language} onChange={setLanguage} />
                  <CurrencySelector value={currency} onChange={setCurrency} />
                  <button
                    onClick={() => router.push("/admin/login")}
                    className="text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded border border-muted-foreground text-muted-foreground hover:bg-muted hover:text-foreground transition-colors whitespace-nowrap"
  title={headerT.adminLogin}
  >
  {headerT.admin}
  </button>
                </div>
              </div>
            </header>
            <MenuDisplay
              categories={categories}
              menuItems={menuItemsToShow}
              setCategories={setCategories}
              onAddToCart={handleAddToCart}
              onClearCart={() => commitCart(tableKey, [])}
              isLoading={realtimeLoading}
              selectedTable={selectedTable}
              onSessionReset={handleSessionReset}
              onRequestTableSelection={handleRequestTableSelection}
            />
            <TableSwitchConfirmationPopup
              isOpen={pendingTable !== null}
              currentTable={selectedTable}
              targetTable={pendingTable}
              language={language}
              onConfirm={() => {
                if (pendingTable) selectTable(pendingTable)
                setPendingTable(null)
              }}
              onCancel={() => setPendingTable(null)}
            />
          </main>
        </CartContext.Provider>
      </CurrencyContext.Provider>
    </LanguageContext.Provider>
  )
}
