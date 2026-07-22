"use client"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { adminTranslations } from "@/lib/admin-translations"

interface MenuListProps {
  items: any[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  language?: string
}

export default function MenuList({ items, onEdit, onDelete, language = "ko" }: MenuListProps) {
  const t = adminTranslations[language as keyof typeof adminTranslations]

  if (items.length === 0) {
    return <div className="text-center text-muted-foreground py-8">{t.noMenuItems}</div>
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.category}</TableHead>
            <TableHead>{t.nameKo}</TableHead>
            <TableHead>{t.price || t.priceKRWTable}</TableHead>
            <TableHead>{t.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.category}</TableCell>
              <TableCell className="font-medium">{item.nameKo}</TableCell>
              <TableCell>
                {item.priceCurrency === "VND" 
                  ? `${(item.priceAmount || item.priceKRW).toLocaleString("vi-VN")} VND`
                  : `₩${item.priceKRW.toLocaleString("ko-KR")}`
                }
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => onEdit(item.id)}>
                    {t.edit}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm(t.confirmDelete)) {
                        onDelete(item.id)
                      }
                    }}
                  >
                    {t.delete}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
