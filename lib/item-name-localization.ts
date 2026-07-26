// Shared helpers for showing ordered item names in the ACTIVE admin language
// instead of the language they happened to be saved in at order time.
//
// Order history freezes names as plain strings (often Korean). To re-localize we
// look the item up in the live menu catalog and pick the active language, so the
// same record reads correctly for a Korean, English or Vietnamese manager.

import type { AdminLanguage } from "@/lib/admin-translations"

/** One localized name set for a single menu item, keyed by AdminLanguage. */
export type LocalizedName = Partial<Record<AdminLanguage, string>>

/**
 * Any language a name may be requested in. Receipts support a few languages the
 * admin UI does not (e.g. "hi"), and those have no catalog column — they are
 * accepted here and resolved through the English/Korean fallback chain.
 */
export type NameLanguage = AdminLanguage | (string & {})

/** menu_items column (snake_case, as returned by /api/menu) per admin language. */
export const MENU_NAME_COLUMN: Record<AdminLanguage, string> = {
  ko: "name_ko",
  en: "name_en",
  ja: "name_ja",
  zh: "name_zh",
  es: "name_es",
  th: "name_th",
  vi: "name_vi",
}

/**
 * Inline camelCase field on a saved sales item per admin language. Used when the
 * menu item is no longer in the catalog (e.g. the menu was deleted).
 */
export const ITEM_NAME_FIELD: Record<AdminLanguage, string> = {
  ko: "nameKo",
  en: "nameEn",
  ja: "nameJa",
  zh: "nameZh",
  es: "nameEs",
  th: "nameTh",
  vi: "nameVi",
}

/** Two lookup paths into the catalog: by menu id, and by any known name. */
export interface MenuNameIndex {
  byId: Record<string, LocalizedName>
  byName: Record<string, LocalizedName>
}

export const EMPTY_MENU_NAME_INDEX: MenuNameIndex = { byId: {}, byName: {} }

/** Normalize a name so it can be used as a case/spacing-insensitive lookup key. */
export function normalizeNameKey(value?: string | null): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim()
}

/**
 * Choose the best available name: active language -> English -> Korean -> any
 * other non-empty entry.
 */
export function pickLocalized(
  names: LocalizedName | undefined,
  language: NameLanguage,
): string | undefined {
  if (!names) return undefined
  // Receipt-only languages (e.g. Hindi) have no menu catalog column, so the
  // requested key is simply absent and we fall through to English/Korean.
  const requested = (names as Record<string, string | undefined>)[language]
  const candidates = [requested, names.en, names.ko, ...Object.values(names)]
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate
  }
  return undefined
}

/**
 * Build the lookup index from raw /api/menu items. Exposed separately so callers
 * that already fetched the catalog (for categories, etc.) can reuse one response.
 */
export function buildMenuNameIndex(items: any[]): MenuNameIndex {
  const byId: Record<string, LocalizedName> = {}
  const byName: Record<string, LocalizedName> = {}

  for (const item of items ?? []) {
    if (item?.id == null) continue
    const names: LocalizedName = {}
    for (const lang of Object.keys(MENU_NAME_COLUMN) as AdminLanguage[]) {
      const value = item[MENU_NAME_COLUMN[lang]]
      if (typeof value === "string" && value.trim()) names[lang] = value
    }
    byId[String(item.id)] = names

    // Index every known spelling so rows that only stored a display string
    // (e.g. combo option lines) can still be matched back to the catalog.
    for (const value of Object.values(names)) {
      const key = normalizeNameKey(value)
      if (key && !byName[key]) byName[key] = names
    }
  }

  return { byId, byName }
}

/**
 * Fetch the menu catalog and index it for name localization.
 *
 * Uses the runtime /api/menu route (not the build-time NEXT_PUBLIC_* browser
 * client) so it keeps working when those build vars are missing or stale.
 */
export async function fetchMenuNameIndex(): Promise<MenuNameIndex> {
  try {
    const res = await fetch("/api/menu", { cache: "no-store" })
    if (!res.ok) {
      console.error("[v0] Failed to fetch menu catalog for name localization:", res.status)
      return EMPTY_MENU_NAME_INDEX
    }
    const body = await res.json().catch(() => ({}))
    return buildMenuNameIndex(body?.menuItems ?? [])
  } catch (err) {
    console.error("[v0] Menu catalog fetch error:", err)
    return EMPTY_MENU_NAME_INDEX
  }
}

/** Collect inline per-language name fields off a saved record. */
export function collectInlineNames(
  source: Record<string, any> | null | undefined,
  fieldMap: Record<AdminLanguage, string> = ITEM_NAME_FIELD,
): LocalizedName {
  const names: LocalizedName = {}
  if (!source) return names
  for (const lang of Object.keys(fieldMap) as AdminLanguage[]) {
    const value = source[fieldMap[lang]]
    if (typeof value === "string" && value.trim()) names[lang] = value
  }
  return names
}

/**
 * Resolve a saved order item to a name in the active admin language.
 *
 * Priority: embedded translation object -> live catalog by menu id -> live
 * catalog by name -> inline per-language fields -> plain string name.
 * Every step falls back active language -> English -> Korean.
 */
export function resolveOrderItemName(
  item: Record<string, any> | null | undefined,
  language: NameLanguage,
  index: MenuNameIndex,
  options: { menuIdKey?: string; fieldMap?: Record<AdminLanguage, string> } = {},
): string {
  if (!item) return ""
  const { menuIdKey = "menuId", fieldMap = ITEM_NAME_FIELD } = options

  // 1) The record already stores a translation object: { ko, en, vi, ... }
  if (item.name && typeof item.name === "object") {
    const fromObject = pickLocalized(item.name as LocalizedName, language)
    if (fromObject) return fromObject
  }

  // 2) Look the item up in the live catalog by its menu id.
  const menuId = item[menuIdKey]
  if (menuId != null) {
    const fromCatalog = pickLocalized(index.byId[String(menuId)], language)
    if (fromCatalog) return fromCatalog
  }

  // 3) Fall back to the record's own per-language fields...
  const inline = collectInlineNames(item, fieldMap)

  // ...but first try matching those saved spellings against the catalog, so a
  // frozen string still resolves even without a usable menu id.
  for (const value of Object.values(inline)) {
    const fromName = pickLocalized(index.byName[normalizeNameKey(value)], language)
    if (fromName) return fromName
  }

  const fromInline = pickLocalized(inline, language)
  if (fromInline) return fromInline

  // 4) Last resort: a plain string name, if present.
  return typeof item.name === "string" ? item.name : ""
}
