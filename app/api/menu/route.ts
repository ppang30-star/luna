import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Always run this route dynamically at request time (never statically cached),
// so production always returns fresh menu data from Supabase.
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  // Read env vars at RUNTIME on the server. Unlike NEXT_PUBLIC_* vars used in the
  // browser, these are not inlined at build time, so they are always available in
  // production regardless of when the build happened.
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  // Prefer the service role key on the server: it bypasses RLS policy evaluation
  // (removing per-row policy overhead) and avoids the short statement timeout that
  // the anon role can hit. This key is never exposed to the browser.
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured on the server." },
      { status: 500 },
    )
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })

    const categoriesRes = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })

    // NOTE: the heavy base64 `image` column is intentionally excluded here.
    // Fetching all images at once (~30MB) exceeds Supabase's statement timeout.
    // Images are served individually via /api/menu/image/[id].
    const menuItemsRes = await supabase
      .from("menu_items")
      .select(
        "id,category,name_ko,name_en,name_ja,name_zh,name_es,name_th,name_vi,desc_ko,desc_en,desc_ja,desc_zh,desc_es,desc_th,desc_vi,price_krw,price_currency,price_amount,sort_order,can_adjust,modifiers",
      )
      // Stable ordering: sort_order first, then id as a tiebreaker so items with an
      // identical sort_order keep a consistent position and never reshuffle after an update.
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })

    if (categoriesRes.error) {
      return NextResponse.json(
        { error: `Categories fetch failed: ${categoriesRes.error.message}` },
        { status: 500 },
      )
    }
    if (menuItemsRes.error) {
      return NextResponse.json(
        { error: `Menu items fetch failed: ${menuItemsRes.error.message}` },
        { status: 500 },
      )
    }

    return NextResponse.json(
      {
        categories: categoriesRes.data ?? [],
        menuItems: menuItemsRes.data ?? [],
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
