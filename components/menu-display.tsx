"use client"

import { useContext, useState, useEffect, useCallback } from "react"
import { LanguageContext, CurrencyContext } from "@/lib/context"
import { translations, type Language } from "@/lib/translations"
import { currencies, type Currency } from "@/lib/currencies"
import { getCustomRates } from "@/lib/custom-exchange-rates"
import { menuData } from "@/lib/menu-data"
import PromotionCarousel from "@/components/promotion-carousel"
import CartPopup from "@/components/cart-popup"
import TableWarningPopup from "@/components/table-warning-popup"
import CartGuardPopup from "@/components/cart-guard-popup"
import { ModifierSelectionModal } from "@/components/modifier-selection-modal"
import { ComboSelectionModal } from "@/components/combo-selection-modal"
import { ShoppingCart } from "lucide-react"
import type { CartItem, SelectedModifier, ComboSelectedOption } from "@/lib/cart-context"
import { useComboOptionGroups } from "@/hooks/use-combo-option-groups"
import { CartContext } from "@/lib/cart-context"
import type { MenuItemData } from "@/lib/menu-data"
import { useExchangeRates } from "@/hooks/use-exchange-rates"
import { loadModifiersFromLocalStorage } from "@/lib/modifier-utils"
import type { MenuModifier } from "@/components/admin/modifier-manager"

interface Category {
  id: string
  ko: string
  en: string
  ja: string
  zh: string
  es: string
  th: string
  vi: string
  isVisible?: boolean
}

interface MenuDisplayProps {
  categories: Category[]
  menuItems?: MenuItemData[]
  setCategories?: (categories: Category[]) => void
  onAddToCart?: (item: MenuItemData) => void
  onClearCart?: () => void
  isLoading?: boolean
  selectedTable?: string | null
  onSessionReset?: () => void
  onRequestTableSelection?: () => void  // 테이블 선택 화면으로 이동
}

export default function MenuDisplay({ categories, menuItems: propMenuItems, setCategories, onAddToCart, onClearCart, isLoading, selectedTable, onSessionReset, onRequestTableSelection }: MenuDisplayProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [localMenuItems, setLocalMenuItems] = useState<MenuItemData[]>([])
  // Modifier selection modal state
  const [showModifierModal, setShowModifierModal] = useState(false)
  const [currentItemForModifiers, setCurrentItemForModifiers] = useState<MenuItemData | null>(null)
  const [currentItemModifiers, setCurrentItemModifiers] = useState<MenuModifier[]>([])
  // Combo selection modal state
  const [showComboModal, setShowComboModal] = useState(false)
  const [currentItemForCombo, setCurrentItemForCombo] = useState<MenuItemData | null>(null)
  
  // Supabase에서 받아온 데이터가 있으면 사용, 없으면 로컬 데이터 사용
  const menuItems = propMenuItems && propMenuItems.length > 0 ? propMenuItems : localMenuItems
  const [exchangeRates, setExchangeRates] = useState<Record<string, number> | null>(null)
  const [customExchangeRates, setCustomExchangeRates] = useState<Record<string, number>>({})
  const [ratesLoading, setRatesLoading] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  
  
  // Table selection warning popup state
  const [showTableWarning, setShowTableWarning] = useState(false)
  
  // Browse Mode state (둘러보기 모드)
  // true = 테이블 선택 없이 메뉴 탐색 가능, 단 장바구니/주문은 불가
  const [isBrowseMode, setIsBrowseMode] = useState(false)
  
  // CRITICAL: 테이블이 선택되면 Browse Mode 자동 해제
  useEffect(() => {
    if (selectedTable) {
      setIsBrowseMode(false)
    }
  }, [selectedTable])
  
  // Cart Guard popup state (둘러보기 모드에서 장바구니 시도시)
  const [showCartGuard, setShowCartGuard] = useState(false)
  
  const language = useContext(LanguageContext) as Language
  const currencyContext = useContext(CurrencyContext)
  const currency = ((currencyContext as string) || "KRW") as Currency
  const cartContext = useContext(CartContext)

  // Global combo option groups (for combo menus).
  const { groups: comboOptionGroups } = useComboOptionGroups()
  
  // 실시간 환율 훅
  const { convertPrice: convertPriceWithRates, formatPrice, loading: ratesLoadingHook } = useExchangeRates()

  // Table selection validation - returns true if table is selected, false otherwise
  // Browse Mode에서는 메뉴 탐색은 허용하지만 장바구니/주문은 차단
  const validateTableSelection = useCallback((): boolean => {
    if (!selectedTable) {
      // Browse Mode가 아니면 테이블 선택 경고 표시
      if (!isBrowseMode) {
        setShowTableWarning(true)
      }
      return false
    }
    return true
  }, [selectedTable, isBrowseMode])

  // Browse Mode에서 장바구니 추가 시도 시 호출
  const validateCartAction = useCallback((): boolean => {
    if (!selectedTable) {
      // 테이블이 선택되지 않은 상태에서 장바구니 시도
      setShowCartGuard(true)
      return false
    }
    return true
  }, [selectedTable])

  // 둘러보기 모드 활성화
  const handleEnterBrowseMode = useCallback(() => {
    setIsBrowseMode(true)
    setShowTableWarning(false)
  }, [])

  // 테이블 선택 요청 (팝업에서 호출)
  const handleRequestTableFromPopup = useCallback(() => {
    setShowTableWarning(false)
    setShowCartGuard(false)
    setIsBrowseMode(false)  // 둘러보기 모드 해제
    if (onRequestTableSelection) {
      onRequestTableSelection()
    }
  }, [onRequestTableSelection])

  useEffect(() => {
    setMounted(true)
    let itemsToUse: MenuItemData[] = []

    console.log("[v0] menuData type:", typeof menuData, "is array:", Array.isArray(menuData))

    const storedMenus = localStorage.getItem("menuItems")
    let storedItems: MenuItemData[] = []

    if (storedMenus) {
      try {
        const parsed = JSON.parse(storedMenus)
        // 배열 형식이면 사용
        if (Array.isArray(parsed)) {
          storedItems = parsed
          console.log("[v0] Loaded stored menus from localStorage:", storedItems.length, "items")
        }
        // 이전 형식(객체)이면 무시하고 초기화
        else if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          console.log("[v0] Clearing old menu object format from localStorage")
          localStorage.removeItem("menuItems")
        }
      } catch (e) {
        console.log("[v0] Could not parse stored menus, using default")
      }
    }

    // 기본 메뉴 데이터 처리
    let defaultItems: MenuItemData[] = []
    if (Array.isArray(menuData)) {
      defaultItems = [...menuData]
    } else if (typeof menuData === "object" && menuData !== null) {
      const values = Object.values(menuData)
      defaultItems = values.filter((item) => {
        return item && typeof item === "object" && "id" in item && "nameKo" in item
      }) as MenuItemData[]
    }

    // 저장된 메뉴 + 기본 메뉴 병합 (저장된 메뉴 우선)
    itemsToUse = [...defaultItems, ...storedItems]

    console.log(
      "[v0] Final menuItems: default=",
      defaultItems.length,
      "+ stored=",
      storedItems.length,
      "= total",
      itemsToUse.length,
    )
    setLocalMenuItems(itemsToUse)
  }, [])

  useEffect(() => {
    const customRates = getCustomRates()
    setCustomExchangeRates(customRates)
  }, [])

  useEffect(() => {
    // 언어 변경 시 강제 재렌더링을 위한 트리거
  }, [language])

  const handleAddToCart = (item: MenuItemData) => {
    console.log("[v0] handleAddToCart called with item:", item.id)
    if (!cartContext) {
      console.log("[v0] cartContext is null!")
      return
    }

    console.log("[v0] Current cart before add:", cartContext.cart)

    // 원본 통화 정보 보존
    const sourceCurrency = item.priceCurrency || "KRW"
    const sourceAmount = item.priceAmount ?? item.priceKRW

    const cartItem: CartItem = {
      id: item.id,
      nameKo: item.nameKo,
      nameEn: item.nameEn,
      nameJa: item.nameJa,
      nameZh: item.nameZh,
      nameEs: item.nameEs,
      nameTh: item.nameTh,
      nameVi: item.nameVi,
      priceKRW: item.priceKRW,
      priceCurrency: sourceCurrency,
      priceAmount: sourceAmount,
      quantity: 1,
      can_adjust_price: item.can_adjust_price,
    }

    console.log("[v0] Adding cart item with currency:", cartItem.priceCurrency, "amount:", cartItem.priceAmount)
    cartContext.addItem(cartItem)
    console.log("[v0] Cart after add:", cartContext.cart)
  }

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (!cartContext) return
    if (quantity <= 0) {
      cartContext.removeItem(id)
    } else {
      cartContext.updateQuantity(id, quantity)
    }
  }

  const handleRemoveFromCart = (id: string) => {
    if (!cartContext) return
    cartContext.removeItem(id)
  }

  const handleUpdatePrice = (id: string, priceAmount: number) => {
    if (!cartContext?.updatePrice) return
    cartContext.updatePrice(id, priceAmount)
  }

  const handleUpdateComboOptionQuantity = (id: string, comboItemId: string, quantity: number) => {
    if (!cartContext?.updateComboOptionQuantity) return
    cartContext.updateComboOptionQuantity(id, comboItemId, quantity)
  }

  const handlePopupAddToCart = () => {
    // Browse Mode 또는 테이블 미선택 시 장바구니 추가 차단
    if (!validateCartAction()) return
    
    if (!selectedMenu) {
      console.log("[v0] selectedMenu is null!")
      return
    }
    console.log("[v0] Add to cart button clicked, selectedMenu:", selectedMenu?.id)

    // CRITICAL: Check if this menu item has required modifiers.
    // Modifiers now sync via Supabase (menu_items.modifiers JSONB), so read them straight
    // off the selected item. Fall back to the localStorage buffer only if the item didn't
    // carry any (e.g. offline/legacy). The resulting shape is identical to before, so the
    // modifier modal and cart aggregation continue to work exactly as-is.
    const modifiers =
      Array.isArray((selectedMenu as any).modifiers) && (selectedMenu as any).modifiers.length > 0
        ? (selectedMenu as any).modifiers
        : loadModifiersFromLocalStorage(selectedMenu.id)
    console.log("[v0] Modifiers for item (synced from Supabase):", modifiers)
    
    if (modifiers && modifiers.length > 0) {
      // Show modifier selection modal instead of adding directly to cart
      console.log("[v0] Showing modifier modal for item:", selectedMenu.nameKo)
      setCurrentItemForModifiers(selectedMenu)
      setCurrentItemModifiers(modifiers)
      setShowModifierModal(true)
      return
    }

    // Combo menu: if this item is a combo with linked option groups, prompt the
    // customer to choose their options before adding to the cart.
    const isCombo = Boolean((selectedMenu as any).isCombo)
    const linkedGroupIds: string[] = Array.isArray((selectedMenu as any).comboOptionGroupIds)
      ? (selectedMenu as any).comboOptionGroupIds
      : []
    const linkedGroups = comboOptionGroups.filter((g) => linkedGroupIds.includes(g.id))
    if (isCombo && linkedGroups.length > 0) {
      console.log("[v0] Showing combo modal for item:", selectedMenu.nameKo)
      setCurrentItemForCombo(selectedMenu)
      setShowComboModal(true)
      return
    }

    // No modifiers required, add directly to cart
    if (onAddToCart) {
      console.log("[v0] No modifiers - adding item directly to cart:", selectedMenu.nameKo)
      onAddToCart({
        ...selectedMenu,
        quantity: 1,
      })
      console.log("[v0] Item added to cart successfully")
    } else {
      console.log("[v0] onAddToCart function not available!")
    }
    setSelectedMenuId(null)
  }

  if (!mounted) return null

  const t = translations[language]
  const currencyInfo = currencies[currency as keyof typeof currencies] || currencies.KRW
  const rate = customExchangeRates[currency] || exchangeRates?.[currency] || currencyInfo.rate

  const getLanguageKey = (lang: Language): string => {
    const keyMap: Record<Language, string> = {
      ko: "Ko",
      en: "En",
      ja: "Ja",
      zh: "Zh",
      es: "Es",
      th: "Th",
      vi: "Vi",
    }
    return keyMap[lang]
  }

  const getCategoryName = (category: Category): string => {
    // 1) Use the category's own translated field for the active language when present.
    //    (Categories may not carry every language — e.g. Hindi is not stored on the object.)
    const direct = (category as unknown as Record<string, string | undefined>)[language]
    if (direct && direct.trim()) return direct

    // 2) Fall back to the shared translation dictionary keyed by category id.
    //    Category ids are plural (e.g. "spirits") while the dictionary uses singular
    //    keys (e.g. "spirit"), so normalize by stripping a trailing "s".
    const dictKey = category.id.replace(/s$/, "") as keyof typeof t.categories
    const dictName = t.categories?.[dictKey]
    if (dictName) return dictName

    // 3) Last resort: Korean, then English.
    return category.ko || category.en || ""
  }

  const getMenuName = (item: MenuItemData | null | undefined): string => {
    if (!item) return "메뉴명 없음"
    const nameKey = `name${getLanguageKey(language)}` as keyof MenuItemData
    const menuName = item[nameKey] as unknown as string
    if (menuName) return menuName
    return item?.nameKo || "메뉴명 없음"
  }

  const getMenuDescription = (item: MenuItemData | null | undefined): string => {
    if (!item) return ""
    const descKey = `desc${getLanguageKey(language)}` as keyof MenuItemData
    const menuDesc = item[descKey] as unknown as string
    if (menuDesc) return menuDesc
    return item?.descKo || ""
  }

  const selectedMenu = selectedMenuId ? menuItems.find((item) => item.id === selectedMenuId) : null
  

  const selectedCategory = selectedCategoryId ? categories.find((cat) => cat.id === selectedCategoryId) : null
  const selectedCategoryItems = selectedCategoryId
    ? menuItems.filter((item) => item.category === selectedCategoryId)
    : []

  // Customers only see categories that are marked visible (default: visible)
  const visibleCategories = categories.filter((cat) => cat.isVisible !== false)

// 가격 변환 함수 - 원본 통화 우선, 필요시에만 환율 변환
  const convertPrice = (priceAmount: number | null | undefined, sourceCurrency?: string | null): string => {
    const price = typeof priceAmount === 'number' && !isNaN(priceAmount) ? priceAmount : 0
    const targetCurrency = currency || "KRW"
    const safeSourceCurrency = sourceCurrency || "KRW"
    
    // 원본 통화와 표시 통화가 같으면 환율 변환 없이 그대로 표시
    if (safeSourceCurrency === targetCurrency) {
      return formatPrice(price, targetCurrency)
    }
    
    // 다를 경우에만 실시간 환율로 변환
    const convertedPrice = convertPriceWithRates(price, safeSourceCurrency, targetCurrency)
    const safeConvertedPrice = typeof convertedPrice === 'number' && !isNaN(convertedPrice) ? convertedPrice : 0
    return formatPrice(safeConvertedPrice, targetCurrency)
  }
  
  const goHome = () => {
    setSelectedCategoryId(null)
    setSelectedMenuId(null)
  }

  return (
    <>
      <CartPopup
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cartContext?.cart || []}
        onUpdateQuantity={handleUpdateQuantity}
        onRemove={handleRemoveFromCart}
        onUpdatePrice={handleUpdatePrice}
        onUpdateComboOptionQuantity={handleUpdateComboOptionQuantity}
        onClearCart={onClearCart}
        selectedTable={selectedTable}
        onSessionReset={onSessionReset}
      />

      {/* Table Selection Warning Popup - 두 버튼: 테이블 선택 / 둘러보기 */}
      <TableWarningPopup
        isOpen={showTableWarning}
        onClose={() => setShowTableWarning(false)}
        onSelectTable={handleRequestTableFromPopup}
        onBrowseMode={handleEnterBrowseMode}
        language={language}
      />

      {/* Cart Guard Popup - 둘러보기 모드에서 장바구니 ��도 시 */}
      <CartGuardPopup
        isOpen={showCartGuard}
        onClose={() => setShowCartGuard(false)}
        onSelectTable={handleRequestTableFromPopup}
        language={language}
      />

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 relative z-10">
        {/* 페이지 제목 */}

        {/* 홈 버튼 */}
        {(selectedCategoryId || selectedMenuId) && (
          <button
            onClick={goHome}
            className="text-lg font-bold text-primary mb-4 hover:opacity-80 transition-opacity flex items-center gap-2"
          >
            ← {t.menu || "MENU"}
          </button>
        )}

        <div className="flex justify-between items-center mb-0">
          <div className="flex gap-2 sm:gap-4 flex-wrap justify-start overflow-x-auto pb-2 flex-1">
            {visibleCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  // CRITICAL: 테이블 미선택 + 둘러보기 모드가 아니면 팝업 표시
                  if (!selectedTable && !isBrowseMode) {
                    setShowTableWarning(true)
                    return
                  }
                  setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)
                  setSelectedMenuId(null)
                }}
                className={`text-sm sm:text-lg font-semibold pb-2 border-b-2 transition-colors duration-200 whitespace-nowrap flex-shrink-0 ${
                  selectedCategoryId === cat.id
                    ? "text-primary border-primary"
                    : "text-white border-transparent hover:text-primary"
                }`}
              >
                {getCategoryName(cat)}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            aria-label={t.cart || "장바�������니"}
            style={{ backgroundColor: "#7b1e2b", borderRadius: "8px" }}
            className="ml-3 sm:ml-4 flex-shrink-0 relative flex items-center gap-1.5 px-3 sm:px-3.5 py-2.5 text-white font-semibold shadow-sm transition-colors duration-200 hover:brightness-110 active:brightness-95"
          >
            <ShoppingCart size={16} className="sm:w-[18px] sm:h-[18px]" />
            <span className="text-xs sm:text-sm whitespace-nowrap">{t.cart || "장바구니"}</span>
            {cartContext && cartContext.cart.length > 0 && (
              <span className="ml-0.5 min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-md bg-white/95 text-[#7b1e2b] text-xs font-bold">
                {Number(cartContext.cart.length) || 0}
              </span>
            )}
          </button>
        </div>

        {!selectedCategoryId && !selectedMenuId && (
          <div className="mb-8 sm:mb-12 mt-12 sm:mt-16">
            <PromotionCarousel />
          </div>
        )}

        {selectedCategoryId && selectedCategoryItems.length > 0 && !selectedMenuId && (
          <div className="mb-8 sm:mb-12">
            <h3 className="text-[calc(1.875rem+0.5px)] sm:text-[calc(2.25rem+0.5px)] md:text-[calc(3.75rem+0.5px)] font-extrabold text-primary mb-4 sm:mb-6">
              {selectedCategory && getCategoryName(selectedCategory)}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
              {selectedCategoryItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    // CRITICAL: 테이블 미선택 + 둘러보기 모드가 아니면 팝업 표시
                    if (!selectedTable && !isBrowseMode) {
                      setShowTableWarning(true)
                      return
                    }
                    setSelectedMenuId(item.id)
                  }}
                  className="group relative overflow-hidden rounded-lg border border-primary/20 hover:border-primary transition-all duration-200 hover:shadow-lg"
                >
                  <div className="relative aspect-square bg-muted overflow-hidden flex items-center justify-center">
                    {/* CRITICAL: Images are served via /api/menu/image/[id] with cache buster to ensure
                        UI updates immediately when image changes. Without the ?t param, browser cache
                        would keep showing old "broken image" state even after refetch() updates the DB. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={`${item.id}-${item.image}`}
                      src={item.image}
                      alt={getMenuName(item)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        // Fallback to placeholder if image fails to load
                        const img = e.target as HTMLImageElement
                        img.src = "/placeholder.svg?height=200&width=200&query=menu-item"
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200" />
                  </div>

                  <div className="p-2 sm:p-3 bg-card">
                    <p className="text-xs sm:text-sm font-semibold text-primary line-clamp-2">{getMenuName(item)}</p>
                    {getMenuDescription(item) && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{getMenuDescription(item)}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 font-medium">
                      {convertPrice(item?.priceAmount ?? item?.priceKRW ?? 0, item?.priceCurrency || "KRW")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 메뉴 상세 정보 */}
        {selectedMenu ? (
          <div
            className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
            onClick={() => setSelectedMenuId(null)}
          >
            <div
              className="max-w-2xl w-full max-h-[90vh] bg-card rounded-2xl overflow-hidden border border-primary/30 shadow-xl relative flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedMenuId(null)}
                className="absolute top-4 right-4 z-50 p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Scrollable content area */}
              <div className="flex-1 overflow-y-auto">
                <div className="relative w-full bg-muted overflow-hidden flex items-center justify-center">
                  {/* CRITICAL: Use the image URL with cache buster so detail modal updates immediately */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={`detail-${selectedMenu.id}-${selectedMenu.image}`}
                    src={selectedMenu.image || "/placeholder.svg?height=384&width=600&query=premium-beverage"}
                    alt={getMenuName(selectedMenu)}
                    className="w-full h-auto object-contain"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                </div>

                <div className="p-4 sm:p-6 md:p-8">
                  <h2 className="text-sm sm:text-base md:text-lg font-bold text-primary mb-1">
                    {getMenuName(selectedMenu)}
                  </h2>

                  {getMenuDescription(selectedMenu) && (
                    <p className="text-muted-foreground text-xs mb-2 leading-relaxed line-clamp-2">
                      {getMenuDescription(selectedMenu)}
                    </p>
                  )}

                  <div className="border-t border-border pt-2">
                    <p className="text-muted-foreground text-xs mb-0.5">{t.price || "가격"}</p>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base sm:text-lg md:text-xl font-bold text-primary">
                        {convertPrice(selectedMenu?.priceAmount ?? selectedMenu?.priceKRW ?? 0, selectedMenu?.priceCurrency || "KRW")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky footer with buttons */}
              <div className="flex-shrink-0 p-4 sm:p-6 md:p-8 pt-0 bg-card border-t border-border">
                <div className="flex gap-2">
                  <button
                    onClick={handlePopupAddToCart}
                    type="button"
                    className="flex-1 py-1.5 px-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 hover:opacity-80 active:bg-primary/80 active:scale-95 transition-all duration-150 z-50 relative cursor-pointer"
                  >
                    {t.addToCart || "메뉴 담기"}
                  </button>
                </div>

                <button
                  onClick={() => setSelectedMenuId(null)}
                  className="mt-1.5 w-full py-1 rounded-md bg-muted hover:bg-muted/80 text-xs font-semibold transition-colors"
                >
                  {t.close || "닫기"}
                </button>
              </div>
            </div>
          </div>
        ) : selectedCategoryId && selectedCategoryItems.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 sm:py-16">
            <p className="text-base sm:text-lg">{t.noMenus || "이 카테고리에 메뉴가 없습니다"}</p>
          </div>
        ) : null}

      </div>

      {/* Modifier Selection Modal */}
      {currentItemForModifiers && (
        <ModifierSelectionModal
          isOpen={showModifierModal}
          modifiers={currentItemModifiers}
          itemName={currentItemForModifiers.nameKo}
          language={language}
          onConfirm={(selectedModifiersState) => {
            // CUSTOM BYPASS LOGIC: Items with modifiers use different cart logic than normal items
            // For items like "Lady Charge" with Staff selection, we MUST loop and call addToCart separately
            // This creates truly independent cart items, not merged quantities

            if (!onAddToCart || !currentItemForModifiers) {
              setShowModifierModal(false)
              return
            }

            // STEP 1 — EXTRACT ARRAY: flatten EVERY selected option across ALL modifier
            // groups into a single structured array. Each entry carries its own group/label
            // info so the loop below never has to guess which group an option belongs to.
            const selectedSelections: {
              modifierId: string
              modifierGroupName: string
              optionValue: string      // e.g. "Luna"
              optionLabel: string      // e.g. "루나"
            }[] = []

            for (const modifierId in selectedModifiersState) {
              const selectedOptionIds = selectedModifiersState[modifierId]
              const modifier = currentItemModifiers.find((m) => m.id === modifierId)
              if (!modifier || selectedOptionIds.size === 0) continue

              for (const optionId of selectedOptionIds) {
                const option = modifier.modifier_options.find((opt) => opt.id === optionId)
                if (option) {
                  selectedSelections.push({
                    modifierId,
                    modifierGroupName: modifier.group_name_ko || "",
                    optionValue: option.option_value,
                    optionLabel: option.option_label_ko,
                  })
                }
              }
            }

            console.log(
              "[v0] Modal confirmation with selected modifiers:",
              selectedSelections.map((s) => s.optionValue),
            )

            // A combo menu must become ONE single cart row whose selected drinks are
            // nested sub-items (comboOptions), NOT one row per selection. Staff-style
            // items (e.g. "Lady Charge") keep the legacy behaviour of one row per pick.
            const isComboItem =
              Boolean((currentItemForModifiers as any).isCombo) ||
              (currentItemForModifiers as any).category === "combo"

            if (isComboItem) {
              // STEP 2A — SINGLE COMBO ROW: map every selection into a comboOptions entry.
              // Sub-items carry a quantity (adjustable in the cart) but NO price, so the
              // cart total is driven solely by the main combo price × main combo qty.
              const comboOptions: ComboSelectedOption[] = selectedSelections.map((selection) => ({
                groupId: selection.modifierId,
                groupName: selection.modifierGroupName, // Korean source; translated at render
                itemId: selection.optionValue,
                itemName: selection.optionLabel, // Korean source; translated at render
                quantity: 1,
              }))

              const optionKey = comboOptions.map((o) => `${o.groupId}.${o.itemId}`).join("_")
              const cartItemKey = `${currentItemForModifiers.id}-combo-${optionKey || Date.now()}`

              console.log(
                `[v0] Adding combo "${currentItemForModifiers.nameKo}" as ONE row with ${comboOptions.length} sub-items (key: ${cartItemKey})`,
              )

              onAddToCart({
                ...currentItemForModifiers,
                quantity: 1,
                cartItemKey,
                priceAmount: currentItemForModifiers.priceAmount,
                comboOptions,
              } as any)
            } else if (selectedSelections.length > 0) {
              // STEP 2B — CONDITIONAL BYPASS (staff selection): one addToCart call per pick
              // so each selected staff member becomes a truly independent, full-price row.
              selectedSelections.forEach((selection, index) => {
                // STEP 3 — UNIQUE KEYS: append the modifier value to the menu id so the cart
                // state treats each row as completely separate and never merges them back.
                const cartItemId = `${currentItemForModifiers.id}-${selection.optionValue}`

                console.log(
                  `[v0] Loop iteration ${index + 1}/${selectedSelections.length}: Adding "${currentItemForModifiers.nameKo}" with ${selection.optionValue} (key: ${cartItemId})`,
                )

                onAddToCart({
                  ...currentItemForModifiers,
                  quantity: 1,
                  cartItemKey: cartItemId, // UNIQUE per modifier value (e.g. Qty 1, Price 300k each)
                  priceAmount: currentItemForModifiers.priceAmount, // each pays full price
                  selectedModifiers: [
                    {
                      modifierId: selection.modifierId,
                      modifierGroupName: selection.modifierGroupName,
                      selectedOption: selection.optionValue,
                      selectedOptionLabel: selection.optionLabel,
                    },
                  ],
                })
              })
            }

            setShowModifierModal(false)
            setCurrentItemForModifiers(null)
            setCurrentItemModifiers([])
            setSelectedMenuId(null)
          }}
          onCancel={() => {
            setShowModifierModal(false)
            setCurrentItemForModifiers(null)
            setCurrentItemModifiers([])
          }}
        />
      )}

      {/* Combo Selection Modal */}
      {currentItemForCombo && (
        <ComboSelectionModal
          isOpen={showComboModal}
          itemName={currentItemForCombo.nameKo}
          groups={comboOptionGroups.filter((g) =>
            (Array.isArray((currentItemForCombo as any).comboOptionGroupIds)
              ? (currentItemForCombo as any).comboOptionGroupIds
              : []
            ).includes(g.id),
          )}
          language={language}
          onConfirm={(selectedOptions: ComboSelectedOption[]) => {
            if (!onAddToCart || !currentItemForCombo) {
              setShowComboModal(false)
              return
            }
            // A combo with distinct selections should be its own cart row. Build a
            // unique key from the selected sub-item ids so different selections of
            // the same combo don't merge together.
            const optionKey = selectedOptions.map((o) => `${o.groupId}.${o.itemId}`).join("_")
            const cartItemKey = `${currentItemForCombo.id}-combo-${optionKey || Date.now()}`
            onAddToCart({
              ...currentItemForCombo,
              quantity: 1,
              cartItemKey,
              comboOptions: selectedOptions,
            } as any)
            setShowComboModal(false)
            setCurrentItemForCombo(null)
            setSelectedMenuId(null)
          }}
          onCancel={() => {
            setShowComboModal(false)
            setCurrentItemForCombo(null)
          }}
        />
      )}
    </>
  )
}
