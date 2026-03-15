# Menu Management

A weekly menu planning and recipe management tool. Plan meals, manage recipes with step-by-step instructions, auto-generate weekly menus, and create shopping lists.

Ported from a Flutter desktop app to vanilla HTML/CSS/JS for use on phone and desktop.

## Features

- **Ingredient Management** - Add, edit, search, and delete ingredients
- **Recipe Management** - Create recipes with multi-step instructions, ingredient quantities, nutritional flags, and cooking/working times
- **Instruction Workflow** - Steps can produce outputs that later steps consume as inputs
- **Menu Configuration** - Configure 7 days x 3 meals with available cooking time per slot
- **Menu Generation** - Auto-generate weekly menus respecting cooking time constraints, nutritional balance, recipe types, and storage capabilities
- **Recipe Swapping** - Tap any meal in the generated menu to swap the recipe
- **People Count** - Adjust servings per meal slot
- **Shopping List** - Aggregated ingredient list from the menu, with owned amounts and remaining calculations
- **Cook Mode** - Step-by-step cooking guide with ingredient callouts, per-step timers with audio alerts, and servings multiplier
- **Data Persistence** - Auto-saves to localStorage; import/export as JSON files for backup and cross-device transfer
- **Responsive** - Works on both phone and desktop

## How to Run

Open `index.html` in a browser, or serve with any HTTP server:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000/web-projects/menu-management/`

## Tech Stack

Vanilla HTML, CSS, and JavaScript. No frameworks, no build step, no dependencies.

## Data Format

Compatible with the original Flutter app's `.tsr` / `.tsm` JSON format. Use the import/export buttons in the sidebar to transfer data.
