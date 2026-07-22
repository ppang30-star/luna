## 📋 즉시 실행해야 할 SQL (복사/붙여넣기용)

### Supabase 대시보드 → SQL Editor에 붙여넣고 실행

```sql
-- menu_items 테이블에 can_adjust 필드 추가
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS can_adjust BOOLEAN DEFAULT FALSE;

-- 기존 RLS 정책 모두 삭제
DROP POLICY IF EXISTS "Allow public delete" ON menu_items;
DROP POLICY IF EXISTS "Allow public read access" ON menu_items;
DROP POLICY IF EXISTS "Allow public insert" ON menu_items;
DROP POLICY IF EXISTS "Allow public update" ON menu_items;

-- RLS 정책 재생성 (완전한 UPDATE 정책 포함)
CREATE POLICY "Allow public select" ON menu_items FOR SELECT USING (TRUE);
CREATE POLICY "Allow public insert" ON menu_items FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Allow public update" ON menu_items FOR UPDATE USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Allow public delete" ON menu_items FOR DELETE USING (TRUE);

-- ✅ 검증 쿼리
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name='menu_items' 
ORDER BY ordinal_position;
```

### ✅ 예상 결과
- menu_items 테이블에 **can_adjust BOOLEAN** 컬럼이 추가됨
- RLS 정책 4개가 활성화됨 (SELECT, INSERT, UPDATE, DELETE)
- 모든 작업(CRUD)이 public access 허용

---

## 📊 코드 변경 요약

### 파일 1: `/vercel/share/v0-project/hooks/use-realtime-menu.ts`
**변경 내용**: `appMenuItemToDb()` 함수에 `can_adjust` 필드 추가

```typescript
// Before (Line 104-128)
export function appMenuItemToDb(appItem: any, sortOrder: number = 0) {
  return {
    // ... 다른 필드들 ...
    sort_order: sortOrder,
    // ❌ can_adjust_price 필드가 없음!
  }
}

// After (Line 104-129)
export function appMenuItemToDb(appItem: any, sortOrder: number = 0) {
  return {
    // ... 다른 필드들 ...
    sort_order: sortOrder,
    can_adjust: appItem.can_adjust_price || appItem.can_adjust || false, // ✅ 추가됨
  }
}
```

### 파일 2: `/vercel/share/v0-project/app/admin/page.tsx`
**변경 내용**: 
1. 에러/성공 상태 추가
2. 상세 에러 메시지 포함
3. UI 알림 컴포넌트 추가

```typescript
// 상태 추가
const [saveError, setSaveError] = useState<string | null>(null)
const [saveSuccess, setSaveSuccess] = useState(false)

// handleAddItem 개선
try {
  // ... 저장 로직 ...
  setSaveSuccess(true)
} catch (error: any) {
  const errorMessage = error?.message || error?.details || error?.hint || JSON.stringify(error)
  setSaveError(errorMessage)  // ✅ 상세 메시지 저장
}

// UI에 알림 렌더링
{saveError && <div className="...error notification...">{saveError}</div>}
{saveSuccess && <div className="...success notification...">저장 완료</div>}
```

### 파일 3: `/vercel/share/v0-project/lib/supabase/actions.ts`
**변경 사항**: 없음 (자동으로 appMenuItemToDb의 can_adjust를 포함하여 저장됨)

---

## 🎯 현재 상태

### ✅ 완료된 것
- [x] `menu_items` 테이블에 `can_adjust` 필드 추가 (마이그레이션 SQL 제공)
- [x] `appMenuItemToDb()` 함수에 `can_adjust` 필드 매핑 추가
- [x] `updateMenuItem()` 함수가 자동으로 can_adjust를 DB로 전송
- [x] 에러 메시지 상세화 (error.message, error.details, error.hint 모두 표시)
- [x] UI 알림 시스템 추가 (토스트 형식)
- [x] 완전한 RLS UPDATE 정책 (WITH CHECK 포함)

### ⚠️ 사용자가 해야 할 것
1. Supabase SQL Editor에서 위의 SQL 실행
2. 페이지 새로고침 (F5)
3. 메뉴 편집 → "Manager Price Edit" 체크박스 확인
4. 체크박스 체크 → 저장 → 성공 메시지 확인

---

## 🔍 데이터 흐름

```
UI 폼 (menu-form.tsx)
  ↓
can_adjust_price: boolean ← 체크박스 상태
  ↓
handleAddItem() (admin/page.tsx)
  ↓
updateMenuItem() (supabase/actions.ts)
  ↓
appMenuItemToDb() ← ✅ can_adjust 필드 추가됨
  ↓
Supabase UPDATE query
  ↓
menu_items.can_adjust = TRUE/FALSE
  ↓
✅ DB 저장 완료 (or ✅ 상세 에러 메시지 표시)
```

---

## 🚀 다음 단계 (선택사항)

1. **가격 조정 모달 통합**: price-adjustment-modal.tsx에서 can_adjust = TRUE인 메뉴만 표시
2. **감사 로그**: price_adjustment_logs 테이블에 모든 변경 기록
3. **관리자 승인 워크플로우**: 가격 조정 요청 → 승인 → 적용

---

## ❌ 문제해결

### "저장 실패: new row violates row-level security policy"
→ SQL을 아직 실행하지 않았음. 위의 SQL을 모두 실행하세요.

### "저장 실패: column 'can_adjust' doesn't exist"
→ 첫 번째 ALTER TABLE 쿼리를 실행하지 않았음.

### 체크박스가 폼에 보이지 않음
→ 페이지 새로고침 (F5)를 하세요.

### 저장했는데 체크박스가 여전히 OFF
→ 페이지 새로고침 후 다시 편집해서 확인하세요.
