export type MenuItemData = {
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
  priceKRW: number
  priceCurrency?: string
  priceAmount?: number
  image?: string
  can_adjust_price?: boolean
}

export const menuData: MenuItemData[] = []

export function getMenuData(): MenuItemData[] {
  return menuData
}

export function getDefaultMenuItem(): MenuItemData {
  return {
    id: "",
    category: "",
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
    priceKRW: 0,
    priceCurrency: "KRW",
    priceAmount: 0,
  }
}
