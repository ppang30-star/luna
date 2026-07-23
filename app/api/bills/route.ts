import { NextResponse, type NextRequest } from "next/server"
import { createAdminServerClient } from "@/lib/supabase/admin-server"

// Runtime-only so the bill number is always generated against the live DB using
// server env vars (never build-time inlined NEXT_PUBLIC_* values).
export const dynamic = "force-dynamic"
export const revalidate = 0

const NO_STORE = { "Cache-Control": "no-store, max-age=0" }

// POST /api/bills  -> inserts a bills row, returns { id } (the unified bill number).
export async function POST(request: NextRequest) {
  const supabase = createAdminServerClient()
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured on the server." },
      { status: 500, headers: NO_STORE },
    )
  }

  try {
    const bill = await request.json()
    if (!bill || typeof bill !== "object") {
      return NextResponse.json({ error: "Missing bill payload." }, { status: 400, headers: NO_STORE })
    }

    const { data, error } = await supabase
      .from("bills")
      .insert({
        table_no: bill.table_no ?? "N/A",
        order_details: bill.order_details ?? [],
        total_amount: bill.total_amount ?? 0,
        currency: bill.currency ?? "KRW",
      })
      .select("id")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE })
    }

    return NextResponse.json({ id: data?.id ?? null }, { headers: NO_STORE })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE })
  }
}
