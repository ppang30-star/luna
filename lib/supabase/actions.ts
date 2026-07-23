"use client"

import { createClient } from "./client"
import { appCategoryToDb, appMenuItemToDb } from "@/hooks/use-realtime-menu"
import { isSuperAdmin } from "@/lib/admin-session"

// RBAC guard for every menu/category/modifier mutation. These writes run through
// the browser client, so we block any non-super-admin session from mutating.
// (For defense-in-depth at the database layer, enable Supabase RLS so the anon
// key cannot write these tables directly.)
function assertCanWrite(action: string) {
  if (!isSuperAdmin()) {
    throw new Error(`권한 없음: '${action}' 작업은 최고 관리자만 수행할 수 있습니다.`)
  }
}

// Category Actions
export async function addCategory(category: any, sortOrder: number = 0) {
  try {
    assertCanWrite("카테고리 추가")
    const supabase = createClient()
    
    if (!supabase) {
      console.warn("[v0] Supabase not configured, skipping addCategory")
      return null
    }
    
    const dbCategory = appCategoryToDb(category, sortOrder)
    
    const { data, error } = await supabase
      .from("categories")
      .insert(dbCategory)
      .select()
      .single()

    if (error) {
      console.error("[v0] Error adding category:", error)
      throw error
    }
    return data
  } catch (err) {
    console.error("[v0] Exception in addCategory:", err)
    throw err
  }
}

export async function updateCategory(id: string, category: any) {
  try {
    assertCanWrite("카테고리 수정")
    const supabase = createClient()
    
    if (!supabase) {
      console.warn("[v0] Supabase not configured, skipping updateCategory")
      return null
    }
    
    const dbCategory = appCategoryToDb(category, category.sort_order || 0)
    
    const { data, error } = await supabase
      .from("categories")
      .update(dbCategory)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[v0] Error updating category:", error)
      throw error
    }
    return data
  } catch (err) {
    console.error("[v0] Exception in updateCategory:", err)
    throw err
  }
}

export async function deleteCategory(id: string) {
  try {
    assertCanWrite("카테고리 삭제")
    const supabase = createClient()
    
    if (!supabase) {
      console.warn("[v0] Supabase not configured, skipping deleteCategory")
      return
    }
    
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("[v0] Error deleting category:", error)
      throw error
    }
  } catch (err) {
    console.error("[v0] Exception in deleteCategory:", err)
    throw err
  }
}

export async function updateCategoryOrder(categories: any[]) {
  try {
    assertCanWrite("카테고리 순서 변경")
    const supabase = createClient()
    
    if (!supabase) {
      console.warn("[v0] Supabase not configured, skipping updateCategoryOrder")
      return
    }
    
    const updates = categories.map((cat, index) => ({
      id: cat.id,
      ko: cat.ko,
      en: cat.en,
      ja: cat.ja,
      zh: cat.zh,
      es: cat.es,
      th: cat.th,
      vi: cat.vi,
      sort_order: index,
      is_visible: cat.isVisible !== false,
    }))

    const { error } = await supabase
      .from("categories")
      .upsert(updates)

    if (error) {
      console.error("[v0] Error updating category order:", error)
      throw error
    }
  } catch (err) {
    console.error("[v0] Exception in updateCategoryOrder:", err)
    throw err
  }
}

// Menu Item Actions
export async function addMenuItem(menuItem: any, sortOrder: number = 0) {
  try {
    assertCanWrite("메뉴 추가")
    const supabase = createClient()
    
    if (!supabase) {
      const errorMsg = "Supabase not configured, skipping addMenuItem"
      console.error("[v0] " + errorMsg)
      throw new Error(errorMsg)
    }
    
    const dbMenuItem = appMenuItemToDb(menuItem, sortOrder)
    
    console.log("[v0] Adding menu item to Supabase:", JSON.stringify(dbMenuItem, null, 2))
    
    // Use upsert instead of insert to handle duplicate IDs
    const { data, error } = await supabase
      .from("menu_items")
      .upsert(dbMenuItem, { onConflict: 'id' })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error adding menu item:", error.message, error.details, error.hint)
      throw new Error(`메뉴 추가 실패: ${error.message}`)
    }
    
    console.log("[v0] Menu item added successfully:", data)
    return data
  } catch (err: any) {
    console.error("[v0] Exception in addMenuItem:", err.message || err)
    throw err
  }
}

export async function updateMenuItem(id: string, menuItem: any) {
  try {
    assertCanWrite("메뉴 수정")
    const supabase = createClient()
    
    if (!supabase) {
      const errorMsg = "Supabase not configured, skipping updateMenuItem"
      console.error("[v0] " + errorMsg)
      throw new Error(errorMsg)
    }
    
    const dbMenuItem = appMenuItemToDb(menuItem, menuItem.sort_order || 0)
    
    console.log("[v0] Updating menu item in Supabase, id:", id, "data:", JSON.stringify(dbMenuItem, null, 2))
    
    // CRITICAL: If the update payload does NOT include an image (appMenuItemToDb conditionally excludes it),
    // we must preserve the existing image in the database by fetching the current item first and using
    // its image in the update. This ensures images aren't accidentally deleted during edits.
    if (!('image' in dbMenuItem)) {
      console.log("[v0] No new image in update payload, preserving existing image")
      
      // Fetch the current menu item to get its existing image
      const { data: currentItem, error: fetchError } = await supabase
        .from("menu_items")
        .select("image")
        .eq("id", id)
        .single()
      
      if (fetchError) {
        console.warn("[v0] Could not fetch existing image to preserve:", fetchError.message)
        // Continue anyway, the image column will just remain unchanged
      } else if (currentItem?.image) {
        console.log("[v0] Including existing image in update")
        dbMenuItem.image = currentItem.image
      }
    }
    
    const { data, error } = await supabase
      .from("menu_items")
      .update(dbMenuItem)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[v0] Error updating menu item:", error.message, error.details, error.hint)
      throw new Error(`메뉴 수정 실패: ${error.message}`)
    }
    
    console.log("[v0] Menu item updated successfully:", data)
    return data
  } catch (err: any) {
    console.error("[v0] Exception in updateMenuItem:", err.message || err)
    throw err
  }
}

export async function deleteMenuItem(id: string) {
  try {
    assertCanWrite("메뉴 삭제")
    const supabase = createClient()
    
    if (!supabase) {
      const errorMsg = "Supabase not configured, skipping deleteMenuItem"
      console.error("[v0] " + errorMsg)
      throw new Error(errorMsg)
    }
    
    console.log("[v0] Deleting menu item from Supabase, id:", id)
    
    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("[v0] Error deleting menu item:", error.message, error.details, error.hint)
      throw new Error(`메뉴 삭제 실패: ${error.message}`)
    }
    
    console.log("[v0] Menu item deleted successfully, id:", id)
  } catch (err: any) {
    console.error("[v0] Exception in deleteMenuItem:", err.message || err)
    throw err
  }
}

// Modifier Actions
export async function getMenuModifiers(menuItemId: string) {
  try {
    const supabase = createClient()
    
    if (!supabase) {
      console.warn("[v0] Supabase not configured, skipping getMenuModifiers")
      return []
    }
    
    const { data, error } = await supabase
      .from("menu_modifiers")
      .select(`
        *,
        modifier_options (
          id,
          option_value,
          option_label_ko,
          option_label_en,
          option_label_ja,
          option_label_zh,
          option_label_es,
          option_label_th,
          option_label_vi,
          sort_order
        )
      `)
      .eq("menu_item_id", menuItemId)
      .order("sort_order", { ascending: true })
    
    if (error) {
      console.error("[v0] Error fetching menu modifiers:", error)
      throw error
    }
    
    return data || []
  } catch (err: any) {
    console.error("[v0] Exception in getMenuModifiers:", err)
    return []
  }
}

export async function addMenuModifier(modifier: any) {
  try {
    assertCanWrite("모디파이어 추가")
    const supabase = createClient()
    
    if (!supabase) {
      console.warn("[v0] Supabase not configured, skipping addMenuModifier")
      return null
    }
    
    const { data, error } = await supabase
      .from("menu_modifiers")
      .insert(modifier)
      .select()
      .single()
    
    if (error) {
      console.error("[v0] Error adding menu modifier:", error)
      throw error
    }
    
    return data
  } catch (err: any) {
    console.error("[v0] Exception in addMenuModifier:", err)
    throw err
  }
}

export async function updateMenuModifier(id: string, modifier: any) {
  try {
    assertCanWrite("모디파이어 수정")
    const supabase = createClient()
    
    if (!supabase) {
      console.warn("[v0] Supabase not configured, skipping updateMenuModifier")
      return null
    }
    
    const { data, error } = await supabase
      .from("menu_modifiers")
      .update(modifier)
      .eq("id", id)
      .select()
      .single()
    
    if (error) {
      console.error("[v0] Error updating menu modifier:", error)
      throw error
    }
    
    return data
  } catch (err: any) {
    console.error("[v0] Exception in updateMenuModifier:", err)
    throw err
  }
}

export async function deleteMenuModifier(id: string) {
  try {
    assertCanWrite("모디파이어 삭제")
    const supabase = createClient()
    
    if (!supabase) {
      console.warn("[v0] Supabase not configured, skipping deleteMenuModifier")
      return
    }
    
    const { error } = await supabase
      .from("menu_modifiers")
      .delete()
      .eq("id", id)
    
    if (error) {
      console.error("[v0] Error deleting menu modifier:", error)
      throw error
    }
  } catch (err: any) {
    console.error("[v0] Exception in deleteMenuModifier:", err)
    throw err
  }
}

export async function addModifierOption(option: any) {
  try {
    assertCanWrite("옵션 추가")
    const supabase = createClient()
    
    if (!supabase) {
      console.warn("[v0] Supabase not configured, skipping addModifierOption")
      return null
    }
    
    const { data, error } = await supabase
      .from("modifier_options")
      .insert(option)
      .select()
      .single()
    
    if (error) {
      console.error("[v0] Error adding modifier option:", error)
      throw error
    }
    
    return data
  } catch (err: any) {
    console.error("[v0] Exception in addModifierOption:", err)
    throw err
  }
}

export async function updateModifierOption(id: string, option: any) {
  try {
    assertCanWrite("옵션 수정")
    const supabase = createClient()
    
    if (!supabase) {
      console.warn("[v0] Supabase not configured, skipping updateModifierOption")
      return null
    }
    
    const { data, error } = await supabase
      .from("modifier_options")
      .update(option)
      .eq("id", id)
      .select()
      .single()
    
    if (error) {
      console.error("[v0] Error updating modifier option:", error)
      throw error
    }
    
    return data
  } catch (err: any) {
    console.error("[v0] Exception in updateModifierOption:", err)
    throw err
  }
}

export async function deleteModifierOption(id: string) {
  try {
    assertCanWrite("옵션 삭제")
    const supabase = createClient()
    
    if (!supabase) {
      console.warn("[v0] Supabase not configured, skipping deleteModifierOption")
      return
    }
    
    const { error } = await supabase
      .from("modifier_options")
      .delete()
      .eq("id", id)
    
    if (error) {
      console.error("[v0] Error deleting modifier option:", error)
      throw error
    }
  } catch (err: any) {
    console.error("[v0] Exception in deleteModifierOption:", err)
    throw err
  }
}
