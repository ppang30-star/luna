# 메뉴 매니저 가격수정 기능 - 완전한 해결책

## 🔍 문제 원인 분석

### 1. **테이블 필드 누락** ❌
- `menu_items` 테이블에 `can_adjust` 컬럼이 없음
- Supabase 스키마 확인 결과: id, name_*, desc_*, price_*, image, sort_order만 있음
- **can_adjust 필드가 완전히 빠져있음**

### 2. **데이터 변환 함수 불완전** ❌
- `appMenuItemToDb()` 함수에서 `can_adjust_price` 필드를 제외함
- 폼에서 입력한 `can_adjust_price` 값이 Supabase로 전송되지 않음

### 3. **RLS 정책 업데이트 필요** ❌
- menu_items 테이블의 UPDATE 정책이 불완전할 수 있음
- 정확한 WITH CHECK 절 필요

### 4. **UI 에러 메시지 부족** ❌
- 저장 실패 시 상세 에러 메시지가 보이지 않음
- 무엇이 실패했는지 알 수 없음

---

## ✅ 완전한 해결책

### Step 1: Supabase SQL 에디터에서 실행

Supabase 대시보드 → SQL Editor에서 다음 SQL을 모두 실행하세요:

```sql
-- Step 1: menu_items 테이블에 can_adjust 컬럼 추가
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS can_adjust BOOLEAN DEFAULT FALSE;

-- Step 2: RLS 정책 재설정 (기존 정책 삭제 후 재생성)
DROP POLICY IF EXISTS "Allow public delete" ON menu_items;
DROP POLICY IF EXISTS "Allow public read access" ON menu_items;
DROP POLICY IF EXISTS "Allow public insert" ON menu_items;
DROP POLICY IF EXISTS "Allow public update" ON menu_items;

-- Step 3: 새로운 RLS 정책 생성 (완전한 WITH CHECK 포함)
CREATE POLICY "Allow public select" ON menu_items FOR SELECT USING (TRUE);
CREATE POLICY "Allow public insert" ON menu_items FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Allow public update" ON menu_items FOR UPDATE USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Allow public delete" ON menu_items FOR DELETE USING (TRUE);

-- 확인: 테이블 구조
SELECT column_name, data_type FROM information_schema.columns WHERE table_name='menu_items' ORDER BY ordinal_position;
```

### Step 2: 코드 변경 (이미 적용됨)

✅ **appMenuItemToDb() 함수** - can_adjust 필드 추가됨
```typescript
export function appMenuItemToDb(appItem: any, sortOrder: number = 0) {
  return {
    // ... 다른 필드들 ...
    can_adjust: appItem.can_adjust_price || appItem.can_adjust || false,  // ← 추가됨
  }
}
```

✅ **admin/page.tsx** - 에러 메시지 개선됨
```typescript
// 저장 오류 시 상세 메시지 표시
setSaveError(errorMessage)

// UI에 에러/성공 알림 추가됨
{saveError && <div className="...">오류 발생...</div>}
{saveSuccess && <div className="...">저장 완료</div>}
```

---

## 🧪 테스트 절차

1. **Supabase SQL 실행** (위의 SQL 모두 복사/실행)
2. **관리자 로그인**
3. **메뉴 관리 → 위스키 카테고리 선택**
4. **"새 메뉴 추가" 클릭**
5. **폼 하단으로 스크롤 → "Manager Price Edit" 체크박스 표시됨**
6. **체크박스 ON → 저장 버튼 클릭**
7. **성공 메시지 표시되고 DB에 저장됨**
8. **메뉴 다시 열기 → 체크박스가 여전히 ON 상태**

---

## 🔧 메뉴 업데이트 검증 방법

Supabase SQL Editor에서 다음 쿼리 실행:

```sql
-- can_adjust 값이 TRUE로 저장된 메뉴 확인
SELECT id, name_ko, price_krw, can_adjust FROM menu_items WHERE can_adjust = TRUE LIMIT 5;

-- 모든 메뉴 필드 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='menu_items' 
ORDER BY ordinal_position;
```

---

## 🎯 핵심 변경 사항

| 항목 | 이전 | 현재 |
|------|------|------|
| **menu_items.can_adjust** | ❌ 없음 | ✅ BOOLEAN |
| **appMenuItemToDb()** | ❌ 필드 누락 | ✅ can_adjust 포함 |
| **RLS 정책** | ⚠️ 불완전 | ✅ WITH CHECK 포함 |
| **에러 메시지** | ❌ "Failed to add" | ✅ 상세 에러 표시 |
| **UI 알림** | ❌ Alert만 | ✅ 토스트 알림 추가 |

---

## ❓ 자주 묻는 질문

**Q: 체크박스를 체크했는데 여전히 "저장 실패"라고 나옵니다**
- A: 우측 상단 에러 메시지의 정확한 내용을 확인하세요. 대부분의 경우 SQL을 아직 실행하지 않았거나 RLS 정책이 없는 경우입니다.

**Q: SQL 실행 후 "Permission denied" 에러가 나옵니다**
- A: Supabase Service Role을 사용하거나, authenticated user로 로그인 후 정책을 다시 확인하세요.

**Q: 메뉴를 저장했는데 can_adjust 값이 안 보입니다**
- A: 페이지를 새로고침(F5) 하세요. 또는 브라우저 개발자 도구(F12) → Console에서 에러 메시지를 확인하세요.

---

## 📝 마이그레이션 파일 위치
- `/vercel/share/v0-project/migrations/fix_menu_items_can_adjust.sql`
