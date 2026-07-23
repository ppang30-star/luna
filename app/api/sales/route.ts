import { NextResponse, type NextRequest } from "next/server"
import { createAdminServerClient } from "@/lib/supabase/admin-server"
import { requireSuperAdmin } from "@/lib/admin-auth"

// Always run at request time so writes/reads always hit the live DB with
// runtime server env vars (never statically cached, never build-time inlined).
export const dynamic = "force-dynamic"
export const revalidate = 0

const NO_STORE = { "Cache-Control": "no-store, max-age=0" }

function serverError() {
  return NextResponse.json(
    { error: "Supabase environment variables are not configured on the server." },
    { status: 500, headers: NO_STORE },
  )
}

// ------------------------------------------------------------------
// GET /api/sales?resource=sales_records&from=ISO&to=ISO
// GET /api/sales?resource=sale_line_items&from=ISO&to=ISO
// Returns { data: [...] } for the requested table within the date range.
// ------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const supabase = createAdminServerClient()
  if (!supabase) return serverError()

  const { searchParams } = new URL(request.url)
  const resource = searchParams.get("resource") || "sales_records"
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  if (resource !== "sales_records" && resource !== "sale_line_items") {
    return NextResponse.json({ error: "Invalid resource." }, { status: 400, headers: NO_STORE })
  }

  try {
    let query = supabase.from(resource).select("*")

    if (from) query = query.gte("created_at", from)
    if (to) query = query.lte("created_at", to)

    // sale_line_items filter historically uses a half-open range (lt on the upper
    // bound). Callers pass an exclusive upper bound via `toExclusive` when needed.
    const toExclusive = searchParams.get("toExclusive")
    if (toExclusive) query = query.lt("created_at", toExclusive)

    query = query.order("created_at", { ascending: false })

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE })
    }
    return NextResponse.json({ data: data ?? [] }, { headers: NO_STORE })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE })
  }
}

// ------------------------------------------------------------------
// POST /api/sales
// Body: { salesRecord: {...}, lineItems?: [...] }
// Inserts the sales_records row, then (if provided) the flattened
// sale_line_items rows with sale_record_id injected server-side.
// Returns { id } of the inserted sales_records row.
// ------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const supabase = createAdminServerClient()
  if (!supabase) return serverError()

  try {
    const body = await request.json()
    const { salesRecord, lineItems } = body ?? {}

    if (!salesRecord || typeof salesRecord !== "object") {
      return NextResponse.json({ error: "Missing salesRecord." }, { status: 400, headers: NO_STORE })
    }

    const { data: insertedSale, error } = await supabase
      .from("sales_records")
      .insert(salesRecord)
      .select("id")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE })
    }

    // Dual-write flattened line items for statistics. Isolated so a failure here
    // never rolls back or blocks the primary sales_records write.
    let lineItemsError: string | null = null
    if (insertedSale?.id && Array.isArray(lineItems) && lineItems.length > 0) {
      const rows = lineItems.map((li: any) => ({ ...li, sale_record_id: insertedSale.id }))
      const { error: lineError } = await supabase.from("sale_line_items").insert(rows)
      if (lineError) lineItemsError = lineError.message
    }

    return NextResponse.json(
      { id: insertedSale?.id ?? null, lineItemsError },
      { headers: NO_STORE },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE })
  }
}

// ------------------------------------------------------------------
// DELETE /api/sales?billId=X   (preferred - removes all rows for a bill)
// DELETE /api/sales?id=Y       (fallback - single record)
// ------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  // RBAC: deleting sales records is a destructive admin action reserved for
  // super admins. Managers (read-only) are rejected here even if they craft
  // the request manually, because they never hold the privileged token.
  const unauthorized = requireSuperAdmin(request)
  if (unauthorized) return unauthorized

  const supabase = createAdminServerClient()
  if (!supabase) return serverError()

  const { searchParams } = new URL(request.url)
  const billId = searchParams.get("billId")
  const id = searchParams.get("id")

  try {
    if (billId !== null && billId !== "") {
      const { error } = await supabase.from("sales_records").delete().eq("bill_id", billId)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE })
      }
      // Keep the flattened stats table consistent with the source of truth.
      await supabase.from("sale_line_items").delete().eq("bill_id", billId)
    } else if (id !== null && id !== "") {
      const { error } = await supabase.from("sales_records").delete().eq("id", id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE })
      }
      await supabase.from("sale_line_items").delete().eq("sale_record_id", id)
    } else {
      return NextResponse.json({ error: "Missing billId or id." }, { status: 400, headers: NO_STORE })
    }

    return NextResponse.json({ success: true }, { headers: NO_STORE })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE })
  }
}
