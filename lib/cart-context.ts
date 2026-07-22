import { createContext } from "react"

export interface SelectedModifier {
  modifierId: string
  modifierGroupName: string
  selectedOption: string
  selectedOptionLabel: string
}

// A sub-item the customer chose for a combo menu (e.g. group "소주" -> "참이슬").
// Only Korean names are stored; the User UI translates them at render time.
export interface ComboSelectedOption {
  groupId: string
  groupName: string // Korean source text
  itemId: string
  itemName: string // Korean source text
  quantity: number
}

export interface CartItem {
  id: string
  // Add a unique key for each item instance (to support duplicate items with different modifiers)
  cartItemKey?: string
  nameKo: string
  nameEn: string
  nameJa: string
  nameZh: string
  nameEs: string
  nameTh: string
  nameVi: string
  priceKRW: number
  priceCurrency: string
  priceAmount: number
  quantity: number
  can_adjust_price?: boolean
  // Store selected modifiers (e.g., staff selection for Lady Charge)
  selectedModifiers?: SelectedModifier[]
  // Combo menu: which sub-items the customer selected, with adjustable quantities.
  comboOptions?: ComboSelectedOption[]
}

export interface CartContextType {
  cart: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (cartItemKey: string) => void
  updateQuantity: (cartItemKey: string, quantity: number) => void
  updatePrice?: (cartItemKey: string, priceAmount: number) => void
  // Adjust the quantity of a single combo sub-item within a cart line.
  updateComboOptionQuantity?: (cartItemKey: string, comboItemId: string, quantity: number) => void
}

export const CartContext = createContext<CartContextType | null>(null)
