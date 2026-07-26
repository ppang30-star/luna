# Admin Dashboard Translation Fixes - Complete

## Issues Fixed

### 1. Hardcoded Japanese/Chinese Tab Name
**Problem:** The Staff Auth tab in the admin sidebar was hardcoded as `直員認証` (Japanese)
**Solution:** 
- Created new `staffAuthTab` translation key in all 7 languages in `admin-translations.ts`
- Updated `app/admin/page.tsx` line 350 to use `{t.staffAuthTab}` instead of hardcoded text
- Tab now displays correct language based on admin's selected language

### 2. Hardcoded Error/Success Messages in Staff Auth Manager
**Problem:** Internal error messages in `staff-auth-manager.tsx` were hardcoded in Japanese:
- Line 152: "現在のパスワードを入力してください"
- Line 175: "現在のパスワードが正しくありません"

**Solution:**
- Removed entire internal translation object from `staff-auth-manager.tsx` (lines 14-127)
- Added import of `adminTranslations` from `lib/admin-translations.ts`
- Updated component to use `adminTranslations` context instead of internal translations
- Replaced all hardcoded messages with proper translation keys:
  - `t.staffAuthPasswordEmpty`
  - `t.staffAuthPasswordMismatch`
  - `t.staffAuthPasswordUpdated` (and other messages)
- Updated all JSX labels to use new `staffAuth`-prefixed keys

## Translation Keys Added

All languages now have these staffAuth keys in `admin-translations.ts`:
- `staffAuthTab`: Short tab name (e.g., "직원 인증", "Staff Auth")
- `staffAuthTitle`: Full page title
- `staffAuthDescription`: Page description
- `staffAuthCurrentPassword`: Current password label
- `staffAuthNewPassword`: New password label
- `staffAuthConfirmPassword`: Confirm password label
- `staffAuthSetPassword`: Set password button
- `staffAuthUpdate`: Update button
- `staffAuthPasswordUpdated`: Success message
- `staffAuthPasswordMismatch`: Password mismatch error
- `staffAuthPasswordEmpty`: Empty password error
- `staffAuthPasswordTooShort`: Too short error
- `staffAuthError`: Generic error
- `staffAuthSuccess`: Success label
- `staffAuthWarning`: Warning label

## Languages Updated
- Korean (ko)
- English (en)
- Japanese (ja)
- Chinese (zh)
- Spanish (es)
- Thai (th)
- Vietnamese (vi)

## Testing
✓ Build successful (Next.js 16 compilation passed)
✓ All 7 languages have complete translations
✓ No more hardcoded text in Staff Auth manager
✓ Tab name now respects admin language selection
