"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface MenuItem {
  id: string
  category: string
  nameKo: string
  nameEn: string
  nameJa: string
  nameZh: string
  nameEs: string
  nameTh: string
  nameVi: string
  descKo: string
  descEn: string
  descJa: string
  descZh: string
  descEs: string
  descTh: string
  descVi: string
  priceKRW: number | string
  image: string
}

interface Category {
  id: string
  ko: string
  en: string
  ja: string
  zh: string
  es: string
  th: string
  vi: string
}

const getCategoryDisplayName = (category: Category, lang: string): string => {
  switch (lang) {
    case "ko":
      return category.ko
    case "en":
      return category.en
    case "ja":
      return category.ja
    case "zh":
      return category.zh
    case "es":
      return category.es
    case "th":
      return category.th
    case "vi":
      return category.vi
    default:
      return category.ko
  }
}

export default function SimpleMenuAdd() {
  const [categories, setCategories] = useState<Category[]>([])
  const [rows, setRows] = useState<Partial<MenuItem>[]>([])
  const [mounted, setMounted] = useState(false)
  const [language, setLanguage] = useState("ko")
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({})
  const [selectedFileNames, setSelectedFileNames] = useState<{ [key: number]: string }>({})

  useEffect(() => {
    const fetchCategories = () => {
      const saved = localStorage.getItem("menuCategories")
      if (saved) {
        try {
          setCategories(JSON.parse(saved))
        } catch (error) {
          console.error("카테고리 로드 실패:", error)
          setCategories([
            {
              id: "spirits",
              ko: "위스키/스피릿",
              en: "Spirits",
              ja: "ウイスキー",
              zh: "烈酒",
              es: "Licores",
              th: "เหล้า",
              vi: "Rượu mạnh",
            },
            { id: "beers", ko: "맥주", en: "Beer", ja: "ビール", zh: "啤酒", es: "Cerveza", th: "เบียร์", vi: "Bia" },
            { id: "wines", ko: "와인", en: "Wine", ja: "ワイン", zh: "葡萄酒", es: "Vino", th: "ไวน์", vi: "Rượu vang" },
            {
              id: "cocktails",
              ko: "칵테일",
              en: "Cocktails",
              ja: "カクテル",
              zh: "鸡尾酒",
              es: "Cócteles",
              th: "ค็อกเทล",
              vi: "Cocktail",
            },
            {
              id: "liqueurs",
              ko: "리큐르",
              en: "Liqueurs",
              ja: "リキュール",
              zh: "利口酒",
              es: "Licores",
              th: "ลิเคียร์",
              vi: "Liqueur",
            },
          ])
        }
      }
    }

    fetchCategories()
    setMounted(true)
  }, [])

  const handleAddRow = () => {
    const newRow: Partial<MenuItem> = {
      category: categories[0]?.id || "",
      nameKo: "",
      nameEn: "",
      nameJa: "",
      nameZh: "",
      nameEs: "",
      nameTh: "",
      nameVi: "",
      descKo: "",
      descEn: "",
      descJa: "",
      descZh: "",
      descEs: "",
      descTh: "",
      descVi: "",
      priceKRW: "", // 초기값을 0에서 빈 문자열로 변경
      image: "",
    }
    setRows([...rows, newRow])
  }

  const handleRowChange = (index: number, field: string, value: any) => {
    const updated = [...rows]
    updated[index] = { ...updated[index], [field]: value }
    setRows(updated)
  }

  const handleDeleteRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index))
  }

  const handleImageUpload = (index: number, file: File) => {
    setSelectedFileNames((prev) => ({ ...prev, [index]: file.name }))
    const reader = new FileReader()
    reader.onloadend = () => {
      handleRowChange(index, "image", reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveAll = () => {
    const validRows = rows.filter(
      // Allow a price of 0 (free items); only require that a numeric price was entered.
      (row) => row.category && row.nameKo && typeof row.priceKRW === "number" && row.priceKRW >= 0,
    )

    if (validRows.length === 0) {
      alert("저장할 유효한 메뉴 항목이 없습니다. 카테고리, 메뉴명, 가격을 입력해주세요.")
      return
    }

    const newItems = validRows.map((row) => ({
      ...row,
      id: row.id || Date.now().toString() + Math.random(),
    }))

    const saved = localStorage.getItem("menuItems")
    let allItems = []
    if (saved) {
      try {
        allItems = JSON.parse(saved)
      } catch (error) {
        console.error("기존 메뉴 로드 실패:", error)
      }
    }

    const updatedItems = [...allItems, ...newItems]
    localStorage.setItem("menuItems", JSON.stringify(updatedItems))

    alert(`${newItems.length}개의 메뉴가 저장되었습니다.`)
    setRows([])
  }

  if (!mounted || categories.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>새 메뉴 추가 (다중 행)</CardTitle>
        <CardDescription>여러 메뉴를 한 번에 추가할 수 있습니다. 카테고리, 메뉴명, 가격은 필수입니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Button onClick={handleAddRow} className="w-full bg-green-600 hover:bg-green-700 text-white">
          + 새 행 추가
        </Button>

        {rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
            <p>추가할 메뉴가 없습니다.</p>
            <p className="text-sm mt-1">위의 "새 행 추가" 버튼을 클릭하여 시작하세요.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {rows.map((row, index) => (
              <div key={index} className="border rounded-lg p-4 bg-card space-y-4">
                <div className="flex items-center justify-between pb-2 border-b">
                  <h4 className="font-semibold">
                    메뉴 #{index + 1} {row.nameKo && `- ${row.nameKo}`}
                  </h4>
                  <Button size="sm" variant="destructive" onClick={() => handleDeleteRow(index)}>
                    삭제
                  </Button>
                </div>

                {/* 카테고리 + 가격 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-1">
                      카테고리 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={row.category || ""}
                      onChange={(e) => handleRowChange(index, "category", e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
                    >
                      <option value="">선택...</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {getCategoryDisplayName(cat, language)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">
                      가격 (KRW) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      value={row.priceKRW || ""}
                      onChange={(e) =>
                        handleRowChange(index, "priceKRW", e.target.value ? Number.parseInt(e.target.value) : "")
                      } // 빈 값 허용
                      placeholder="450000"
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* 다국어 메뉴명 */}
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">
                      한국어 <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={row.nameKo || ""}
                      onChange={(e) => handleRowChange(index, "nameKo", e.target.value)}
                      placeholder="메뉴명"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">English</label>
                    <Input
                      value={row.nameEn || ""}
                      onChange={(e) => handleRowChange(index, "nameEn", e.target.value)}
                      placeholder="Menu name"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">日本語</label>
                    <Input
                      value={row.nameJa || ""}
                      onChange={(e) => handleRowChange(index, "nameJa", e.target.value)}
                      placeholder="メニュー名"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">中文</label>
                    <Input
                      value={row.nameZh || ""}
                      onChange={(e) => handleRowChange(index, "nameZh", e.target.value)}
                      placeholder="菜单名"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Español</label>
                    <Input
                      value={row.nameEs || ""}
                      onChange={(e) => handleRowChange(index, "nameEs", e.target.value)}
                      placeholder="Nombre"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">ไทย</label>
                    <Input
                      value={row.nameTh || ""}
                      onChange={(e) => handleRowChange(index, "nameTh", e.target.value)}
                      placeholder="ชื่อเมนู"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Tiếng Việt</label>
                    <Input
                      value={row.nameVi || ""}
                      onChange={(e) => handleRowChange(index, "nameVi", e.target.value)}
                      placeholder="Tên món"
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* 다국어 설명 */}
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">설명 (한국어)</label>
                    <Textarea
                      value={row.descKo || ""}
                      onChange={(e) => handleRowChange(index, "descKo", e.target.value)}
                      placeholder="메뉴 설명"
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Description</label>
                    <Textarea
                      value={row.descEn || ""}
                      onChange={(e) => handleRowChange(index, "descEn", e.target.value)}
                      placeholder="Description"
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">説明</label>
                    <Textarea
                      value={row.descJa || ""}
                      onChange={(e) => handleRowChange(index, "descJa", e.target.value)}
                      placeholder="説明"
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">描述</label>
                    <Textarea
                      value={row.descZh || ""}
                      onChange={(e) => handleRowChange(index, "descZh", e.target.value)}
                      placeholder="描述"
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Descripción</label>
                    <Textarea
                      value={row.descEs || ""}
                      onChange={(e) => handleRowChange(index, "descEs", e.target.value)}
                      placeholder="Descripción"
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">คำอธิบาย</label>
                    <Textarea
                      value={row.descTh || ""}
                      onChange={(e) => handleRowChange(index, "descTh", e.target.value)}
                      placeholder="คำอธิบาย"
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Mô tả</label>
                    <Textarea
                      value={row.descVi || ""}
                      onChange={(e) => handleRowChange(index, "descVi", e.target.value)}
                      placeholder="Mô tả"
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* 사진 업로드 */}
                <div>
                  <label className="text-sm font-medium block mb-2">사진 업로드</label>
                  <input
                    ref={(el) => {
                      fileInputRefs.current[index] = el
                    }}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        handleImageUpload(index, file)
                      }
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[index]?.click()}
                    className="w-full px-4 py-3 bg-[#FF8C00] hover:bg-[#E67E00] text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    파일 업로드
                  </button>
                  {selectedFileNames[index] && (
                    <p className="text-xs text-green-600 mt-2">✓ {selectedFileNames[index]}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF 등의 이미지 파일</p>
                </div>

                {/* 사진 미리보기 */}
                {row.image && (
                  <div>
                    <label className="text-sm font-medium block mb-1">미리보기</label>
                    <div className="relative w-full h-40 bg-muted rounded-md overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={(row.image as string) || "/placeholder.svg"}
                        alt="preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 저장 버튼 */}
        {rows.length > 0 && (
          <Button
            onClick={handleSaveAll}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3"
          >
            💾 모든 메뉴 저장 ({rows.length}개)
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
