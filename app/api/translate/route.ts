import { NextResponse } from "next/server"

// Server-side auto-translation. Uses Google's public (key-less) translate endpoint,
// which handles Korean well. Every failure degrades to the source text so the caller
// can always fall back gracefully instead of erroring.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ENDPOINT = "https://translate.googleapis.com/translate_a/single"

async function translateOne(text: string, source: string, target: string): Promise<string> {
  const clean = (text || "").trim()
  if (!clean) return ""
  if (source === target) return clean

  try {
    const url =
      `${ENDPOINT}?client=gtx&sl=${encodeURIComponent(source)}` +
      `&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(clean)}`

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    })
    if (!res.ok) return clean

    const data = await res.json()
    // data[0] is an array of segments: [ [translated, original, ...], ... ]
    if (Array.isArray(data?.[0])) {
      return data[0].map((seg: any[]) => seg?.[0] || "").join("") || clean
    }
    return clean
  } catch {
    return clean
  }
}

// Translate one string into many target languages in parallel.
async function translateToTargets(text: string, source: string, targets: string[]) {
  const entries = await Promise.all(
    targets.map(async (tl) => [tl, await translateOne(text, source, tl)] as const),
  )
  return Object.fromEntries(entries) as Record<string, string>
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const source: string = body.source || "ko"
    const targets: string[] = Array.isArray(body.targets) && body.targets.length ? body.targets : ["en"]

    // Batched shape: translate a name + description together.
    if (body.fields && typeof body.fields === "object") {
      const [name, desc] = await Promise.all([
        translateToTargets(body.fields.name || "", source, targets),
        translateToTargets(body.fields.desc || "", source, targets),
      ])
      return NextResponse.json({ fields: { name, desc } })
    }

    // Single-text shape.
    const translations = await translateToTargets(body.text || "", source, targets)
    return NextResponse.json({ translations })
  } catch (err: any) {
    console.error("[v0] /api/translate error:", err?.message || err)
    // Never fail hard — the client will fall back to the source text.
    return NextResponse.json({ translations: {}, fields: {} }, { status: 200 })
  }
}
