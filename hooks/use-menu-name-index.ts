"use client"

import { useEffect, useState } from "react"
import {
  EMPTY_MENU_NAME_INDEX,
  fetchMenuNameIndex,
  type MenuNameIndex,
} from "@/lib/item-name-localization"

// Module-level cache so the catalog is fetched once per page session even if
// several components (cart popup, bill modal, receipt preview) ask for it.
let cachedIndex: MenuNameIndex | null = null
let inFlight: Promise<MenuNameIndex> | null = null

function loadMenuNameIndex(): Promise<MenuNameIndex> {
  if (cachedIndex) return Promise.resolve(cachedIndex)
  if (!inFlight) {
    inFlight = fetchMenuNameIndex()
      .then((index) => {
        cachedIndex = index
        return index
      })
      .finally(() => {
        inFlight = null
      })
  }
  return inFlight
}

/**
 * Live menu catalog indexed for name localization.
 *
 * Receipts freeze item names as plain strings at order time, so re-localizing
 * them later requires the current catalog. `enabled` lets callers defer the
 * fetch until a modal actually opens.
 */
export function useMenuNameIndex(enabled = true): MenuNameIndex {
  const [index, setIndex] = useState<MenuNameIndex>(cachedIndex ?? EMPTY_MENU_NAME_INDEX)

  useEffect(() => {
    if (!enabled) return
    let active = true
    loadMenuNameIndex().then((next) => {
      if (active) setIndex(next)
    })
    return () => {
      active = false
    }
  }, [enabled])

  return index
}
