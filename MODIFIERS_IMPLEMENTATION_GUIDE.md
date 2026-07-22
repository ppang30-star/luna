# Menu Modifiers (Required Options) - Implementation Guide

## Overview
This document describes the implementation of the Menu Modifiers feature, which allows admin users to create required options (e.g., staff selection) that users must choose when ordering specific menu items.

## Database Schema

### New Tables
1. **menu_modifiers** - Groups of required options
   - `id` (UUID): Primary key
   - `menu_item_id` (UUID): Foreign key to menu_items
   - `group_name_*` (TEXT): Multi-language group names (e.g., "Staff List")
   - `is_required` (BOOLEAN): Whether selection is mandatory (default: true)
   - `sort_order` (INTEGER): Display order

2. **modifier_options** - Individual options within a group
   - `id` (UUID): Primary key
   - `modifier_id` (UUID): Foreign key to menu_modifiers
   - `option_value` (TEXT): Unique value (e.g., "john", "jane")
   - `option_label_*` (TEXT): Multi-language display labels
   - `sort_order` (INTEGER): Display order

## Admin Features

### ModifierManager Component (`components/admin/modifier-manager.tsx`)
- **Location**: Integrated into menu-form after editing an item
- **Features**:
  - Create modifier groups (e.g., "Staff List")
  - Add/edit/delete modifier options (e.g., "John", "Jane", "Bob")
  - Multi-language support for group and option names
  - Expandable UI to manage options within each group

### Usage in Admin
1. Admin opens a menu item for editing
2. Scrolls to "Required Options (Modifiers)" section
3. Clicks "Add Group" to create a new modifier group
4. Enters group name (e.g., "Staff List")
5. Expands the group and adds options (e.g., "John", "Jane", "Bob")
6. Options display in the client interface for users to select

## Client Features

### ModifierSelectionModal Component (`components/modifier-selection-modal.tsx`)
- **Trigger**: When user taps a menu item with required modifiers
- **Behavior**:
  - Modal displays with item name as title
  - Shows radio button list for each modifier group
  - User must select exactly one option per group
  - "Confirm & Add" button adds item to cart with selection

### Updated MenuDisplay Component
- **Change**: `handlePopupAddToCart` now checks for modifiers
- **Flow**:
  1. User taps menu item
  2. System fetches modifiers for that item
  3. If modifiers exist, shows ModifierSelectionModal
  4. If no modifiers, adds directly to cart (existing behavior)

### Cart Display with Modifiers
- **CartPopup Component**: Updated to display selected modifiers
- **Format**: Shows modifier group name and selected option
- **Example**: "Lady Charge (Staff: John, Shift: Morning)"

## Data Flow

```
User Action Flow:
1. User taps menu item → Detail modal opens
2. User clicks "Add to Cart" button
3. System checks getMenuModifiers(itemId)
4. If modifiers exist:
   - ModifierSelectionModal opens
   - User selects options for each group
   - User clicks "Confirm & Add"
   - Item added to cart with selectedModifiers
5. If no modifiers:
   - Item added directly to cart (existing behavior)

Cart Display Flow:
1. Item displays in cart with name and price
2. If selectedModifiers exist:
   - Each modifier group and selected option displayed below item name
   - Example: "Staff: John", "Shift: Morning"
3. User can adjust quantity or delete item
```

## Integration Points

### Updated Supabase Actions (`lib/supabase/actions.ts`)
- `getMenuModifiers(menuItemId)`: Fetch all modifiers for an item
- `addMenuModifier()`: Create a new modifier group
- `updateMenuModifier()`: Update modifier group details
- `deleteMenuModifier()`: Delete a modifier group
- `addModifierOption()`: Create a new option
- `updateModifierOption()`: Update option
- `deleteModifierOption()`: Delete option

### Updated Cart Context (`lib/cart-context.ts`)
- **New Interface**: `SelectedModifier` with modifierId, groupName, selectedOption
- **Updated CartItem**: Added `cartItemKey` and `selectedModifiers` fields
- **Purpose**: Track which modifiers were selected for each cart item

### Menu Display Updates (`components/menu-display.tsx`)
- **New State**: `showModifierModal`, `currentItemForModifiers`, `currentItemModifiers`
- **Updated Function**: `handlePopupAddToCart` now async and checks for modifiers
- **New Handler**: Modal confirmation handler that adds item with modifiers

## Multi-Language Support

All modifier names support 7 languages:
- Korean (ko)
- English (en)
- Japanese (ja)
- Chinese (zh)
- Spanish (es)
- Thai (th)
- Vietnamese (vi)

## Testing Checklist

- [ ] Admin can create modifier group for a menu item
- [ ] Admin can add multiple options to a group
- [ ] Modifier group displays in admin form
- [ ] User sees modal when tapping item with modifiers
- [ ] User must select option before confirming
- [ ] Item added to cart with modifier selection
- [ ] Cart displays selected modifier with item
- [ ] Modifier displays correctly in all languages
- [ ] Multiple modifier groups work correctly
- [ ] Items without modifiers still work (existing flow)

## Future Enhancements

- Optional modifiers (not all groups required)
- Pricing adjustments per option (e.g., extra staff member costs more)
- Modifier group validation (e.g., max selections)
- Pre-selected defaults
- Grouped options display (checkboxes vs radio buttons)

## Migration Steps

To apply this feature to an existing database:

1. Run the migration SQL:
```sql
-- Execute migrations/add_menu_modifiers.sql
psql -h <host> -U <user> -d <database> -f migrations/add_menu_modifiers.sql
```

2. Deploy code changes
3. Restart application
4. Admin can immediately start creating modifiers for existing items
