// Utility functions for accessing modifiers from localStorage
// Used by both Admin (ModifierManager) and Client (MenuDisplay) sides

import type { MenuModifier, ModifierOption } from "@/components/admin/modifier-manager"

export const getModifiersLocalStorageKey = (menuItemId: string) => `modifiers_edit_${menuItemId}`

export const loadModifiersFromLocalStorage = (menuItemId: string): MenuModifier[] | null => {
  try {
    const stored = localStorage.getItem(getModifiersLocalStorageKey(menuItemId))
    if (stored) {
      console.log("[v0] Modifiers loaded from localStorage for:", menuItemId)
      return JSON.parse(stored)
    }
  } catch (err) {
    console.error("[v0] Error loading modifiers from localStorage:", err)
  }
  return null
}

export const saveModifiersToLocalStorage = (menuItemId: string, modifiers: MenuModifier[]) => {
  try {
    localStorage.setItem(getModifiersLocalStorageKey(menuItemId), JSON.stringify(modifiers))
    console.log("[v0] Modifiers saved to localStorage for:", menuItemId)
  } catch (err) {
    console.error("[v0] Error saving modifiers to localStorage:", err)
  }
}
