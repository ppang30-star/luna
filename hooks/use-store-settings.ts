"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

export interface StoreSettings {
  id: string
  table_numbers: string[]
  page_title: string
  page_subtitle: string
  background_image: string
  updated_at: string
}

const DEFAULT_SETTINGS: StoreSettings = {
  id: "default",
  table_numbers: [],
  page_title: "셀프 메뉴판",
  page_subtitle: "프리미엄 음료 선택",
  background_image: "",
  updated_at: new Date().toISOString(),
}

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch settings from Supabase
  const fetchSettings = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) {
      console.warn("[v0] Supabase not configured, using default settings")
      setLoading(false)
      return
    }

    try {
      const { data, error: fetchError } = await supabase
        .from("store_settings")
        .select("*")
        .eq("id", "default")
        .single()

      if (fetchError) {
        // If no row exists, create one
        if (fetchError.code === "PGRST116") {
          const { data: newData, error: insertError } = await supabase
            .from("store_settings")
            .insert([DEFAULT_SETTINGS])
            .select()
            .single()

          if (!insertError && newData) {
            setSettings(newData)
          }
        } else {
          console.error("[v0] Error fetching store settings:", fetchError)
          setError(fetchError.message)
        }
      } else if (data) {
        setSettings(data)
      }
    } catch (err) {
      console.error("[v0] Exception fetching store settings:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [])

  // Save settings to Supabase
  const saveSettings = useCallback(async (newSettings: Partial<StoreSettings>) => {
    const supabase = createClient()
    if (!supabase) {
      console.warn("[v0] Supabase not configured, cannot save settings")
      return { success: false, error: "Supabase not configured" }
    }

    try {
      const updatedSettings = {
        ...settings,
        ...newSettings,
        updated_at: new Date().toISOString(),
      }

      const { data, error: upsertError } = await supabase
        .from("store_settings")
        .upsert([updatedSettings])
        .select()
        .single()

      if (upsertError) {
        console.error("[v0] Error saving store settings:", upsertError)
        return { success: false, error: upsertError.message }
      }

      if (data) {
        setSettings(data)
      }
      return { success: true, error: null }
    } catch (err) {
      console.error("[v0] Exception saving store settings:", err)
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
    }
  }, [settings])

  // Save table numbers specifically
  const saveTableNumbers = useCallback(async (tableNumbers: string[]) => {
    return saveSettings({ table_numbers: tableNumbers })
  }, [saveSettings])

  // Set up realtime subscription for settings changes
  useEffect(() => {
    fetchSettings()

    const supabase = createClient()
    if (!supabase) return

    // Unique channel name per hook instance. Multiple components use this hook
    // simultaneously (e.g. page + cart popup), and Supabase throws
    // "cannot add postgres_changes callbacks after subscribe()" when two channels
    // share the same topic name. A unique suffix keeps each subscription isolated.
    const channelName = `store_settings_changes_${Math.random().toString(36).slice(2)}`

    // Subscribe to realtime changes
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "store_settings",
          filter: "id=eq.default",
        },
        (payload) => {
          console.log("[v0] Store settings updated via realtime:", payload)
          if (payload.new) {
            setSettings(payload.new as StoreSettings)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchSettings])

  return {
    settings,
    loading,
    error,
    saveSettings,
    saveTableNumbers,
    refetch: fetchSettings,
  }
}

// Hook specifically for user-side table selection (uses localStorage)
export function useSelectedTable(availableTables: string[]) {
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // Load selected table from localStorage on mount (only once)
  useEffect(() => {
    if (!mounted) {
      setMounted(true)
      const saved = localStorage.getItem("selectedTable")
      if (saved) {
        // Set the saved table immediately without validation
        // Validation happens in the next effect when availableTables is loaded
        setSelectedTable(saved)
      }
      setInitialLoadDone(true)
    }
  }, [mounted])

  // Validate selected table when availableTables changes (after Supabase loads)
  useEffect(() => {
    if (initialLoadDone && availableTables.length > 0 && selectedTable) {
      // If the saved table is no longer in the available list, clear it
      if (!availableTables.includes(selectedTable)) {
        localStorage.removeItem("selectedTable")
        setSelectedTable(null)
      }
    }
  }, [availableTables, selectedTable, initialLoadDone])

  // Select a table and save to localStorage
  const selectTable = useCallback((table: string) => {
    setSelectedTable(table)
    localStorage.setItem("selectedTable", table)
  }, [])

  // Clear selected table
  const clearTable = useCallback(() => {
    setSelectedTable(null)
    localStorage.removeItem("selectedTable")
  }, [])

  return {
    selectedTable,
    selectTable,
    clearTable,
    mounted,
  }
}
