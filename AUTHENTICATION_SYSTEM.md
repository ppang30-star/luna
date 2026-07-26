# Multi-Language Staff Authentication System Implementation

## Overview
A comprehensive redesign of the multi-language flow, security, and authentication logic for the table ordering app. This system ensures all staff members must authenticate before accessing the menu.

## Key Features Implemented

### 1. **Admin Dashboard - Staff Auth Password Management**
- **Location**: `/components/admin/staff-auth-manager.tsx`
- **Tab**: Added "직員認証" (Staff Auth) tab to admin dashboard (super admin only)
- **Functionality**:
  - Set a common authentication password for all staff members
  - Update password with current password verification
  - Stored securely in localStorage (suitable for admin-side use)
  - Multi-language support (Korean, English, Japanese, Chinese, Spanish, Thai, Vietnamese)

### 2. **Multi-Language Initial Screen Security Flow**
- **Order**: Language Selection → Staff Auth Modal → Menu Access
- **Language Selection Modal** (WelcomePopup):
  - Appears first on initial load
  - Allows staff to select their preferred language
  - Stores language choice in localStorage

- **Staff Authentication Modal**:
  - Appears immediately after language selection
  - Text fully translated in selected language
  - Password input field
  - Error messages in selected language
  - Blocks all menu access until correct password entered

### 3. **10-Minute Auto Re-authentication Timer**
- **Implementation**: `lib/staff-auth-context.ts`
- **Features**:
  - Timer starts after successful authentication
  - Auto-triggers re-authentication modal if 10 minutes elapse
  - Timer controlled by `AUTH_TIMEOUT_MS = 10 * 60 * 1000`
  - Exemption checkbox disables timer completely (see below)

### 4. **Print Receipt Exemption Checkbox**
- **Location**: `StaffAuthModal` component
- **Label**: "[Do not require re-authentication until receipt is printed]"
- **Logic**:
  - When checked and authenticated: `exemptUntilPrint = true`
  - Timer does NOT start if exemption is enabled
  - Exemption remains valid until final bill/receipt process completes
  - After settlement is finalized, system resets to Language Selection → Auth flow

### 5. **Session Reset After Receipt Printing**
- **Handler**: `handleSessionReset()` in `/app/page.tsx`
- **Triggered by**: Bill printing completion (integrates with existing `PrintReceipt & Telegram Share` flow)
- **Actions**:
  - Clears table's cart (other tables untouched)
  - Clears selected table
  - Clears authentication state
  - Resets to Language Selection modal
  - Kills auto-authentication timer

## Technical Implementation

### Core Files Modified/Created

#### New Files:
1. `/lib/staff-auth-context.ts` - Auth state management and constants
2. `/components/staff-auth-modal.tsx` - Staff authentication modal UI
3. `/components/admin/staff-auth-manager.tsx` - Admin password manager

#### Modified Files:
1. `/app/page.tsx` - Main app flow with auth integration
2. `/lib/translations.ts` - Added staffAuth translations (all 7 languages)
3. `/app/admin/page.tsx` - Added staff auth tab to admin dashboard

### State Management
```typescript
// Auth Context
interface AuthState {
  isAuthenticated: boolean
  exemptUntilPrint: boolean
  lastAuthTime: number | null
}

// Storage Keys
AUTH_STORAGE_KEY = 'staffAuthState'
STAFF_PASSWORD_KEY = 'staffAuthPassword'
```

### Flow Diagram
```
User enters app
    ↓
[Language Selection Modal] - Shows if not shown before
    ↓
[Staff Auth Modal] - Shows immediately after language selected
    ↓
Staff enters password
    ↓
Password correct? 
    ├─ NO → Show error, clear field, stay on modal
    └─ YES → Proceed to next check
         ↓
         Checkbox checked? (Exempt until print)
         ├─ YES → No timer, full exemption until bill printed
         └─ NO → Start 10-minute timer
              ↓
              [Menu Access Granted]
              ↓
              10 minutes pass? (if not exempt)
              ├─ YES → Force re-authentication modal
              └─ NO → Stay authenticated
                   ↓
                   Bill printed & settlement completed?
                   ├─ YES → handleSessionReset() → Back to Language Selection
                   └─ NO → Continue using menu
```

### Translations Added
All translations support the staffAuth section with the following keys:
- `title` - Modal title
- `description` - Instructions
- `passwordPlaceholder` - Input placeholder
- `enterButton` - Submit button label
- `invalidPassword` - Error message for wrong password
- `emptyPassword` - Error message for empty password
- `exemptionCheckbox` - Checkbox label
- `accessBlocked` - Blocked access message

Supported languages:
- Korean (한국어)
- English
- Japanese (日本語)
- Chinese (中文)
- Spanish (Español)
- Thai (ไทย)
- Vietnamese (Tiếng Việt)

## How It Works

### Admin Setup
1. Go to Admin Dashboard → "직員認証" tab (super admin only)
2. Set a common password for all staff
3. Staff can update the password anytime by entering old password

### Staff Workflow
1. **First Time**: 
   - Language Selection Modal appears
   - Select language
   - Auth Modal appears with translated text
   - Enter password
   - Check exemption checkbox if desired
   - Submit

2. **Accessing Menu**:
   - Menu is only displayed if authenticated
   - If not authenticated, message shows "직원 인증이 필요합니다" (Staff authentication required)

3. **Timer Behavior**:
   - Without exemption: After 10 minutes, must re-authenticate
   - With exemption: No timer until bill is printed and table is settled

4. **After Bill Printing**:
   - System resets to initial state
   - Next customer starts fresh (Language Selection → Auth)

## Security Considerations

### Current Implementation:
- Password stored in browser localStorage (suitable for admin/super-admin setup)
- Suitable for trusted environments (restaurant staff at specific IP)

### For Production Enhancement:
- Consider backend authentication for more security
- Use secure hashing for password storage
- Implement IP whitelisting for staff devices
- Add audit logging for authentication events

## Configuration

### Change 10-Minute Timer:
Edit `/lib/staff-auth-context.ts`:
```typescript
export const AUTH_TIMEOUT_MS = 10 * 60 * 1000  // Change to desired milliseconds
```

### Change Password Storage:
Currently uses localStorage. For backend auth:
1. Create `/api/auth/verify` endpoint
2. Modify `handleStaffAuthenticate()` to call API
3. Implement server-side password verification

## Testing Checklist

- [ ] Admin can set staff password in dashboard
- [ ] Language selection appears on first load
- [ ] Auth modal appears after language selected
- [ ] Auth modal text is translated
- [ ] Wrong password shows error
- [ ] Empty password shows error
- [ ] Correct password grants access
- [ ] Menu only shows when authenticated
- [ ] 10-minute timer works (if exemption unchecked)
- [ ] Exemption checkbox works (no timer if checked)
- [ ] Session reset clears auth state
- [ ] After reset, language selection appears again
- [ ] All 7 language translations display correctly

## Future Enhancements

1. **Multi-staff Member System**: Store different passwords per staff member
2. **Activity Logging**: Log auth attempts and menu access
3. **Biometric Auth**: Add fingerprint/face recognition
4. **Role-Based Access**: Different menus/prices per staff role
5. **Break Time**: Automatic logout after inactivity
6. **Device Binding**: Lock auth to specific device MAC/IP
