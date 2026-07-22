"use client"

import { useContext } from "react"
import { MapPin } from "lucide-react"
import { LanguageContext } from "@/lib/context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface TableSelectorProps {
  tables: string[]
  onTableSelect: (table: string) => void
  currentTable: string | null
}

const translations = {
  ko: {
    selectTable: "테이블 선택",
    currentTable: "현재 테이블",
    noTableSelected: "테이블 선택",
    tablePrefix: "테이블",
  },
  en: {
    selectTable: "Select Table",
    currentTable: "Current Table",
    noTableSelected: "Select Table",
    tablePrefix: "Table",
  },
  vi: {
    selectTable: "Chọn Bàn",
    currentTable: "Bàn Hiện Tại",
    noTableSelected: "Chọn Bàn",
    tablePrefix: "Bàn",
  },
  ja: {
    selectTable: "テーブル選択",
    currentTable: "現在のテーブル",
    noTableSelected: "テーブル選択",
    tablePrefix: "テーブル",
  },
  zh: {
    selectTable: "选择桌号",
    currentTable: "当前桌号",
    noTableSelected: "选择桌号",
    tablePrefix: "桌号",
  },
  es: {
    selectTable: "Seleccionar Mesa",
    currentTable: "Mesa Actual",
    noTableSelected: "Seleccionar Mesa",
    tablePrefix: "Mesa",
  },
  th: {
    selectTable: "เลือกโต๊ะ",
    currentTable: "โต๊ะปัจจุบัน",
    noTableSelected: "เลือกโต๊ะ",
    tablePrefix: "โต๊ะ",
  },
}

export default function TableSelector({ tables, onTableSelect, currentTable }: TableSelectorProps) {
  const language = useContext(LanguageContext) as keyof typeof translations
  const t = translations[language] || translations.ko

  // Don't render if no tables are available
  if (!tables || tables.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentTable || ""}
        onValueChange={(value) => {
          if (value) {
            onTableSelect(value)
          }
        }}
      >
        <SelectTrigger className="w-[140px] sm:w-[160px] bg-card border-border">
          <SelectValue placeholder={t.noTableSelected}>
            {currentTable ? (
              <span className="flex items-center gap-2">
                <MapPin size={14} className="text-primary shrink-0" />
                <span className="font-medium truncate">{currentTable}</span>
              </span>
            ) : (
              <span className="flex items-center gap-2 text-muted-foreground">
                <MapPin size={14} className="shrink-0" />
                <span>{t.noTableSelected}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-card border-border max-h-[300px]">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border mb-1">
            {t.selectTable}
          </div>
          {tables.map((table) => (
            <SelectItem
              key={table}
              value={table}
              className="cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <MapPin
                  size={14}
                  className={currentTable === table ? "text-primary" : "text-muted-foreground"}
                />
                <span className="font-medium">{table}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
