'use client'

import { createClient } from '@/lib/supabase/client'
import { initializeManagersTable, initializePriceAdjustmentLogsTable } from '@/lib/supabase/initialize-managers-table'

// Manager types
export interface Manager {
  id: string
  name: string
  password: string
  role?: string
  created_at: string
}

export interface PriceAdjustmentLog {
  id: string
  menu_item_id: string
  menu_name: string
  original_price: number
  adjusted_price: number
  price_change: number
  manager_name: string
  adjustment_date: string
  created_at: string
}

// Session-based price adjustments (not persisted to DB)
export interface SessionPriceAdjustment {
  itemId: string
  originalPrice: number
  adjustedPrice: number
  managerName: string
  adjustmentTime: number
}

// Store adjusted prices in session storage keyed by date (resets at noon)
const STORAGE_KEY_PREFIX = 'manager_prices_'

export function getStorageKeyForDate(date: Date): string {
  // Use YYYY-MM-DD as key so prices reset at midnight
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${STORAGE_KEY_PREFIX}${year}-${month}-${day}`
}

export function getSessionAdjustments(): Map<string, SessionPriceAdjustment> {
  const storageKey = getStorageKeyForDate(new Date())
  const stored = localStorage.getItem(storageKey)
  if (!stored) return new Map()
  
  try {
    const data = JSON.parse(stored)
    return new Map(Object.entries(data) as [string, SessionPriceAdjustment][])
  } catch {
    return new Map()
  }
}

export function setSessionAdjustment(itemId: string, adjustment: SessionPriceAdjustment) {
  const storageKey = getStorageKeyForDate(new Date())
  const adjustments = getSessionAdjustments()
  adjustments.set(itemId, adjustment)
  
  const data = Object.fromEntries(adjustments)
  localStorage.setItem(storageKey, JSON.stringify(data))
}

export function getAdjustedPrice(itemId: string, originalPrice: number): number {
  const adjustments = getSessionAdjustments()
  const adjustment = adjustments.get(itemId)
  return adjustment ? adjustment.adjustedPrice : originalPrice
}

export function hasAdjustment(itemId: string): boolean {
  const adjustments = getSessionAdjustments()
  return adjustments.has(itemId)
}

export function getAdjustmentInfo(itemId: string): SessionPriceAdjustment | null {
  const adjustments = getSessionAdjustments()
  return adjustments.get(itemId) || null
}

// Initialize managers table if it doesn't exist
let managersTableInitialized = false
let priceLogsTableInitialized = false

async function ensureManagersTableExists(): Promise<void> {
  if (managersTableInitialized) return
  
  try {
    const success = await initializeManagersTable()
    managersTableInitialized = success
    if (!success) {
      console.error('[v0] Failed to initialize managers table')
    }
  } catch (err) {
    console.error('[v0] Error in ensureManagersTableExists:', err)
    managersTableInitialized = false
  }
}

async function ensurePriceLogsTableExists(): Promise<void> {
  if (priceLogsTableInitialized) return
  
  try {
    const success = await initializePriceAdjustmentLogsTable()
    priceLogsTableInitialized = success
    if (!success) {
      console.error('[v0] Failed to initialize price_adjustment_logs table')
    }
  } catch (err) {
    console.error('[v0] Error in ensurePriceLogsTableExists:', err)
    priceLogsTableInitialized = false
  }
}

// Manager authentication
export async function verifyManagerPassword(managerName: string, password: string): Promise<boolean> {
  try {
    await ensureManagersTableExists()
    const supabase = createClient()
    const { data, error } = await supabase
      .from('managers')
      .select('id')
      .eq('name', managerName)
      .eq('password', password)
      .single()
    
    if (error || !data) return false
    return true
  } catch {
    return false
  }
}

// Get all managers
export async function getManagers(): Promise<Manager[]> {
  try {
    await ensureManagersTableExists()
    const supabase = createClient()
    const { data, error } = await supabase
      .from('managers')
      .select('id, name, password, role, created_at')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('[v0] Error fetching managers:', error.message, error)
      return []
    }
    if (!data) return []
    return data as Manager[]
  } catch (err) {
    console.error('[v0] Exception fetching managers:', err)
    return []
  }
}

// Add or update manager - returns { success: boolean, error?: string }
export async function upsertManager(name: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureManagersTableExists()
    const supabase = createClient()
    
    console.log('[v0] Attempting to insert manager:', { name, password: '***' })
    
    const { error, data } = await supabase
      .from('managers')
      .insert({
        name,
        password,
        role: 'manager'
      })
      .select()
    
    if (error) {
      const errorMessage = `[Supabase Error] ${error.code}: ${error.message}`
      console.error('[v0] Error upserting manager:', errorMessage, error)
      return {
        success: false,
        error: errorMessage
      }
    }
    
    console.log('[v0] Manager inserted successfully:', data)
    return { success: true }
  } catch (err: any) {
    const errorMessage = err?.message || String(err) || 'Unknown error'
    console.error('[v0] Exception upserting manager:', errorMessage, err)
    return {
      success: false,
      error: `[Error] ${errorMessage}`
    }
  }
}

// Delete manager
export async function deleteManager(name: string): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureManagersTableExists()
    const supabase = createClient()
    const { error } = await supabase
      .from('managers')
      .delete()
      .eq('name', name)
    
    if (error) {
      const errorMessage = `[Supabase Error] ${error.code}: ${error.message}`
      console.error('[v0] Error deleting manager:', errorMessage, error)
      return {
        success: false,
        error: errorMessage
      }
    }
    return { success: true }
  } catch (err: any) {
    const errorMessage = err?.message || String(err) || 'Unknown error'
    console.error('[v0] Exception deleting manager:', errorMessage, err)
    return {
      success: false,
      error: `[Error] ${errorMessage}`
    }
  }
}

// Log price adjustment
export async function logPriceAdjustment(
  menuItemId: string,
  menuName: string,
  originalPrice: number,
  adjustedPrice: number,
  managerName: string
): Promise<boolean> {
  try {
    await ensurePriceLogsTableExists()
    const supabase = createClient()
    const { error } = await supabase
      .from('price_adjustment_logs')
      .insert({
        menu_item_id: menuItemId,
        menu_name: menuName,
        original_price: originalPrice,
        adjusted_price: adjustedPrice,
        price_change: adjustedPrice - originalPrice,
        manager_name: managerName,
        adjustment_date: new Date().toISOString()
      })
    
    if (error) {
      console.error('[v0] Error logging price adjustment:', error)
      return false
    }
    return true
  } catch (err) {
    console.error('[v0] Error logging price adjustment:', err)
    return false
  }
}

// Get price adjustment logs
export async function getPriceAdjustmentLogs(): Promise<PriceAdjustmentLog[]> {
  try {
    await ensurePriceLogsTableExists()
    const supabase = createClient()
    const { data, error } = await supabase
      .from('price_adjustment_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (error || !data) return []
    return data as PriceAdjustmentLog[]
  } catch {
    return []
  }
}
