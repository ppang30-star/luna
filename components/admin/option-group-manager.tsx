"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, Save, X, Pencil, GripVertical } from "lucide-react"
import { useComboOptionGroups } from "@/hooks/use-combo-option-groups"
import {
  saveComboOptionGroup,
  deleteComboOptionGroup,
  type ComboOptionGroup,
} from "@/lib/combo-options"

// Global manager for reusable Combo Option Groups (e.g. "소주" containing "참이슬",
// "처음처럼"). Admins type Korean only; the User UI translates at render time.
export default function OptionGroupManager() {
  const { groups, refetch } = useComboOptionGroups()
  const [editing, setEditing] = useState<ComboOptionGroup | null>(null)
  const [saving, setSaving] = useState(false)

  const startNew = () => {
    setEditing({ id: `og_${Date.now()}`, name: "", items: [], sortOrder: groups.length })
  }

  const startEdit = (group: ComboOptionGroup) => {
    // Deep clone so cancel discards unsaved edits.
    setEditing({
      ...group,
      items: group.items.map((it) => ({ ...it })),
    })
  }

  const addItem = () => {
    if (!editing) return
    setEditing({
      ...editing,
      items: [...editing.items, { id: `oi_${Date.now()}_${editing.items.length}`, name: "" }],
    })
  }

  const updateItemName = (id: string, name: string) => {
    if (!editing) return
    setEditing({
      ...editing,
      items: editing.items.map((it) => (it.id === id ? { ...it, name } : it)),
    })
  }

  const removeItem = (id: string) => {
    if (!editing) return
    setEditing({ ...editing, items: editing.items.filter((it) => it.id !== id) })
  }

  const handleSave = async () => {
    if (!editing) return
    const name = editing.name.trim()
    if (!name) {
      alert("옵션 그룹 이름을 입력하세요. (예: 소주)")
      return
    }
    const items = editing.items
      .map((it) => ({ ...it, name: it.name.trim() }))
      .filter((it) => it.name)
    if (items.length === 0) {
      alert("옵션 항목을 최소 1개 이상 추가하세요. (예: 참이슬)")
      return
    }
    setSaving(true)
    try {
      await saveComboOptionGroup({ ...editing, name, items })
      setEditing(null)
      await refetch()
    } catch (err: any) {
      console.error("[v0] saveComboOptionGroup error:", err)
      alert("저장 실패: " + (err?.message || err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("이 옵션 그룹을 삭제하시겠습니까? 연결된 콤보에서도 제거됩니다.")) return
    try {
      await deleteComboOptionGroup(id)
      await refetch()
    } catch (err: any) {
      console.error("[v0] deleteComboOptionGroup error:", err)
      alert("삭제 실패: " + (err?.message || err))
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>콤보 옵션 그룹</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              한국어로만 입력하세요. 고객 화면에서는 선택된 언어로 자동 번역됩니다.
            </p>
          </div>
          {!editing && (
            <Button onClick={startNew} className="gap-2">
              <Plus className="w-4 h-4" /> 새 그룹
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div>
                <label className="text-sm font-medium">그룹 이름 (한국어)</label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="예: 소주"
                  className="mt-1"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">옵션 항목</label>
                  <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
                    <Plus className="w-3.5 h-3.5" /> 항목 추가
                  </Button>
                </div>
                {editing.items.length === 0 && (
                  <p className="text-sm text-muted-foreground">아직 항목이 없습니다. "항목 추가"를 눌러 주세요.</p>
                )}
                <div className="space-y-2">
                  {editing.items.map((it) => (
                    <div key={it.id} className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                      <Input
                        value={it.name}
                        onChange={(e) => updateItemName(it.id, e.target.value)}
                        placeholder="예: 참이슬"
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(it.id)}
                        aria-label="항목 삭제"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  <Save className="w-4 h-4" /> {saving ? "저장 중..." : "저장"}
                </Button>
                <Button variant="outline" onClick={() => setEditing(null)} className="gap-2">
                  <X className="w-4 h-4" /> 취소
                </Button>
              </div>
            </div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              등록된 옵션 그룹이 없습니다. "새 그룹"을 눌러 소주, 맥주 등 옵션 그룹을 만드세요.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map((group) => (
                <div key={group.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{group.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {group.items.map((it) => it.name).join(", ")}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(group)} aria-label="편집">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(group.id)}
                        aria-label="삭제"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
