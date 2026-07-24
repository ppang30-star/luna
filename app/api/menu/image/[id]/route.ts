import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Serve a single menu item's image on demand. The image is stored in the
// menu_items.image column as a base64 data URI. Bundling all 65 images (~30MB)
// into the menu list query blows past Supabase's statement timeout, so we fetch
// each image individually here — one small row per request — and let the browser
// cache the result.
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
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

    const { data, error } = await supabase
      .from("menu_items")
      .select("image")
      .eq("id", id)
      .single()

    if (error || !data?.image) {
      return NextResponse.redirect(
        new URL("/placeholder.svg?height=192&width=400", _request.url),
      )
    }

    const raw: string = data.image.trim()

    // Images are stored in-DB as base64 data URIs (data:<mime>;base64,<payload>).
    // If some legacy row already holds an absolute URL, just redirect to it.
    if (/^https?:\/\//i.test(raw)) {
      return NextResponse.redirect(raw)
    }

    // Parse the data URI.
    const match = raw.match(/^data:([^;]+);base64,(.*)$/s)
    if (!match) {
      return NextResponse.redirect(
        new URL("/placeholder.svg?height=192&width=400", _request.url),
      )
    }

    const contentType = match[1] || "image/jpeg"
    // Return a Uint8Array (Web-standard body) rather than a Node Buffer. This
    // serializes correctly through Netlify's Next.js function runtime, whereas a
    // raw Buffer can be mangled/dropped, producing broken images in production.
    const bytes = Uint8Array.from(Buffer.from(match[2], "base64"))

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        // Cache aggressively: images rarely change, and this offloads repeat views.
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
