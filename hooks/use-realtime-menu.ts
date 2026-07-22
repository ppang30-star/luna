"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { normalizeDescription } from "@/lib/translate"

export interface Category {
  id: string
  ko: string
  en: string
  ja: string
  zh: string
  es: string
  th: string
  vi: string
  sort_order: number
  is_visible: boolean
}

export interface MenuItem {
  id: string
  category: string
  name_ko: string
  name_en: string
  name_ja: string
  name_zh: string
  name_es: string
  name_th: string
  name_vi: string
  desc_ko: string
  desc_en: string
  desc_ja: string
  desc_zh: string
  desc_es: string
  desc_th: string
  desc_vi: string
  price_krw: number
  price_currency: string
  price_amount: number
  image: string
  sort_order: number
  // Modifiers (e.g. Staff list) are stored as a JSONB array on the menu item so
  // they sync across all devices via Supabase instead of living in localStorage.
  modifiers: any[]
  updated_at?: string
  can_adjust?: boolean
  // Combo menu support: flag + linked option group ids (JSONB). Mirrors the
  // modifiers pattern so combos sync across every device via Supabase.
  is_combo?: boolean
  combo_option_group_ids?: any[]
}

// Convert DB format to app format for categories
function dbCategoryToApp(dbCat: Category) {
  return {
    id: dbCat.id,
    ko: dbCat.ko,
    en: dbCat.en,
    ja: dbCat.ja,
    zh: dbCat.zh,
    es: dbCat.es,
    th: dbCat.th,
    vi: dbCat.vi,
    // Default to visible unless explicitly set to false
    isVisible: dbCat.is_visible !== false,
  }
}

// Convert DB format to app format for menu items
function dbMenuItemToApp(dbItem: MenuItem) {
  try {
    if (!dbItem) return null
    
    const priceKRW = typeof dbItem.price_krw === 'number' && !isNaN(dbItem.price_krw) ? dbItem.price_krw : 0
    const priceAmount = typeof dbItem.price_amount === 'number' && !isNaN(dbItem.price_amount) ? dbItem.price_amount : priceKRW

    // Backward compatibility: legacy rows may store the description as a plain string
    // (or JSON-object string) in desc_ko while the other desc_* columns are empty.
    // normalizeDescription turns any shape into a language object; empty per-language
    // columns then gracefully fall back to the Korean value.
    const legacyDesc = normalizeDescription((dbItem as any).description ?? dbItem.desc_ko)
    // True when desc_ko holds a JSON object string rather than plain Korean text.
    const descKoIsObject =
      typeof dbItem.desc_ko === "string" && dbItem.desc_ko.trim().startsWith("{")
    
    const appItem = {
      id: dbItem.id || "",
      category: dbItem.category || "",
      nameKo: dbItem.name_ko || "",
      nameEn: dbItem.name_en || "",
      nameJa: dbItem.name_ja || "",
      nameZh: dbItem.name_zh || "",
      nameEs: dbItem.name_es || "",
      nameTh: dbItem.name_th || "",
      nameVi: dbItem.name_vi || "",
      descKo: (descKoIsObject ? legacyDesc.ko : dbItem.desc_ko) || legacyDesc.ko || "",
      descEn: dbItem.desc_en || legacyDesc.en || "",
      descJa: dbItem.desc_ja || legacyDesc.ja || "",
      descZh: dbItem.desc_zh || legacyDesc.zh || "",
      descEs: dbItem.desc_es || legacyDesc.es || "",
      descTh: dbItem.desc_th || legacyDesc.th || "",
      descVi: dbItem.desc_vi || legacyDesc.vi || "",
      priceKRW: priceKRW,
      priceCurrency: dbItem.price_currency || "KRW",
      priceAmount: priceAmount,
      // Images are large base64 blobs in the DB, so they are NOT fetched in the
      // list query. Instead, point to the per-item image route which streams the
      // decoded image on demand. Add a cache buster query param based on updated_at
      // so UI updates immediately after image changes in DB (prevents stale browser cache).
      image: dbItem.id ? `/api/menu/image/${dbItem.id}?t=${dbItem.updated_at || Date.now()}` : "",
      can_adjust_price: Boolean(dbItem.can_adjust),
      // Modifiers come straight from the JSONB column. Default to an empty array so
      // the client always receives the same shape it previously got from localStorage.
      modifiers: Array.isArray((dbItem as any).modifiers) ? (dbItem as any).modifiers : [],
      // Combo menu fields: is_combo flag + linked global option group ids.
      isCombo: Boolean((dbItem as any).is_combo),
      comboOptionGroupIds: Array.isArray((dbItem as any).combo_option_group_ids)
        ? (dbItem as any).combo_option_group_ids
        : [],
    }
    
    return appItem
  } catch (err) {
    console.error("[v0] Error converting dbMenuItemToApp:", err, dbItem)
    return null
  }
}

// Convert app format to DB format for categories
export function appCategoryToDb(appCat: any, sortOrder: number = 0) {
  return {
    id: appCat.id,
    ko: appCat.ko || "",
    en: appCat.en || "",
    ja: appCat.ja || "",
    zh: appCat.zh || "",
    es: appCat.es || "",
    th: appCat.th || "",
    vi: appCat.vi || "",
    sort_order: sortOrder,
    // Default to visible unless explicitly set to false
    is_visible: appCat.isVisible !== false,
  }
}

// Convert app format to DB format for menu items
export function appMenuItemToDb(appItem: any, sortOrder: number = 0) {
  // CRITICAL: Only include the image if it's a base64-encoded string (i.e., a new upload).
  // If editing without a new upload, the form will NOT include a new image, so appItem.image
  // will be undefined/empty, and we must NOT overwrite the existing database image.
  // This is handled via the spread operator in the update handler, but we ensure it here too.
  const dbItem = {
    id: appItem.id,
    category: appItem.category,
    name_ko: appItem.nameKo || "",
    name_en: appItem.nameEn || "",
    name_ja: appItem.nameJa || "",
    name_zh: appItem.nameZh || "",
    name_es: appItem.nameEs || "",
    name_th: appItem.nameTh || "",
    name_vi: appItem.nameVi || "",
    desc_ko: appItem.descKo || "",
    desc_en: appItem.descEn || "",
    desc_ja: appItem.descJa || "",
    desc_zh: appItem.descZh || "",
    desc_es: appItem.descEs || "",
    desc_th: appItem.descTh || "",
    desc_vi: appItem.descVi || "",
    price_krw: appItem.priceKRW || 0,
    price_currency: appItem.priceCurrency || "KRW",
    price_amount: appItem.priceAmount || appItem.priceKRW || 0,
    // Only set image if it's a new base64 upload (starts with 'data:' or is a valid base64 string)
    // On edit, if no new image was uploaded, this will be undefined and the spread operator will exclude it
    ...(appItem.image && (appItem.image.startsWith('data:') || appItem.image.startsWith('/9j/')) ? { image: appItem.image } : {}),
    sort_order: sortOrder,
    can_adjust: appItem.can_adjust_price || appItem.can_adjust || false,
    // Only include modifiers when the caller explicitly provides an array. This mirrors
    // the image handling: saves that don't touch modifiers won't overwrite the stored value.
    ...(Array.isArray(appItem.modifiers) ? { modifiers: appItem.modifiers } : {}),
    // Combo menu: persist flag + linked option group ids. Always send the flag; only
    // send the ids array when provided so partial saves never wipe existing links.
    is_combo: appItem.isCombo ?? appItem.is_combo ?? false,
    ...(Array.isArray(appItem.comboOptionGroupIds)
      ? { combo_option_group_ids: appItem.comboOptionGroupIds }
      : {}),
  }
  console.log("[v0] appMenuItemToDb converting:", {
    input_can_adjust_price: appItem.can_adjust_price,
    input_can_adjust: appItem.can_adjust,
    output_can_adjust: dbItem.can_adjust,
    image_included: !!dbItem.image,
    image_preview: appItem.image ? appItem.image.substring(0, 50) : "none"
  })
  return dbItem
}

export function useRealtimeCategories() {
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = useCallback(async () => {
    try {
      setError(null)

      // Fast path: use the browser Supabase client directly (works in preview and
      // in production when NEXT_PUBLIC vars are inlined at build time).
      const supabase = createClient()
      if (supabase) {
        const { data, error: fetchError } = await supabase
          .from("categories")
          .select("*")
          .order("sort_order", { ascending: true })

        if (!fetchError) {
          setCategories((data || []).map(dbCategoryToApp))
          return
        }
        console.error("[v0] Browser client categories error, falling back to API:", fetchError.message)
      }

      // Fallback: server-side API route reads env vars at runtime, so it works in
      // production even if the NEXT_PUBLIC vars were not inlined at build time.
      const res = await fetch("/api/menu", { cache: "no-store" })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json) {
        const msg = json?.error || `HTTP ${res.status}`
        console.error("[v0] Error fetching categories:", msg)
        setError(msg)
        return
      }
      setCategories((json.categories || []).map(dbCategoryToApp))
    } catch (err) {
      console.error("[v0] Exception fetching categories:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let channel: RealtimeChannel | null = null

    fetchCategories()

    try {
      const supabase = createClient()
      
      // If Supabase is not configured, skip realtime subscription
      if (!supabase) {
        console.log("[v0] Supabase not configured, skipping realtime subscription for categories")
        return
      }

      // Set up realtime subscription
      channel = supabase
        .channel("categories-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "categories",
          },
          (payload) => {
            console.log("[v0] Categories realtime update:", payload)
            // Refetch all categories to maintain order
            fetchCategories()
          }
        )
        .subscribe()
    } catch (err) {
      console.error("[v0] Error setting up categories realtime:", err)
    }

    return () => {
      if (channel) {
        try {
          const supabase = createClient()
          supabase?.removeChannel(channel)
        } catch (err) {
          console.error("[v0] Error removing categories channel:", err)
        }
      }
    }
  }, [fetchCategories])

  return { categories, loading, error, refetch: fetchCategories }
}

export function useRealtimeMenuItems() {
  const [menuItems, setMenuItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMenuItems = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fast path: use the browser Supabase client directly (works in preview and
      // in production when NEXT_PUBLIC vars are inlined at build time).
      const supabase = createClient()
      if (supabase) {
        const { data, error: fetchError } = await supabase
          .from("menu_items")
          .select("id,category,name_ko,name_en,name_ja,name_zh,name_es,name_th,name_vi,desc_ko,desc_en,desc_ja,desc_zh,desc_es,desc_th,desc_vi,price_krw,price_currency,price_amount,sort_order,can_adjust,modifiers,is_combo,combo_option_group_ids")
          // Stable ordering: sort_order first, then id as a tiebreaker so items with an
          // identical sort_order keep a consistent position and never reshuffle after an update.
          .order("sort_order", { ascending: true })
          .order("id", { ascending: true })

        if (!fetchError && data) {
          const appItems = (data as any[])
            .map(dbMenuItemToApp)
            .filter((item): item is any => item !== null)
          setMenuItems(appItems)
          return
        }
        if (fetchError) {
          console.error("[v0] Browser client menu items error, falling back to API:", fetchError.message)
        }
      }

      // Fallback: server-side API route (runtime env vars) so production always
      // loads real Supabase data even if NEXT_PUBLIC vars were not inlined.
      const res = await fetch("/api/menu", { cache: "no-store" })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json) {
        const msg = json?.error || `HTTP ${res.status}`
        console.error("[v0] Error fetching menu items:", msg)
        setError(msg)
        setMenuItems([])
        return
      }
      const appItems = (json.menuItems || [])
        .map(dbMenuItemToApp)
        .filter((item: any): item is any => item !== null)
      setMenuItems(appItems)
    } catch (err: any) {
      console.error("[v0] Exception fetching menu items:", err.message || err)
      setError(err instanceof Error ? err.message : "Unknown error")
      setMenuItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let channel: RealtimeChannel | null = null

    fetchMenuItems()

    try {
      const supabase = createClient()
      
      // If Supabase is not configured, skip realtime subscription
      if (!supabase) {
        console.log("[v0] Supabase not configured, skipping realtime subscription for menu items")
        return
      }

      // Set up realtime subscription
      channel = supabase
        .channel("menu-items-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "menu_items",
          },
          (payload) => {
            console.log("[v0] Menu items realtime update:", payload)
            // Refetch all menu items to maintain order
            fetchMenuItems()
          }
        )
        .subscribe()
    } catch (err) {
      console.error("[v0] Error setting up menu items realtime:", err)
    }

    return () => {
      if (channel) {
        try {
          const supabase = createClient()
          supabase?.removeChannel(channel)
        } catch (err) {
          console.error("[v0] Error removing menu items channel:", err)
        }
      }
    }
  }, [fetchMenuItems])

  return { menuItems, loading, error, refetch: fetchMenuItems }
}

// Combined hook for both categories and menu items
export function useRealtimeMenu() {
  const { categories, loading: catLoading, error: catError, refetch: refetchCategories } = useRealtimeCategories()
  const { menuItems, loading: menuLoading, error: menuError, refetch: refetchMenuItems } = useRealtimeMenuItems()

  return {
    categories,
    menuItems,
    loading: catLoading || menuLoading,
    error: catError || menuError,
    refetch: () => {
      refetchCategories()
      refetchMenuItems()
    },
  }
}
