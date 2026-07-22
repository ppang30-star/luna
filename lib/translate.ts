// Auto-translation helpers for menu content.
//
// Admins only enter Korean (name + description). On save we translate the Korean
// source into EN / JP / CN / VN and persist the full multi-language set to the DB.
// Every function degrades gracefully: if translation fails, the Korean source is
// used as a fallback so a save can never crash or block.

export type LangCode = "en" | "ja" | "zh" | "vi" | "es"

// Languages we auto-translate the Korean source into for stored menu columns.
// (es is intentionally excluded here — menu items keep es for DB compatibility,
// but the render-time option-group translator may still target es on demand.)
export const AUTO_TRANSLATE_TARGETS: LangCode[] = ["en", "ja", "zh", "vi"]

/**
 * Backward compatibility: a legacy description may be a plain string instead of a
 * multi-language object. Normalize it into an object keyed by language.
 * - Plain string  -> treated as the Korean (ko) value.
 * - JSON-object string (e.g. '{"ko":"...","en":"..."}') -> parsed into an object.
 * - Object         -> returned as-is.
 * This guarantees the app never crashes on old data.
 */
export function normalizeDescription(desc: unknown): Record<string, string> {
  if (!desc) return { ko: "" }

  if (typeof desc === "string") {
    const trimmed = desc.trim()
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed && typeof parsed === "object") return parsed as Record<string, string>
      } catch {
        // Not valid JSON — fall through and treat as a plain Korean string.
      }
    }
    return { ko: desc }
  }

  if (typeof desc === "object") return desc as Record<string, string>
  return { ko: String(desc) }
}

/**
 * Translate a single string via the server route. Returns the source text on any error.
 */
export async function translateText(text: string, target: LangCode, source = "ko"): Promise<string> {
  const clean = (text || "").trim()
  if (!clean) return ""
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean, source, targets: [target] }),
    })
    if (!res.ok) return clean
    const json = await res.json()
    return json?.translations?.[target] || clean
  } catch {
    return clean
  }
}

/**
 * Given a menu-item form object with Korean fields (nameKo / descKo), auto-translate
 * into EN/JP/CN/VN and return a new object with every language field populated.
 *
 * Used for both new items and legacy migration: on edit, the old Korean value is
 * re-translated and the fresh multi-language set overwrites the previous data.
 */
export async function autoTranslateMenuFields<T extends Record<string, any>>(item: T): Promise<T> {
  const nameKo = (item.nameKo || "").trim()
  const descKo = (item.descKo || "").trim()

  const result: Record<string, any> = { ...item }

  // Nothing translatable — keep whatever was provided.
  if (!nameKo && !descKo) return result as T

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "ko",
        targets: AUTO_TRANSLATE_TARGETS,
        fields: { name: nameKo, desc: descKo },
      }),
    })

    if (!res.ok) throw new Error(`translate route HTTP ${res.status}`)

    const json = await res.json()
    const name = json?.fields?.name || {}
    const desc = json?.fields?.desc || {}

    result.nameEn = name.en || nameKo
    result.nameJa = name.ja || nameKo
    result.nameZh = name.zh || nameKo
    result.nameVi = name.vi || nameKo

    result.descEn = desc.en || descKo
    result.descJa = desc.ja || descKo
    result.descZh = desc.zh || descKo
    result.descVi = desc.vi || descKo
  } catch (err) {
    console.log("[v0] autoTranslateMenuFields fell back to Korean source:", err)
    result.nameEn = result.nameEn || nameKo
    result.nameJa = result.nameJa || nameKo
    result.nameZh = result.nameZh || nameKo
    result.nameVi = result.nameVi || nameKo
    result.descEn = result.descEn || descKo
    result.descJa = result.descJa || descKo
    result.descZh = result.descZh || descKo
    result.descVi = result.descVi || descKo
  }

  // Keep es/th columns valid (not shown to customers, kept for DB compatibility).
  result.nameEs = result.nameEs || nameKo
  result.nameTh = result.nameTh || nameKo
  result.descEs = result.descEs || descKo
  result.descTh = result.descTh || descKo

  return result as T
}
