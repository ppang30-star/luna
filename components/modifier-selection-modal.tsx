"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface ModifierOption {
  id: string
  option_value: string
  option_label_ko: string
  option_label_en?: string
  sort_order: number
}

interface MenuModifier {
  id: string
  group_name_ko: string
  group_name_en?: string
  is_required: boolean
  sort_order: number
  modifier_options: ModifierOption[]
}

interface SelectedModifierState {
  [modifierId: string]: Set<string> // Changed to Set to support multiple selections
}

interface ModifierSelectionModalProps {
  isOpen: boolean
  modifiers: MenuModifier[]
  itemName: string
  language: string
  // onConfirm now receives the full selection state so caller can implement custom loop logic
  onConfirm: (selectedModifiers: SelectedModifierState) => void
  onCancel: () => void
}

export function ModifierSelectionModal({
  isOpen,
  modifiers,
  itemName,
  language,
  onConfirm,
  onCancel,
}: ModifierSelectionModalProps) {
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifierState>({})
  const [error, setError] = useState("")

  const handleConfirm = () => {
    // Only required groups participate in validation
    const requiredModifiers = modifiers.filter((modifier) => modifier.is_required)

    // Helper: does a group have at least one selected option?
    const hasSelection = (modifierId: string) =>
      Boolean(selectedModifiers[modifierId] && selectedModifiers[modifierId].size > 0)

    let isValid: boolean

    if (requiredModifiers.length > 1) {
      // Multiple required groups (e.g. "staff" and "manager"):
      // Use OR logic — passing as long as AT LEAST ONE option is selected in ANY group.
      isValid = requiredModifiers.some((modifier) => hasSelection(modifier.id))
    } else {
      // Single required group: keep the original behavior (must select from it).
      isValid = requiredModifiers.every((modifier) => hasSelection(modifier.id))
    }

    if (!isValid) {
      setError(
        requiredModifiers.length > 1
          ? "Please select at least one option"
          : "Please select at least one option for each required field",
      )
      return
    }

    // Pass the raw selectedModifiers state to the caller
    // Caller will implement the loop logic to create separate cart items for each selected option
    console.log("[v0] Modal handleConfirm passing selectedModifiers state:", selectedModifiers)
    onConfirm(selectedModifiers)
    setSelectedModifiers({})
    setError("")
  }

  const handleCancel = () => {
    setSelectedModifiers({})
    setError("")
    onCancel()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle>{itemName}</DialogTitle>
          <DialogDescription>
            {language === "ko" ? "필수 선택 항목을 선택해주세요" : "Please select required options"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-y-auto max-h-[60vh] flex-1 -mx-6 px-6">
          {modifiers.map((modifier) => (
            <div key={modifier.id} className="space-y-3">
              <Label className="text-base font-medium">{modifier.group_name_ko}</Label>
              <div className="space-y-2">
                {modifier.modifier_options.map((option) => (
                  <div key={option.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={option.id}
                      checked={selectedModifiers[modifier.id]?.has(option.id) || false}
                      onCheckedChange={(checked) => {
                        // Create a new Set from the current selections (or empty Set)
                        const currentSet = new Set(selectedModifiers[modifier.id] || [])
                        
                        if (checked) {
                          // Add the option ID to the set
                          currentSet.add(option.id)
                          console.log("[v0] Added option to set:", option.id, "Current set:", Array.from(currentSet))
                        } else {
                          // Remove the option ID from the set
                          currentSet.delete(option.id)
                          console.log("[v0] Removed option from set:", option.id, "Current set:", Array.from(currentSet))
                        }
                        
                        // Update state with the new set
                        setSelectedModifiers((prev) => ({
                          ...prev,
                          [modifier.id]: currentSet,
                        }))
                      }}
                    />
                    <Label
                      htmlFor={option.id}
                      className="font-normal cursor-pointer flex-1 py-2 px-3 rounded hover:bg-muted/50 transition-colors"
                    >
                      {option.option_label_ko}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>

        <DialogFooter className="gap-2 shrink-0 border-t pt-4 mt-auto">
          <Button variant="outline" onClick={handleCancel}>
            {language === "ko" ? "취소" : "Cancel"}
          </Button>
          <Button onClick={handleConfirm} className="bg-primary text-primary-foreground">
            {language === "ko" ? "확인 및 추가" : "Confirm & Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
