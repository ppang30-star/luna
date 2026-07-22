// 대시보드 통계 전용 분류/필터 규칙.
// sale_line_items 에는 식음료 구분 컬럼이 없으므로, 상위 메뉴는 카테고리로,
// 콤보 구성품(sub-item)은 옵션 그룹명(combo_group_ko) 키워드로 판별한다.

// 안주(음식) 카테고리 ID. 이 카테고리의 단품/상위 메뉴는 통계에서 제외한다.
export const FOOD_CATEGORY_IDS = new Set<string>(["dish"])

// 콤보 세트(상위 콤보 메뉴 자체) 카테고리 ID. 실제 소비된 주류/음료만 집계하기 위해
// 상위 콤보 세트 항목(예: "콤보1", "콤보2")은 통계에서 완전히 제외한다.
// (콤보 구성품인 실제 주류/음료는 line_type === 'combo_option' 로 별도 포함됨)
export const COMBO_SET_CATEGORY_IDS = new Set<string>(["combo"])

// "Lady Charge / 직원착석" 관련 항목은 이름 기준으로 완전히 제외한다.
export const LADY_CHARGE_KEYWORDS = [
  "직원착석",
  "lady charge",
  "ladycharge",
  "레이디차지",
  "레이디 차지",
  "레이디",
]

// 콤보 구성품 중 음식(안주)으로 간주할 옵션 그룹명 키워드 → 제외.
// 이 목록에 걸리지 않는 그룹은 주류/음료(drink)로 간주하여 포함한다.
export const FOOD_GROUP_KEYWORDS = [
  "안주",
  "food",
  "snack",
  "튀김",
  "요리",
  "dish",
  "안주류",
]

function normalize(value?: string | null): string {
  return (value ?? "").toLowerCase().trim()
}

/** 항목 이름이 Lady Charge / 직원착석 관련인지 판별 */
export function isLadyCharge(name?: string | null): boolean {
  const n = normalize(name)
  if (!n) return false
  return LADY_CHARGE_KEYWORDS.some((k) => n.includes(k.toLowerCase()))
}

/** 콤보 옵션 그룹명이 음식(안주)인지 판별 */
export function isFoodGroup(groupName?: string | null): boolean {
  const g = normalize(groupName)
  if (!g) return false
  return FOOD_GROUP_KEYWORDS.some((k) => g.includes(k))
}

export interface StatLineItem {
  line_type: string // 'item' | 'combo_option'
  parent_menu_id: string | null
  parent_name_ko: string | null
  parent_name_en: string | null
  combo_group_ko: string | null
  item_name_ko: string | null
  item_name_en: string | null
  quantity: number
  unit_price: number
}

/**
 * 통계 필터 규칙:
 *  - Lady Charge / 직원착석 완전 제외
 *  - 음식(안주) 완전 제외 (단품: 카테고리 dish / 콤보 구성품: 음식 그룹명)
 *  - 가격 조건: 일반 항목은 unit_price > 0 인 경우만 포함
 *  - 예외: 콤보 구성품(주류/음료)은 0원이어도 포함 (음식 구성품은 제외)
 */
export function shouldIncludeLine(
  row: StatLineItem,
  categoryOf: (menuId: string | null) => string | undefined,
): boolean {
  const displayName = row.item_name_ko || row.item_name_en || ""

  // 규칙 2: Lady Charge / 직원착석 제외 (구성품명 + 상위 메뉴명 모두 확인)
  if (isLadyCharge(displayName) || isLadyCharge(row.parent_name_ko)) {
    return false
  }

  if (row.line_type === "combo_option") {
    // 규칙 3 + 4: 콤보 구성품은 음식이면 제외, 주류/음료면 0원이어도 포함
    if (isFoodGroup(row.combo_group_ko)) return false
    return true
  }

  // line_type === 'item' (단품 또는 콤보 세트 자체)
  const category = categoryOf(row.parent_menu_id)

  // 신규 규칙: 상위 콤보 세트 항목 자체는 제외 (실제 주류/음료 구성품만 집계)
  if (category && COMBO_SET_CATEGORY_IDS.has(category)) return false

  // 규칙 3: 안주(음식) 카테고리 제외
  if (category && FOOD_CATEGORY_IDS.has(category)) return false

  // 규칙 4: 일반 항목은 가격 > 0 인 경우만 포함
  if (!(row.unit_price > 0)) return false

  return true
}

export type StatItemType = "combo_drink" | "combo_set" | "single"

/** 표시용 항목 유형 판별 */
export function resolveItemType(
  row: StatLineItem,
  categoryOf: (menuId: string | null) => string | undefined,
): StatItemType {
  if (row.line_type === "combo_option") return "combo_drink"
  if (categoryOf(row.parent_menu_id) === "combo") return "combo_set"
  return "single"
}
