"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react"

export interface ModifierOption {
  id: string
  option_value: string
  option_label_ko: string
  option_label_en?: string
  sort_order: number
}

export interface MenuModifier {
  id: string
  menu_item_id: string
  group_name_ko: string
  group_name_en?: string
  is_required: boolean
  sort_order: number
  modifier_options: ModifierOption[]
}

// localStorage key for persisting modifiers during editing session
export const getModifiersLocalStorageKey = (menuItemId: string) => `modifiers_edit_${menuItemId}`

// Save modifiers to localStorage
export const saveModifiersToLocalStorage = (menuItemId: string, modifiers: MenuModifier[]) => {
  try {
    localStorage.setItem(getModifiersLocalStorageKey(menuItemId), JSON.stringify(modifiers))
    console.log("[v0] Modifiers saved to localStorage for:", menuItemId)
  } catch (err) {
    console.error("[v0] Error saving modifiers to localStorage:", err)
  }
}

// Load modifiers from localStorage
export const loadModifiersFromLocalStorage = (menuItemId: string): MenuModifier[] | null => {
  try {
    const stored = localStorage.getItem(getModifiersLocalStorageKey(menuItemId))
    if (stored) {
      console.log("[v0] Modifiers loaded from localStorage for:", menuItemId)
      return JSON.parse(stored)
    }
  } catch (err) {
    console.error("[v0] Error loading modifiers from localStorage:", err)
  }
  return null
}

// Clear modifiers from localStorage (called after menu is saved)
export const clearModifiersFromLocalStorage = (menuItemId: string) => {
  try {
    localStorage.removeItem(getModifiersLocalStorageKey(menuItemId))
    console.log("[v0] Modifiers cleared from localStorage for:", menuItemId)
  } catch (err) {
    console.error("[v0] Error clearing modifiers from localStorage:", err)
  }
}

export function ModifierManager({
  menuItemId,
  initialModifiers,
}: {
  menuItemId: string
  // Modifiers already saved on the menu item in Supabase (menu_items.modifiers JSONB).
  // Used to seed the editor on a fresh device where no localStorage session exists yet.
  initialModifiers?: MenuModifier[]
}) {
  const [modifiers, setModifiers] = useState<MenuModifier[]>([])
  const [newGroupName, setNewGroupName] = useState("")
  const [expandedModifierId, setExpandedModifierId] = useState<string | null>(null)
  const [newOptionValues, setNewOptionValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [activeLanguage, setActiveLanguage] = useState("ko")

  useEffect(() => {
    loadModifiers()
  }, [menuItemId])

  const loadModifiers = async () => {
    try {
      setLoading(true)
      // First, try to load from localStorage (in-session editing buffer)
      const storedModifiers = loadModifiersFromLocalStorage(menuItemId)
      if (storedModifiers && storedModifiers.length > 0) {
        setModifiers(storedModifiers)
        return
      }

      // Otherwise seed from the modifiers saved on the menu item in Supabase.
      // This is what makes staff/modifiers appear on every device, not just the
      // one where they were originally created.
      if (Array.isArray(initialModifiers) && initialModifiers.length > 0) {
        setModifiers(initialModifiers)
        saveModifiersToLocalStorage(menuItemId, initialModifiers)
        return
      }

      setModifiers([])
    } catch (err) {
      console.error("[v0] Error loading modifiers:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddModifier = () => {
    const groupNameTrimmed = newGroupName.trim()
    
    if (groupNameTrimmed.length === 0) {
      alert("Please enter a modifier group name")
      return
    }

    // Create a new modifier group locally
    const newModifier: MenuModifier = {
      id: `temp_${Date.now()}`,
      menu_item_id: menuItemId,
      group_name_ko: groupNameTrimmed,
      group_name_en: groupNameTrimmed,
      is_required: true,
      sort_order: modifiers.length,
      modifier_options: [],
    }

    // Update state directly
    const updatedModifiers = [...modifiers, newModifier]
    setModifiers(updatedModifiers)
    setNewGroupName("")
    // Persist to localStorage immediately
    saveModifiersToLocalStorage(menuItemId, updatedModifiers)
    console.log("[v0] Modifier group added locally:", newModifier)
  }

  const handleAddOption = (modifierId: string) => {
    const optionValue = newOptionValues[modifierId]?.trim()
    if (!optionValue) {
      alert("Please enter an option value")
      return
    }

    // Find the modifier and add option to it locally
    const updatedModifiers = modifiers.map((modifier) => {
      if (modifier.id === modifierId) {
        const newOption: ModifierOption = {
          id: `temp_${Date.now()}`,
          option_value: optionValue,
          option_label_ko: optionValue,
          option_label_en: optionValue,
          sort_order: modifier.modifier_options?.length || 0,
        }
        return {
          ...modifier,
          modifier_options: [...(modifier.modifier_options || []), newOption],
        }
      }
      return modifier
    })

    // Update state directly
    setModifiers(updatedModifiers)
    setNewOptionValues({ ...newOptionValues, [modifierId]: "" })
    // Persist to localStorage immediately
    saveModifiersToLocalStorage(menuItemId, updatedModifiers)
    console.log("[v0] Option added locally to modifier:", modifierId)
  }

  const handleDeleteModifier = (modifierId: string) => {
    if (!confirm("Are you sure you want to delete this modifier group?")) return

    // Remove modifier from local state
    const updatedModifiers = modifiers.filter(m => m.id !== modifierId)
    setModifiers(updatedModifiers)
    // Persist to localStorage immediately
    saveModifiersToLocalStorage(menuItemId, updatedModifiers)
    console.log("[v0] Modifier deleted locally:", modifierId)
  }

  const handleDeleteOption = (modifierId: string, optionId: string) => {
    if (!confirm("Are you sure you want to delete this option?")) return

    // Remove option from local state
    const updatedModifiers = modifiers.map((modifier) => {
      if (modifier.id === modifierId) {
        return {
          ...modifier,
          modifier_options: modifier.modifier_options?.filter(opt => opt.id !== optionId) || [],
        }
      }
      return modifier
    })

    setModifiers(updatedModifiers)
    // Persist to localStorage immediately
    saveModifiersToLocalStorage(menuItemId, updatedModifiers)
    console.log("[v0] Option deleted locally:", optionId)
  }

  if (loading) {
    return <div className="p-4">Loading modifiers...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Required Options (Modifiers)</CardTitle>
        <CardDescription>Add option groups that users must select when ordering this item</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add New Modifier Group */}
        <div className="flex gap-2">
          <Input
            placeholder="e.g., Staff List, Size, Extra Toppings"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handleAddModifier()
              }
            }}
            className="flex-1"
          />
          <Button 
            type="button"
            onClick={handleAddModifier} 
            size="sm"
            disabled={newGroupName.trim().length === 0}
            className="whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Group
          </Button>
        </div>

        {/* Modifier Groups List */}
        <div className="space-y-2">
          {modifiers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No modifier groups yet. Create one to add required options.</p>
          ) : (
            modifiers.map((modifier) => (
              <div key={modifier.id} className="border rounded-lg p-3 bg-muted/30">
                {/* Group Header */}
                <div
                  className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-2 rounded -m-2"
                  onClick={() => setExpandedModifierId(expandedModifierId === modifier.id ? null : modifier.id)}
                >
                  <div className="flex items-center gap-2 flex-1">
                    {expandedModifierId === modifier.id ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="font-medium text-sm">{modifier.group_name_ko}</span>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {modifier.modifier_options?.length || 0} option{modifier.modifier_options?.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteModifier(modifier.id)
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>

                {/* Expanded Options */}
                {expandedModifierId === modifier.id && (
                  <div className="mt-3 space-y-2 pl-6">
                    {/* List Existing Options */}
                    {modifier.modifier_options && modifier.modifier_options.length > 0 && (
                      <div className="space-y-1">
                        {modifier.modifier_options.map((option) => (
                          <div key={option.id} className="flex items-center justify-between bg-white dark:bg-slate-950 p-2 rounded text-sm text-gray-900 dark:text-gray-100">
                            <span>{option.option_label_ko}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteOption(modifier.id, option.id)}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add New Option */}
                    <div className="flex gap-2 pt-2 border-t">
                      <Input
                        placeholder="e.g., John, Jane, Bob"
                        value={newOptionValues[modifier.id] || ""}
                        onChange={(e) => setNewOptionValues({ ...newOptionValues, [modifier.id]: e.target.value })}
                        onKeyPress={(e) => e.key === "Enter" && handleAddOption(modifier.id)}
                        className="text-sm h-8"
                      />
                      <Button
                        type="button"
                        onClick={() => handleAddOption(modifier.id)}
                        size="sm"
                        className="h-8"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
