import { createClient } from "@/lib/supabase/client"

// A single selectable drink/item inside an option group, e.g. "참이슬".
// Only the Korean name is stored — the User UI translates it at render time via
// the shared translateText()/useTranslatedText mechanism (same as the Main Menu).
export interface ComboOptionItem {
  id: string
  name: string // Korean source text only
}

// A reusable option group, e.g. "소주", containing a list of items. Groups are
// global and can be linked to many Combo menus by id.
export interface ComboOptionGroup {
  id: string
  name: string // Korean source text only
  items: ComboOptionItem[]
  sortOrder: number
}

const LOCAL_KEY = "comboOptionGroups"

function fromRow(row: any): ComboOptionGroup {
  return {
    id: String(row.id),
    name: row.name ?? "",
    items: Array.isArray(row.items)
      ? row.items.map((it: any) => ({ id: String(it.id), name: it.name ?? "" }))
      : [],
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
  }
}

function toRow(group: ComboOptionGroup) {
  return {
    id: group.id,
    name: group.name,
    items: group.items.map((it) => ({ id: it.id, name: it.name })),
    sort_order: group.sortOrder,
    updated_at: new Date().toISOString(),
  }
}

// localStorage fallback so the manager still works when Supabase isn't configured.
function readLocal(): ComboOptionGroup[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as ComboOptionGroup[]) : []
  } catch {
    return []
  }
}

function writeLocal(groups: ComboOptionGroup[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(LOCAL_KEY, JSON.stringify(groups))
}

export async function fetchComboOptionGroups(): Promise<ComboOptionGroup[]> {
  const supabase = createClient()
  if (!supabase) return readLocal()

  const { data, error } = await supabase
    .from("combo_option_groups")
    .select("id,name,items,sort_order")
    .order("sort_order", { ascending: true })

  if (error) {
    console.log("[v0] fetchComboOptionGroups fell back to local:", error.message)
    return readLocal()
  }
  const groups = (data ?? []).map(fromRow)
  writeLocal(groups)
  return groups
}

export async function saveComboOptionGroup(group: ComboOptionGroup): Promise<void> {
  const supabase = createClient()
  if (!supabase) {
    const groups = readLocal()
    const idx = groups.findIndex((g) => g.id === group.id)
    if (idx >= 0) groups[idx] = group
    else groups.push(group)
    writeLocal(groups)
    return
  }

  const { error } = await supabase.from("combo_option_groups").upsert(toRow(group), { onConflict: "id" })
  if (error) throw error
}

export async function deleteComboOptionGroup(id: string): Promise<void> {
  const supabase = createClient()
  if (!supabase) {
    writeLocal(readLocal().filter((g) => g.id !== id))
    return
  }
  const { error } = await supabase.from("combo_option_groups").delete().eq("id", id)
  if (error) throw error
}
