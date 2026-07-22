"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchComboOptionGroups, type ComboOptionGroup } from "@/lib/combo-options"

// Realtime subscription to the global combo_option_groups table. Mirrors the
// use-realtime-menu pattern so option groups sync across every device the moment
// an admin edits them.
export function useComboOptionGroups() {
  const [groups, setGroups] = useState<ComboOptionGroup[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const data = await fetchComboOptionGroups()
    setGroups(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()

    const supabase = createClient()
    if (!supabase) return

    const channel = supabase
      .channel("combo_option_groups_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "combo_option_groups" }, () => {
        refetch()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refetch])

  return { groups, loading, refetch }
}
