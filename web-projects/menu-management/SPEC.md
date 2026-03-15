# Menu Management - Web Port Specification

Port of the Flutter "Menu-Management" desktop app to vanilla HTML/CSS/JS for use on phone and desktop.

## Feature Inventory

Status key: [ ] Not started | [~] In progress | [x] Done | [-] Skipped (with reason)

### Data Models

- [x] **Ingredient** - id, name
- [x] **Recipe** - id, name, instructions, nutritional flags (carbs/proteins/vegetables), type (breakfast/meal/snack/dessert), meal availability (lunch/dinner), canBeStored, includeInMenuGeneration
- [x] **Instruction** - id, description, ingredientsUsed, workingTimeMinutes, cookingTimeMinutes, outputs (Results), inputs (Result IDs from previous steps)
- [x] **Quantity** - amount, unit (grams/centiliters/pieces/tablespoons/teaspoons)
- [x] **IngredientUsage** - ingredientId, quantity
- [x] **Result** - id, description (intermediate cooking outputs)
- [x] **Menu** - list of Meals
- [x] **Meal** - cooking (recipe + yield), mealTime (weekDay + mealType), people count
- [x] **MealTime** - weekDay (sat-fri), mealType (breakfast/lunch/dinner) (flattened into Meal fields)
- [x] **Cooking** - recipe reference, yield (0 = already cooked, N = cook N servings)
- [x] **MenuConfiguration** - weekDay, mealType, requiresMeal, availableCookingTimeMinutes

### Screens / Pages

- [x] **Navigation Hub** - Tab-based sidebar (desktop) / bottom bar (mobile) with Ingredients, Recipes, Menu
- [x] **Ingredients Page** - List, search, add, edit, delete ingredients with undo toast
- [x] **Recipes Page** - List, search, select recipe to edit, add new recipe, play/cook button per recipe
- [x] **Recipe Editor** - Edit name, type, nutritional flags, storage, menu inclusion, meal availability, reorderable instructions list
- [x] **Instruction Editor** - Dialog to edit description, working/cooking time, ingredients used (with quantities and units), inputs (from previous step outputs), outputs (intermediate results)
- [x] **Menu Configuration Page** - 7 days x 3 meals horizontal grid, toggle requiresMeal, set cooking time per slot
- [x] **Menu Display Page** - Generated menu as day cards, swap recipes per slot (dialog picker), adjust people count, copy/save/regenerate
- [x] **Shopping List Page** - Aggregated ingredients from menu, owned amount inputs, remaining calculation, mark-all-owned button, copy to clipboard
- [x] **Play Recipe Page** - Step-by-step cooking guide with ingredient list, inputs from previous steps, per-step timers with Web Audio beep, step navigation, servings multiplier, progress bar

### Core Logic

- [x] **Menu Generation Algorithm** - Full port of MenuGenerator with seeded PRNG, nutritional balance, cooking time constraints, recipe type matching, storage capability, repetition limits, gap-filling from previous moments
- [x] **Yield Calculation** - First chronological occurrence gets yield=total count, later occurrences yield=0
- [x] **Shopping List Aggregation** - Multiply ingredient quantities by people factor (across all shared meals) and yield, group by ingredient and unit
- [x] **Recipe Time Calculation** - Sum working/cooking times across instructions

### Data Persistence

- [x] **localStorage Save/Load** - Auto-saves ingredients, recipes, configurations, and current menu to browser localStorage
- [x] **JSON Export/Import** - Download/upload .json files (compatible with Flutter .tsr format) for backup and transfer between devices
- [x] **Menu Save/Load** - Save generated menus to localStorage and export as JSON; import menu from JSON/.tsm files

### UI/UX Features

- [x] **Responsive Layout** - Desktop: sidebar nav + scrollable main area. Mobile (<=640px): bottom tab bar, stacked cards
- [x] **Search/Filter** - Search ingredients and recipes by name (normalized, case-insensitive)
- [x] **Ingredient History** - Recently used ingredients shown when ingredient search field is focused/empty, with history icon
- [x] **Clipboard Copy** - Copy menu text and shopping list to clipboard
- [x] **Cooking Timers** - Per-step countdown timers with Web Audio API beep notification (looping)
- [x] **Recipe Markdown Export** - Export recipe as formatted markdown with servings multiplier and clipboard copy
- [x] **Drag-to-Reorder Instructions** - HTML5 Drag and Drop for reordering recipe steps
- [x] **Undo on Delete** - Toast with undo action for ingredient, recipe, and instruction deletion
- [x] **Searchable Ingredient Selector** - Instruction editor uses searchable input with inline ingredient creation
- [x] **Menu Hover Highlighting** - Shared recipes highlighted across meal slots on hover
- [x] **XSS Prevention** - All user content escaped via `escapeHtml()` before HTML insertion
- [x] **Dynamic Theme** - 8 color options + light/dark/system mode, stored in localStorage, live preview in dialog
- [x] **Input Detail Dialog** - Clicking input chips in play mode shows context dialog with source step description and "Go to Step" navigation

### Differences from Flutter Original

| Aspect | Flutter | Web Port |
|---|---|---|
| Persistence | File picker (.tsr/.tsm files) | localStorage + JSON export/import |
| Sound | audioplayers + timer.mp3 asset | Web Audio API oscillator beep |
| State Management | Provider (ChangeNotifier) | Plain JS object + imperative re-renders |
| Navigation | Navigator.push + NavigationRail | SPA with sidebar (desktop) / bottom bar (mobile) |
| Drag Reorder | ReorderableListView | HTML5 Drag and Drop API |
| Theme | Material 3 (Flutter) | CSS custom properties, Material-inspired color scheme |
| Data Format | Freezed + JSON serialization | Plain JS objects, same JSON structure |

## Architecture

```
menu-management/
  index.html          - Single HTML entry point
  style.css           - All styles (responsive, Material-inspired)
  app.js              - App state, navigation, all page renderers, dialog system
  models.js           - Data model factories, enums, utility functions
  menu-generator.js   - Menu generation algorithm (seeded PRNG, full port)
  persistence.js      - localStorage + JSON file import/export
  SPEC.md             - This specification document
  README.md           - Project documentation
```

## Data Schema (localStorage)

```json
{
  "menuMgmt_ingredients": [{"id": "...", "name": "..."}],
  "menuMgmt_recipes": [{"id": "...", "name": "...", "instructions": [...], ...}],
  "menuMgmt_configurations": [{"weekDay": 0, "mealType": 0, "requiresMeal": true, "availableCookingTimeMinutes": 60}],
  "menuMgmt_menu": {"meals": [{"cooking": {...}, "weekDay": 0, "mealType": 0, "people": 2}]}
}
```
