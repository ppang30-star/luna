"use client"

import { useEffect, useState } from "react"
import { translateText, type LangCode } from "@/lib/translate"

// Render-time translation for content that is stored in Korean only (e.g. Combo
// Option Group names like "소주" and Option Item names like "참이슬").
//
// This reuses the EXACT same translation mechanism as the Main Menu — the shared
// translateText() helper backed by the /api/translate route. The difference is
// only WHEN it runs: menu items are pre-translated at save time into stored
// columns, while option groups/items are translated on demand in the User UI.
//
// A module-level cache keyed by `${lang}:${ko}` means each unique Korean string is
// only ever fetched once per language, then reused everywhere (modal + cart).

const cache = new Map<string, string>()

const isTranslatable = (lang: string): lang is LangCode =>
  lang === "en" || lang === "ja" || lang === "zh" || lang === "vi" || lang === "es"

/**
 * Translate a single Korean string into the active UI language.
 * Returns the Korean source immediately (and while loading / on failure), then
 * swaps in the translated text once it resolves.
 */
export function useTranslatedText(koText: string | undefined | null, language: string): string {
  const source = (koText || "").trim()
  const cacheKey = `${language}:${source}`

  const [value, setValue] = useState<string>(() => {
    if (!source || language === "ko") return source
    return cache.get(cacheKey) ?? source
  })

  useEffect(() => {
    // Korean (source language) or empty text needs no translation.
    if (!source || language === "ko" || !isTranslatable(language)) {
      setValue(source)
      return
    }

    const cached = cache.get(cacheKey)
    if (cached !== undefined) {
      setValue(cached)
      return
    }

    let active = true
    // Show the Korean source until the translation resolves.
    setValue(source)
    translateText(source, language as LangCode, "ko").then((translated) => {
      cache.set(cacheKey, translated)
      if (active) setValue(translated)
    })

    return () => {
      active = false
    }
  }, [source, cacheKey, language])

  return value
}
