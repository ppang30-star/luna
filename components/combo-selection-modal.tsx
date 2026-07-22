"use client"

import { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useTranslatedText } from "@/hooks/use-translated-text"
import type { ComboOptionGroup } from "@/lib/combo-options"
import type { ComboSelectedOption } from "@/lib/cart-context"

interface ComboSelectionModalProps {
  isOpen: boolean
  itemName: string
  groups: ComboOptionGroup[]
  language: string
  onConfirm: (selected: ComboSelectedOption[]) => void
  onCancel: () => void
}

// A single selectable option row — translates the Korean item name at render time
// using the SAME translateText mechanism as the Main Menu (via useTranslatedText).
function OptionRow({
  group,
  item,
  checked,
  language,
  onToggle,
}: {
  group: ComboOptionGroup
  item: { id: string; name: string }
  checked: boolean
  language: string
  onToggle: (checked: boolean) => void
}) {
  const label = useTranslatedText(item.name, language)
  const domId = `${group.id}:${item.id}`
  return (
    <div className="flex items-center space-x-2">
      <Checkbox id={domId} checked={checked} onCheckedChange={(c) => onToggle(Boolean(c))} />
      <Label
        htmlFor={domId}
        className="font-normal cursor-pointer flex-1 py-2 px-3 rounded hover:bg-muted/50 transition-colors"
      >
        {label}
      </Label>
    </div>
  )
}

// Group heading — also translated at render time.
function GroupHeading({ name, language }: { name: string; language: string }) {
  const label = useTranslatedText(name, language)
  return <Label className="text-base font-medium">{label}</Label>
}

export function ComboSelectionModal({
  isOpen,
  itemName,
  groups,
  language,
  onConfirm,
  onCancel,
}: ComboSelectionModalProps) {
  // Map of groupId -> Set of selected itemIds
  const [selected, setSelected] = useState<Record<string, Set<string>>>({})
  const [error, setError] = useState("")

  const totalSelected = useMemo(
    () => Object.values(selected).reduce((sum, set) => sum + set.size, 0),
    [selected],
  )

  const toggle = (groupId: string, itemId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev[groupId] ?? [])
      if (checked) next.add(itemId)
      else next.delete(itemId)
      return { ...prev, [groupId]: next }
    })
  }

  const reset = () => {
    setSelected({})
    setError("")
  }

  const handleConfirm = () => {
    if (totalSelected === 0) {
      setError(language === "ko" ? "옵션을 최소 1개 이상 선택해주세요" : "Please select at least one option")
      return
    }
    // Flatten selections into ComboSelectedOption[], each defaulting to quantity 1.
    const result: ComboSelectedOption[] = []
    for (const group of groups) {
      const set = selected[group.id]
      if (!set) continue
      for (const item of group.items) {
        if (set.has(item.id)) {
          result.push({
            groupId: group.id,
            groupName: group.name,
            itemId: item.id,
            itemName: item.name,
            quantity: 1,
          })
        }
      }
    }
    onConfirm(result)
    reset()
  }

  const handleCancel = () => {
    reset()
    onCancel()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{itemName}</DialogTitle>
          <DialogDescription>
            {language === "ko" ? "원하는 옵션을 선택해주세요" : "Please choose your options"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {groups.map((group) => (
            <div key={group.id} className="space-y-3">
              <GroupHeading name={group.name} language={language} />
              <div className="space-y-2">
                {group.items.map((item) => (
                  <OptionRow
                    key={item.id}
                    group={group}
                    item={item}
                    checked={selected[group.id]?.has(item.id) || false}
                    language={language}
                    onToggle={(c) => toggle(group.id, item.id, c)}
                  />
                ))}
              </div>
            </div>
          ))}

          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>

        <DialogFooter className="gap-2">
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
