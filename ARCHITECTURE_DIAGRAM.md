# Menu Modifiers - Architecture & Data Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TABLET MENU APP                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────┐    ┌────────────────────────────────┐  │
│  │    ADMIN DASHBOARD              │    │     CLIENT ORDER SCREEN        │  │
│  │                                 │    │                                │  │
│  │  • Menu Item Manager            │    │  • Menu Browse                 │  │
│  │  • Modifier Manager             │    │  • Item Detail Modal           │  │
│  │  • Category Manager             │    │  • Modifier Selection Modal    │  │
│  │  • Edit/Delete Modifiers        │    │  • Cart Display                │  │
│  │  • Add/Edit Options             │    │  • Order Confirmation          │  │
│  │                                 │    │                                │  │
│  └────────┬────────────────────────┘    └────────┬─────────────────────┘  │
│           │                                     │                         │
│           │ EDIT MENU ITEMS                     │ BROWSE & ORDER        │
│           │ CREATE MODIFIERS                    │ SELECT OPTIONS        │
│           └──────────────────┬───────────────────┘                       │
│                              │                                           │
│                    ┌─────────▼──────────┐                               │
│                    │ React Components   │                               │
│                    │                    │                               │
│                    │ • menu-form.tsx    │                               │
│                    │ • menu-display.tsx │                               │
│                    │ • cart-popup.tsx   │                               │
│                    │ • modifier-        │                               │
│                    │   manager.tsx      │                               │
│                    │ • modifier-        │                               │
│                    │   selection-       │                               │
│                    │   modal.tsx        │                               │
│                    └──────────┬─────────┘                               │
│                               │                                         │
│                    ┌─────────▼──────────┐                               │
│                    │  Supabase Client   │                               │
│                    │  API Actions       │                               │
│                    │                    │                               │
│                    │ • getMenuModifiers │                               │
│                    │ • addMenuModifier  │                               │
│                    │ • deleteMenuModifier                               │
│                    │ • addModifierOption                                │
│                    │ • updateModifier*  │                               │
│                    └──────────┬─────────┘                               │
│                               │                                         │
└───────────────────────────────┼─────────────────────────────────────────┘
                                │
                    ┌───────────▼──────────┐
                    │   SUPABASE          │
                    │  PostgreSQL DB      │
                    └───────────┬──────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼────┐  ┌───────▼────┐  ┌──────▼─────┐
        │   menu_    │  │  modifier_ │  │  modifier_ │
        │   items    │  │  modifiers │  │  options   │
        │            │  │            │  │            │
        │ id         │  │ id         │  │ id         │
        │ name_*     │  │ menu_item_ │  │ modifier_  │
        │ price      │  │ id         │  │ id         │
        │ ...        │  │ group_name_│  │ option_    │
        │            │  │ is_required│  │ value      │
        │            │  │ sort_order │  │ label_*    │
        │            │  │ ...        │  │ sort_order │
        └────────────┘  └────────────┘  └────────────┘
             ▲                ▲                ▲
             │                │                │
             └────────────────┼────────────────┘
                    1:N        1:N
               RELATIONSHIPS
```

## Data Flow: User Orders with Modifiers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER ORDERING FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: MENU BROWSE
┌─────────────────┐
│  User browses   │
│  menu items     │ ──────┐
│  • Image        │       │
│  • Name         │       │ Display from menu_items table
│  • Price        │       │
└─────────────────┘───────┘

STEP 2: ITEM SELECTION
┌─────────────────────────────────────────────┐
│  User taps menu item                        │
│  detail modal appears                       │
│  shows: description, image, price           │
│  [Add to Cart] button visible               │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 3: MODIFIER CHECK                                             │
│                                                                     │
│  Query: SELECT * FROM menu_modifiers                               │
│         WHERE menu_item_id = selected_item_id                      │
│                                                                     │
│  Result: Modifiers found? YES ──┐                                  │
│                          NO  ──┐ │                                 │
│                                 │ │                                │
│                                 │ └─→ Add directly to cart         │
│                                 │     (existing flow)              │
│                                 │                                  │
│                                 └─→ Show ModifierSelectionModal    │
│                                     (new flow)                     │
└─────────────────────────────────────────────────────────────────────┘
                       │
                       ▼
STEP 4: MODIFIER SELECTION (IF MODIFIERS EXIST)
┌────────────────────────────────────────────────┐
│  Modal appears: "Lady Charge"                  │
│  "Please select required options"              │
│                                                │
│  Staff List:                                   │
│  ◉ John          ← Selected                    │
│  ○ Jane                                        │
│  ○ Bob                                         │
│                                                │
│  [Cancel]  [Confirm & Add]                    │
└────────────────┬─────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  STEP 5: CART ADDITION                                   │
│                                                          │
│  Create CartItem:                                        │
│  {                                                       │
│    id: "item_123",                                       │
│    cartItemKey: "item_123_timestamp_random",            │
│    nameKo: "Lady Charge",                              │
│    price: 450000,                                        │
│    quantity: 1,                                          │
│    selectedModifiers: [                                  │
│      {                                                   │
│        modifierId: "mod_001",                           │
│        modifierGroupName: "Staff List",                 │
│        selectedOption: "john",                          │
│        selectedOptionLabel: "John"                      │
│      }                                                   │
│    ]                                                     │
│  }                                                       │
│                                                          │
│  Add to cart state (CartContext)                        │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
STEP 6: CART DISPLAY
┌──────────────────────────────────────┐
│  Cart Popup Shows:                   │
│  ┌────────────────────────────────┐  │
│  │ Lady Charge                    │  │
│  │ Staff: John                    │  │
│  │ 450,000 KRW                    │  │
│  │ [-] 1 [+] [Edit] [Delete]      │  │
│  └────────────────────────────────┘  │
│                                       │
│  Total: 450,000 KRW                 │
│  [Place Order]                       │
└──────────────────────────────────────┘
```

## Admin Flow: Creating Modifiers

```
┌──────────────────────────────────────────────────────────┐
│           ADMIN MODIFIER CREATION FLOW                   │
└──────────────────────────────────────────────────────────┘

STEP 1: EDIT MENU ITEM
┌─────────────┐
│  Admin      │
│  opens menu │ ──────┐
│  item       │       │ Loads menu_items data
│             │       │ from Supabase
└─────────────┴───────┘

STEP 2: VIEW MODIFIER MANAGER
┌────────────────────────────────────┐
│  Modifier Manager Component         │
│  (components/admin/modifier-       │
│   manager.tsx)                     │
│                                    │
│  Input: "Add Group"                │
│  [+] Button                        │
│  ─────────────────────────────     │
│  Existing Groups: (none)           │
│  "No modifier groups yet"          │
└──────────────┬─────────────────────┘
               │
               ▼
STEP 3: CREATE MODIFIER GROUP
┌──────────────────────────────────────────────────┐
│  Admin enters group name: "Staff List"           │
│  Clicks [+] "Add Group" button                   │
│                                                 │
│  Action: INSERT into menu_modifiers             │
│  {                                              │
│    menu_item_id: "item_123",                   │
│    group_name_ko: "Staff List",                │
│    group_name_en: "Staff List",                │
│    group_name_ja: "スタッフリスト",             │
│    is_required: true,                          │
│    sort_order: 0                               │
│  }                                              │
└──────────────┬───────────────────────────────┘
               │
               ▼
STEP 4: ADD OPTIONS
┌──────────────────────────────────────────────────┐
│  Modifier group appears:                         │
│  ▼ Staff List (0 options)                       │
│                                                 │
│  Expanded view:                                 │
│  ▼ Staff List (3 options)                       │
│    [John] [X]                                   │
│    [Jane] [X]                                   │
│    [Bob]  [X]                                   │
│                                                 │
│  Input: "Add option"  [+]                       │
│                                                 │
│  Flow:                                          │
│  - Type: "John"                                 │
│  - Click [+]                                    │
│  - INSERT into modifier_options                 │
│    {                                            │
│      modifier_id: "mod_001",                   │
│      option_value: "john",                     │
│      option_label_ko: "John",                  │
│      sort_order: 0                             │
│    }                                            │
│  - Repeat for Jane, Bob                         │
└──────────────┬───────────────────────────────┘
               │
               ▼
STEP 5: SAVE MENU ITEM
┌──────────────────────────────┐
│  Admin clicks [Save] button  │
│                              │
│  Data persisted:             │
│  • menu_modifiers row        │
│  • All modifier_options rows │
│                              │
│  Confirmation: "Saved!"      │
└──────────────┬───────────────┘
               │
               ▼
STEP 6: VERIFICATION
┌──────────────────────────────────────┐
│  Edit item again → Modifiers visible │
│  Modifiers now active!               │
│                                      │
│  When users order:                   │
│  • Modal appears with options        │
│  • User selects required option      │
│  • Item added with modifier          │
└──────────────────────────────────────┘
```

## Database Relationships

```
menu_items (existing table)
┌──────────────────────────────────┐
│ id (UUID)                        │ ◄────┐
│ name_ko, name_en, ...           │      │
│ desc_ko, desc_en, ...           │      │
│ price_krw                        │      │
│ category_id                      │      │
│ image                            │      │
│ ...                              │      │
└──────────────────────────────────┘      │
                                          │
                              ┌───────────┴──────────────┐
                              │ 1:N Relationship         │
                              │ (One menu item can have  │
                              │  many modifier groups)   │
                              │                          │
                              ▼
menu_modifiers (new table)
┌──────────────────────────────────┐
│ id (UUID)                        │ ◄────┐
│ menu_item_id (FK) ───────────────┼────┐ │
│ group_name_ko                    │    │ │
│ group_name_en                    │    │ │
│ is_required (boolean)            │    │ │
│ sort_order                       │    │ │
│ created_at, updated_at           │    │ │
└──────────────────────────────────┘    │ │
                                        │ │
                              ┌─────────┴─┼──┐
                              │ 1:N Rel.   │  │
                              │ One        │  │
                              │ modifier   │  │
                              │ group has  │  │
                              │ many       │  │
                              │ options    │  │
                              │            │  │
                              ▼            │  │
modifier_options (new table)  │  │
┌──────────────────────────────────┐  │
│ id (UUID)                        │  │
│ modifier_id (FK) ────────────────┼──┘
│ option_value                     │
│ option_label_ko                  │
│ option_label_en                  │
│ sort_order                       │
│ created_at, updated_at           │
└──────────────────────────────────┘
```

## State Management Flow

```
React Component Hierarchy:

MenuDisplay
  │
  ├─ state: selectedMenuId
  ├─ state: showModifierModal
  ├─ state: currentItemForModifiers
  ├─ state: currentItemModifiers
  │
  └─ children:
      ├─ MenuItem (renders each item)
      │   └─ User clicks → shows detail modal
      │
      ├─ ModifierSelectionModal
      │   ├─ state: selectedModifiers (radio selections)
      │   ├─ state: error
      │   └─ onConfirm → calls addItem(itemWithModifiers)
      │
      ├─ CartPopup
      │   ├─ CartContext.cart (all items)
      │   └─ Displays: item.selectedModifiers
      │
      └─ MenuForm (admin)
          ├─ ModifierManager
          │   ├─ state: modifiers (fetched from DB)
          │   ├─ state: expandedModifierId
          │   ├─ state: newOptionValues
          │   └─ CRUD operations for modifiers


CartContext (Global State):
  │
  ├─ cart: CartItem[]
  │   └─ CartItem includes:
  │       ├─ id (menu_item_id)
  │       ├─ cartItemKey (unique per instance)
  │       ├─ nameKo, nameEn, ...
  │       ├─ priceKRW, priceAmount
  │       ├─ quantity
  │       └─ selectedModifiers: SelectedModifier[]
  │           └─ SelectedModifier:
  │               ├─ modifierId
  │               ├─ modifierGroupName
  │               ├─ selectedOption
  │               └─ selectedOptionLabel
  │
  ├─ addItem(item: CartItem)
  ├─ removeItem(cartItemKey: string)
  ├─ updateQuantity(cartItemKey: string, qty: number)
  └─ updatePrice(cartItemKey: string, price: number)
```

## API Call Sequence

```
USER FLOW: Ordering with Modifiers

┌─ MenuDisplay: User clicks "Add to Cart"
│
├─ FETCH: getMenuModifiers(itemId)
│  └─ DB: SELECT * FROM menu_modifiers
│         WHERE menu_item_id = itemId
│         LEFT JOIN modifier_options
│
├─ CHECK: Are modifiers found?
│  │
│  ├─ YES: Show ModifierSelectionModal
│  │
│  └─ NO: Add directly to cart (existing flow)
│
├─ USER: Selects options in modal
│
├─ Action: Call onConfirm(selectedModifiers)
│
├─ CREATE: CartItem with selectedModifiers
│
└─ CartContext: addItem(cartItem)
   └─ Cart updated with new item


ADMIN FLOW: Creating Modifiers

┌─ Admin: Edit menu item
│
├─ FETCH: getMenuModifiers(itemId)
│  └─ DB: SELECT * FROM menu_modifiers
│
├─ Admin: Clicks "Add Group"
│
├─ INSERT: addMenuModifier(groupData)
│  └─ DB: INSERT INTO menu_modifiers
│
├─ Admin: Enters option name
│
├─ INSERT: addModifierOption(optionData)
│  └─ DB: INSERT INTO modifier_options
│
├─ Repeat as needed
│
└─ Admin: Clicks "Save"
   └─ Menu item saved with modifiers active
```

## Component Communication

```
MenuDisplay
  │
  ├──────────► MenuItem
  │           (receives item data)
  │
  ├──────────► ModifierSelectionModal
  │           Props:
  │           • isOpen: boolean
  │           • modifiers: MenuModifier[]
  │           • itemName: string
  │           • language: string
  │           • onConfirm(selectedModifiers)
  │           • onCancel()
  │
  ├──────────► CartPopup
  │           Context: CartContext
  │           • Reads: cart items
  │           • Calls: onUpdateQuantity, onRemove
  │
  └──────────► MenuForm (admin)
              ├──────► ModifierManager
              │       Props:
              │       • menuItemId: string
              │
              └─────► Supabase Actions
                      (for CRUD operations)
```

---

This architecture ensures:
- ✅ Clean separation of concerns
- ✅ Reusable components
- ✅ Efficient data flow
- ✅ Scalable to multiple modifiers
- ✅ Backward compatible with existing items
