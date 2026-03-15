// --- App State ---

/** @type {{ingredients: Array, recipes: Array, configurations: MenuConfiguration[], currentMenu: Menu|null, ingredientHistory: Array}} */
const appState = {
  ingredients: [],
  recipes: [],
  configurations: [],
  currentMenu: null,
  ingredientHistory: [],
};

/** @type {{type: string, item: *}|null} */
let lastDeleted = null;

// --- Default Configurations ---

function createDefaultConfigurations() {
  /** @type {MenuConfiguration[]} */
  const configs = [];
  const defaultTimes = {
    0: { 0: 60, 1: 60, 2: 60 },   // Saturday
    1: { 0: 60, 1: 60, 2: 10 },   // Sunday
    2: { 0: 60, 1: 0, 2: 60 },    // Monday
    3: { 0: 60, 1: 0, 2: 60 },    // Tuesday
    4: { 0: 60, 1: 0, 2: 60 },    // Wednesday
    5: { 0: 60, 1: 0, 2: 45 },    // Thursday
    6: { 0: 30, 1: 0, 2: 10 },    // Friday
  };
  for (let wd = 0; wd < 7; wd++) {
    for (let mt = 0; mt < 3; mt++) {
      configs.push(createMenuConfiguration({
        weekDay: wd, mealType: mt, requiresMeal: true,
        availableCookingTimeMinutes: defaultTimes[wd][mt],
      }));
    }
  }
  return configs;
}

// --- Initialization ---

function initApp() {
  appState.configurations = createDefaultConfigurations();
  loadAllFromStorage();
  renderCurrentView();
}

// --- Navigation ---

/** @type {"ingredients"|"recipes"|"menu"} */
let currentTab = "ingredients";
/** @type {string|null} */
let selectedRecipeId = null;
/** @type {"config"|"menu"|"shopping"|"play"} */
let menuSubView = "config";
/** @type {Recipe|null} */
let playingRecipe = null;

function switchTab(tab) {
  currentTab = tab;
  selectedRecipeId = null;
  menuSubView = "config";
  playingRecipe = null;
  renderCurrentView();
}

function renderCurrentView() {
  updateNavHighlight();
  const main = document.getElementById("main-content");
  main.innerHTML = "";

  switch (currentTab) {
    case "ingredients": renderIngredientsPage(main); break;
    case "recipes":
      if (playingRecipe) renderPlayRecipePage(main, playingRecipe);
      else if (selectedRecipeId) renderRecipeEditor(main, selectedRecipeId);
      else renderRecipesPage(main);
      break;
    case "menu":
      if (menuSubView === "menu" && appState.currentMenu) renderMenuPage(main, appState.currentMenu);
      else if (menuSubView === "shopping" && appState.currentMenu) renderShoppingPage(main, appState.currentMenu);
      else renderMenuConfigPage(main);
      break;
  }
}

function updateNavHighlight() {
  document.querySelectorAll(".nav-item").forEach(el => {
    el.classList.toggle("active", el.dataset.tab === currentTab);
  });
}

// --- Toast Notifications ---

/** @param {string} message @param {{duration?: number, action?: {label: string, callback: Function}}}} [opts] */
function showToast(message, opts = {}) {
  const duration = opts.duration || 4000;
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = "toast";

  const textSpan = document.createElement("span");
  textSpan.textContent = message;
  toast.appendChild(textSpan);

  if (opts.action) {
    const btn = document.createElement("button");
    btn.className = "toast-action";
    btn.textContent = opts.action.label;
    btn.addEventListener("click", () => {
      opts.action.callback();
      toast.remove();
    });
    toast.appendChild(btn);
  }

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// --- Helper: find ingredient name safely ---

function ingredientName(ingredientId) {
  const ing = appState.ingredients.find(i => i.id === ingredientId);
  return ing ? ing.name : "(deleted ingredient)";
}

// --- Ingredients Page ---

function renderIngredientsPage(container) {
  let searchTerm = "";

  function render() {
    const normalized = searchTerm.toLowerCase().replace(/\s+/g, "");
    const filtered = normalized
      ? appState.ingredients.filter(i => i.name.toLowerCase().replace(/\s+/g, "").includes(normalized))
      : [...appState.ingredients].sort((a, b) => a.name.localeCompare(b.name));

    container.innerHTML = `
      <div class="page-header">
        <h2>Ingredients</h2>
        <span class="header-count">${appState.ingredients.length}</span>
      </div>
      <div class="search-add-row">
        <div class="search-box">
          <span class="search-icon">&#128269;</span>
          <input type="text" id="ingredient-search" class="search-input" placeholder="Search or type to add..." value="${escapeHtml(searchTerm)}">
        </div>
        <button id="add-ingredient-btn" class="btn btn-primary">+ Add</button>
      </div>
      <div class="list-container" id="ingredients-list"></div>
    `;

    const listEl = document.getElementById("ingredients-list");
    if (filtered.length === 0 && !searchTerm) {
      listEl.innerHTML = '<div class="empty-state"><span class="empty-icon">&#127819;</span><p>No ingredients yet</p><p class="empty-hint">Add your first ingredient above</p></div>';
    } else if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><p>No matches for "${escapeHtml(searchTerm)}"</p></div>`;
    } else {
      for (const ing of filtered) {
        const row = document.createElement("div");
        row.className = "list-item";
        row.innerHTML = `
          <span class="list-item-name" data-id="${ing.id}">${escapeHtml(ing.name)}</span>
          <button class="btn btn-icon btn-danger-subtle" data-delete="${ing.id}" title="Delete">&#x2715;</button>
        `;
        listEl.appendChild(row);
      }
    }

    document.getElementById("ingredient-search").addEventListener("input", (e) => {
      searchTerm = e.target.value;
      render();
    });

    document.getElementById("add-ingredient-btn").addEventListener("click", () => {
      const name = searchTerm.trim() || "";
      showIngredientAddDialog(name);
    });

    listEl.querySelectorAll("[data-delete]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.delete;
        const ing = appState.ingredients.find(i => i.id === id);
        appState.ingredients = appState.ingredients.filter(i => i.id !== id);
        saveAllToStorage();
        render();
        showToast(`"${ing.name}" removed`, {
          duration: 5000,
          action: { label: "Undo", callback: () => {
            appState.ingredients.push(ing);
            saveAllToStorage();
            render();
          }},
        });
      });
    });

    listEl.querySelectorAll("[data-id]").forEach(el => {
      el.addEventListener("click", () => showIngredientEditDialog(el.dataset.id));
    });
  }

  render();
}

function showIngredientAddDialog(prefill) {
  showDialog("Add Ingredient", `
    <label class="field-label">Name
      <input type="text" id="dialog-ingredient-name" class="dialog-input" value="${escapeHtml(prefill || "")}" autofocus>
    </label>
  `, [
    { text: "Cancel", action: "close" },
    { text: "Add", primary: true, action: () => {
      const name = document.getElementById("dialog-ingredient-name").value.trim();
      if (!name) return false;
      const exists = appState.ingredients.some(i => i.name.trim().toLowerCase() === name.toLowerCase());
      if (exists) { showToast("Ingredient already exists"); return false; }
      appState.ingredients.push(createIngredient({ name }));
      saveAllToStorage();
      renderCurrentView();
      return true;
    }},
  ]);
}

function showIngredientEditDialog(ingredientId) {
  const ing = appState.ingredients.find(i => i.id === ingredientId);
  if (!ing) return;
  showDialog("Edit Ingredient", `
    <label class="field-label">Name
      <input type="text" id="dialog-ingredient-name" class="dialog-input" value="${escapeHtml(ing.name)}">
    </label>
  `, [
    { text: "Cancel", action: "close" },
    { text: "Save", primary: true, action: () => {
      const name = document.getElementById("dialog-ingredient-name").value.trim();
      if (!name) return false;
      ing.name = name;
      saveAllToStorage();
      renderCurrentView();
      return true;
    }},
  ]);
}

// --- Recipes Page ---

function renderRecipesPage(container) {
  let searchTerm = "";

  function render() {
    const normalized = searchTerm.toLowerCase().replace(/\s+/g, "");
    const filtered = normalized
      ? appState.recipes.filter(r => r.name.toLowerCase().replace(/\s+/g, "").includes(normalized))
      : [...appState.recipes].sort((a, b) => a.name.localeCompare(b.name));

    container.innerHTML = `
      <div class="page-header">
        <h2>Recipes</h2>
        <span class="header-count">${appState.recipes.length}</span>
      </div>
      <div class="search-add-row">
        <div class="search-box">
          <span class="search-icon">&#128269;</span>
          <input type="text" id="recipe-search" class="search-input" placeholder="Search recipes..." value="${escapeHtml(searchTerm)}">
        </div>
        <button id="add-recipe-btn" class="btn btn-primary">+ Add</button>
      </div>
      <div class="list-container" id="recipes-list"></div>
    `;

    const listEl = document.getElementById("recipes-list");
    if (filtered.length === 0 && !searchTerm) {
      listEl.innerHTML = '<div class="empty-state"><span class="empty-icon">&#128214;</span><p>No recipes yet</p><p class="empty-hint">Add your first recipe above</p></div>';
    } else if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><p>No matches for "${escapeHtml(searchTerm)}"</p></div>`;
    } else {
      for (const recipe of filtered) {
        const totalTime = recipeTotalTime(recipe);
        const typeLabel = RECIPE_TYPE_NAMES[recipe.type] || "";
        const row = document.createElement("div");
        row.className = "list-item recipe-list-item";
        row.innerHTML = `
          <div class="recipe-list-info" data-id="${recipe.id}">
            <span class="list-item-name">${escapeHtml(recipe.name)}</span>
            <span class="recipe-list-tags">
              <span class="tag tag-type">${escapeHtml(typeLabel)}</span>
              <span class="tag tag-time">${totalTime} min</span>
              ${recipe.canBeStored ? '<span class="tag tag-stored" title="Can be stored">&#10052;</span>' : ""}
            </span>
          </div>
          <button class="btn btn-icon btn-accent" data-play="${recipe.id}" title="Cook this recipe">&#9654;</button>
        `;
        listEl.appendChild(row);
      }
    }

    document.getElementById("recipe-search").addEventListener("input", (e) => {
      searchTerm = e.target.value;
      render();
    });

    document.getElementById("add-recipe-btn").addEventListener("click", () => showRecipeAddDialog());

    listEl.querySelectorAll("[data-id]").forEach(el => {
      el.addEventListener("click", () => {
        selectedRecipeId = el.closest("[data-id]")?.dataset.id || el.dataset.id;
        renderCurrentView();
      });
    });

    listEl.querySelectorAll("[data-play]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const recipe = appState.recipes.find(r => r.id === btn.dataset.play);
        if (!recipe || recipe.instructions.length === 0) {
          showToast("Add at least one step before cooking");
          return;
        }
        playingRecipe = recipe;
        renderCurrentView();
      });
    });
  }

  render();
}

function showRecipeAddDialog() {
  showDialog("Add Recipe", `
    <label class="field-label">Name
      <input type="text" id="dialog-recipe-name" class="dialog-input" autofocus>
    </label>
  `, [
    { text: "Cancel", action: "close" },
    { text: "Add", primary: true, action: () => {
      const name = document.getElementById("dialog-recipe-name").value.trim();
      if (!name) return false;
      const newRecipe = createRecipe({ name });
      appState.recipes.push(newRecipe);
      saveAllToStorage();
      selectedRecipeId = newRecipe.id;
      renderCurrentView();
      return true;
    }},
  ]);
}

// --- Recipe Editor ---

function renderRecipeEditor(container, recipeId) {
  const recipe = appState.recipes.find(r => r.id === recipeId);
  if (!recipe) { selectedRecipeId = null; renderCurrentView(); return; }

  function recipeTypeChips() {
    return Object.entries(RECIPE_TYPE_NAMES).map(([val, name]) => {
      const selected = recipe.type === Number(val);
      return `<button class="chip ${selected ? "chip-selected" : ""}" data-recipe-type="${val}">${name}</button>`;
    }).join("");
  }

  container.innerHTML = `
    <div class="page-header">
      <button class="btn btn-icon" id="recipe-back" title="Back to list">&#8592;</button>
      <h2 id="recipe-title">${escapeHtml(recipe.name)}</h2>
      <button class="btn btn-icon" id="recipe-edit-name" title="Edit name">&#9998;</button>
      <div class="spacer"></div>
      <button class="btn btn-secondary" id="recipe-export-md" title="Export to clipboard">&#128203; Export</button>
      <button class="btn btn-danger-subtle" id="recipe-delete">&#128465; Delete</button>
      <button class="btn btn-accent" id="recipe-play">&#9654; Cook</button>
    </div>

    <div class="recipe-config card">
      <div class="config-section">
        <div class="chip-group"><label>Type:</label>${recipeTypeChips()}</div>
      </div>
      <div class="config-section config-toggles">
        <label class="toggle-row">
          <span>Can be stored</span>
          <input type="checkbox" class="toggle-switch" id="recipe-stored" ${recipe.canBeStored ? "checked" : ""}>
        </label>
        <label class="toggle-row">
          <span>Include in menu generation</span>
          <input type="checkbox" class="toggle-switch" id="recipe-include" ${recipe.includeInMenuGeneration ? "checked" : ""}>
        </label>
      </div>
      <div class="config-section">
        <div class="chip-group"><label>Good for:</label>
          <button class="chip ${recipe.lunch ? "chip-selected" : ""}" id="toggle-lunch">Lunch</button>
          <button class="chip ${recipe.dinner ? "chip-selected" : ""}" id="toggle-dinner">Dinner</button>
        </div>
      </div>
      <div class="config-section">
        <div class="chip-group"><label>Contains:</label>
          <button class="chip ${recipe.carbs ? "chip-selected" : ""}" id="toggle-carbs">Carbs</button>
          <button class="chip ${recipe.proteins ? "chip-selected" : ""}" id="toggle-proteins">Protein</button>
          <button class="chip ${recipe.vegetables ? "chip-selected" : ""}" id="toggle-vegetables">Vegetables</button>
          ${!recipe.carbs && !recipe.proteins && !recipe.vegetables ? '<span class="warning-badge" title="No contents selected - may cause issues with menu generation">&#9888; None selected</span>' : ""}
        </div>
      </div>
    </div>

    <div class="section-header">
      <h3>Steps <span class="header-count">${recipe.instructions.length}</span></h3>
      <span class="section-meta">Total: ${recipeTotalTime(recipe)} min</span>
      <div class="spacer"></div>
      <button class="btn btn-primary" id="add-step-btn">+ Add Step</button>
    </div>
    <div id="instructions-list" class="instructions-list"></div>
  `;

  const instList = document.getElementById("instructions-list");
  if (recipe.instructions.length === 0) {
    instList.innerHTML = '<div class="empty-state"><p>No steps yet</p><p class="empty-hint">Add cooking steps to build your recipe</p></div>';
  } else {
    recipe.instructions.forEach((inst, index) => {
      const row = document.createElement("div");
      row.className = "list-item instruction-item";
      row.draggable = true;
      row.dataset.index = index;
      const workTime = inst.workingTimeMinutes;
      const cookTime = inst.cookingTimeMinutes;
      row.innerHTML = `
        <span class="instruction-number">${index + 1}</span>
        <div class="instruction-content" data-inst-id="${inst.id}">
          <span class="instruction-desc">${escapeHtml(inst.description) || '<span class="text-muted">(no description)</span>'}</span>
          <span class="instruction-meta">
            ${workTime > 0 ? `<span class="meta-chip">&#9995; ${workTime}m</span>` : ""}
            ${cookTime > 0 ? `<span class="meta-chip fire">&#128293; ${cookTime}m</span>` : ""}
            ${inst.ingredientsUsed.length > 0 ? `<span class="meta-chip">${inst.ingredientsUsed.length} ing.</span>` : ""}
          </span>
        </div>
        <button class="btn btn-icon btn-danger-subtle" data-delete-inst="${inst.id}" title="Delete step">&#x2715;</button>
      `;
      instList.appendChild(row);
    });
  }

  // --- Events ---
  document.getElementById("recipe-back").addEventListener("click", () => { selectedRecipeId = null; renderCurrentView(); });

  document.getElementById("recipe-edit-name").addEventListener("click", () => {
    showDialog("Edit Recipe Name", `
      <label class="field-label">Name<input type="text" id="dialog-recipe-name" class="dialog-input" value="${escapeHtml(recipe.name)}"></label>
    `, [
      { text: "Cancel", action: "close" },
      { text: "Save", primary: true, action: () => {
        const name = document.getElementById("dialog-recipe-name").value.trim();
        if (name) { recipe.name = name; saveAllToStorage(); renderCurrentView(); }
        return !!name;
      }},
    ]);
  });

  document.getElementById("recipe-delete").addEventListener("click", () => {
    const removed = appState.recipes.splice(appState.recipes.indexOf(recipe), 1)[0];
    saveAllToStorage();
    selectedRecipeId = null;
    renderCurrentView();
    showToast(`"${removed.name}" deleted`, {
      duration: 5000,
      action: { label: "Undo", callback: () => {
        appState.recipes.push(removed);
        saveAllToStorage();
        selectedRecipeId = removed.id;
        renderCurrentView();
      }},
    });
  });

  document.getElementById("recipe-play").addEventListener("click", () => {
    if (recipe.instructions.length === 0) { showToast("Add at least one step before cooking"); return; }
    playingRecipe = recipe;
    renderCurrentView();
  });

  document.getElementById("recipe-export-md").addEventListener("click", () => {
    showExportMarkdownDialog(recipe);
  });

  // Recipe type
  container.querySelectorAll("[data-recipe-type]").forEach(btn => {
    btn.addEventListener("click", () => {
      recipe.type = Number(btn.dataset.recipeType);
      if (recipe.type === RecipeType.breakfast) { recipe.lunch = false; recipe.dinner = false; }
      saveAllToStorage(); renderCurrentView();
    });
  });

  // Toggles
  document.getElementById("recipe-stored").addEventListener("change", (e) => { recipe.canBeStored = e.target.checked; saveAllToStorage(); });
  document.getElementById("recipe-include").addEventListener("change", (e) => { recipe.includeInMenuGeneration = e.target.checked; saveAllToStorage(); });
  document.getElementById("toggle-lunch").addEventListener("click", () => { recipe.lunch = !recipe.lunch; saveAllToStorage(); renderCurrentView(); });
  document.getElementById("toggle-dinner").addEventListener("click", () => { recipe.dinner = !recipe.dinner; saveAllToStorage(); renderCurrentView(); });
  document.getElementById("toggle-carbs").addEventListener("click", () => { recipe.carbs = !recipe.carbs; saveAllToStorage(); renderCurrentView(); });
  document.getElementById("toggle-proteins").addEventListener("click", () => { recipe.proteins = !recipe.proteins; saveAllToStorage(); renderCurrentView(); });
  document.getElementById("toggle-vegetables").addEventListener("click", () => { recipe.vegetables = !recipe.vegetables; saveAllToStorage(); renderCurrentView(); });

  document.getElementById("add-step-btn").addEventListener("click", () => showInstructionEditor(recipe, null));

  instList.querySelectorAll("[data-inst-id]").forEach(el => {
    el.addEventListener("click", () => {
      const inst = recipe.instructions.find(i => i.id === el.dataset.instId);
      showInstructionEditor(recipe, inst);
    });
  });

  instList.querySelectorAll("[data-delete-inst]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const instId = btn.dataset.deleteInst;
      const removed = recipe.instructions.find(i => i.id === instId);
      recipe.instructions = recipe.instructions.filter(i => i.id !== instId);
      saveAllToStorage(); renderCurrentView();
      showToast("Step removed", {
        action: { label: "Undo", callback: () => {
          recipe.instructions.push(removed);
          saveAllToStorage(); renderCurrentView();
        }},
      });
    });
  });

  setupDragReorder(instList, recipe);
}

// --- Export Recipe to Markdown ---

function showExportMarkdownDialog(recipe) {
  let servingsCount = 1;

  function buildMarkdown(servings) {
    let md = `# ${recipe.name}\n\n`;
    md += `**Type:** ${RECIPE_TYPE_NAMES[recipe.type] || "Unknown"}\n`;
    md += `**Total time:** ${recipeTotalTime(recipe)} min\n`;
    md += `**Servings:** ${servings}\n\n`;

    for (let i = 0; i < recipe.instructions.length; i++) {
      const inst = recipe.instructions[i];
      md += `## Step ${i + 1}\n\n`;
      if (inst.ingredientsUsed.length > 0) {
        md += "**Ingredients:**\n";
        for (const usage of inst.ingredientsUsed) {
          const name = ingredientName(usage.ingredient);
          const amount = formatNumber(usage.quantity.amount * servings);
          md += `- ${name}: ${amount} ${UNIT_SHORT[usage.quantity.unit]}\n`;
        }
        md += "\n";
      }
      md += `${inst.description}\n\n`;
      if (inst.workingTimeMinutes > 0 || inst.cookingTimeMinutes > 0) {
        md += `*Working: ${inst.workingTimeMinutes} min | Cooking: ${inst.cookingTimeMinutes} min*\n\n`;
      }
    }
    return md;
  }

  showDialog("Export Recipe", `
    <div class="export-preview-controls">
      <label class="field-label">Servings
        <input type="number" id="export-servings" class="dialog-input" value="${servingsCount}" min="1" max="100" style="width:80px">
      </label>
    </div>
    <pre class="export-preview" id="export-preview">${escapeHtml(buildMarkdown(servingsCount))}</pre>
  `, [
    { text: "Close", action: "close" },
    { text: "Copy to Clipboard", primary: true, action: () => {
      navigator.clipboard.writeText(buildMarkdown(servingsCount));
      showToast("Recipe copied to clipboard");
      return true;
    }},
  ], () => {
    const servingsInput = document.getElementById("export-servings");
    if (servingsInput) {
      servingsInput.addEventListener("input", () => {
        servingsCount = Math.max(1, parseInt(servingsInput.value) || 1);
        const preview = document.getElementById("export-preview");
        if (preview) preview.textContent = buildMarkdown(servingsCount);
      });
    }
  });
}

// --- Instruction Drag Reorder ---

function setupDragReorder(listEl, recipe) {
  let dragIndex = null;

  listEl.querySelectorAll(".instruction-item").forEach(row => {
    row.addEventListener("dragstart", (e) => {
      dragIndex = Number(row.dataset.index);
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragend", () => { row.classList.remove("dragging"); dragIndex = null; });
    row.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; });
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      const dropIndex = Number(row.dataset.index);
      if (dragIndex !== null && dragIndex !== dropIndex) {
        const moved = recipe.instructions.splice(dragIndex, 1)[0];
        recipe.instructions.splice(dropIndex, 0, moved);
        saveAllToStorage(); renderCurrentView();
      }
    });
  });
}

// --- Instruction Editor Dialog ---

function showInstructionEditor(recipe, existingInstruction) {
  const isNew = !existingInstruction;
  const inst = existingInstruction
    ? JSON.parse(JSON.stringify(existingInstruction))
    : createInstruction({ description: "", workingTimeMinutes: 10, cookingTimeMinutes: 10 });

  function renderEditorContent() {
    // Available inputs: outputs from instructions BEFORE this one in the recipe
    const instIndex = recipe.instructions.findIndex(i => i.id === inst.id);
    const availableInputs = [];
    const alreadyTakenInputs = new Set();

    // Collect already-taken inputs from other instructions
    for (const other of recipe.instructions) {
      if (other.id === inst.id) continue;
      for (const inputId of other.inputs) alreadyTakenInputs.add(inputId);
    }

    // Only allow outputs from instructions BEFORE the current one (not after)
    const maxIndex = instIndex >= 0 ? instIndex : recipe.instructions.length;
    for (let i = 0; i < maxIndex; i++) {
      for (const output of recipe.instructions[i].outputs) {
        const available = !alreadyTakenInputs.has(output.id);
        availableInputs.push({ result: output, stepIndex: i, available });
      }
    }

    const unitOptions = Object.entries(UNIT_NAMES).map(([val, name]) =>
      `<option value="${val}">${name}</option>`
    ).join("");

    return `
      <div class="instruction-editor-form">
        <label class="field-label">Description
          <textarea id="inst-description" class="dialog-input" rows="3">${escapeHtml(inst.description)}</textarea>
        </label>
        <div class="time-row">
          <label class="field-label">Working time (min)
            <input type="number" id="inst-working-time" class="dialog-input" value="${inst.workingTimeMinutes}" min="0">
          </label>
          <label class="field-label">Cooking time (min)
            <input type="number" id="inst-cooking-time" class="dialog-input" value="${inst.cookingTimeMinutes}" min="0">
          </label>
          <span class="total-time">Total: ${instructionTotalTime(inst)} min</span>
        </div>

        <div class="editor-section-header">
          <h4>Inputs from other steps</h4>
        </div>
        <div id="inst-inputs-list" class="editor-chips-row">
          ${inst.inputs.map(inputId => {
            const found = availableInputs.find(ai => ai.result.id === inputId);
            return found ? `<div class="chip chip-selected chip-removable" data-remove-input="${inputId}">${escapeHtml(found.result.description)} (step ${found.stepIndex + 1}) &#x2715;</div>` : "";
          }).join("")}
        </div>
        ${availableInputs.filter(ai => ai.available && !inst.inputs.includes(ai.result.id)).length > 0 ? `
          <select id="add-input-select" class="dialog-input">
            <option value="">+ Add input from other step...</option>
            ${availableInputs.filter(ai => ai.available && !inst.inputs.includes(ai.result.id)).map(ai =>
              `<option value="${ai.result.id}">${escapeHtml(ai.result.description)} (step ${ai.stepIndex + 1})</option>`
            ).join("")}
          </select>
        ` : ""}

        <div class="editor-section-header">
          <h4>Ingredients</h4>
        </div>
        <div id="inst-ingredients-list">
          ${inst.ingredientsUsed.map((usage, idx) => `
            <div class="ingredient-usage-row" data-usage-index="${idx}">
              <span class="usage-name">${escapeHtml(ingredientName(usage.ingredient))}</span>
              <input type="number" class="dialog-input small-input usage-amount" value="${usage.quantity.amount}" min="0" step="0.1" data-usage-idx="${idx}">
              <select class="dialog-input small-select usage-unit" data-usage-idx="${idx}">
                ${Object.entries(UNIT_NAMES).map(([val, name]) =>
                  `<option value="${val}" ${Number(val) === usage.quantity.unit ? "selected" : ""}>${name}</option>`
                ).join("")}
              </select>
              <button class="btn btn-icon btn-danger-subtle" data-remove-usage="${idx}">&#x2715;</button>
            </div>
          `).join("")}
        </div>
        <div class="ingredient-search-add">
          <input type="text" id="ingredient-search-in-editor" class="dialog-input" placeholder="Search ingredient to add...">
          <div id="ingredient-search-results" class="ingredient-search-results"></div>
        </div>

        <div class="editor-section-header">
          <h4>Outputs (intermediate results)</h4>
        </div>
        <div id="inst-outputs-list">
          ${inst.outputs.map((output, idx) => `
            <div class="output-row">
              <input type="text" class="dialog-input output-desc" value="${escapeHtml(output.description)}" data-output-idx="${idx}" placeholder="Output description">
              <button class="btn btn-icon btn-danger-subtle" data-remove-output="${idx}">&#x2715;</button>
            </div>
          `).join("")}
        </div>
        <button class="btn btn-secondary" id="add-output-btn">+ Add Output</button>
      </div>
    `;
  }

  function attachEditorEvents() {
    const descEl = document.getElementById("inst-description");
    const workEl = document.getElementById("inst-working-time");
    const cookEl = document.getElementById("inst-cooking-time");

    if (descEl) descEl.addEventListener("input", () => { inst.description = descEl.value; });
    if (workEl) workEl.addEventListener("input", () => {
      inst.workingTimeMinutes = parseInt(workEl.value) || 0;
      const totalEl = document.querySelector(".total-time");
      if (totalEl) totalEl.textContent = `Total: ${instructionTotalTime(inst)} min`;
    });
    if (cookEl) cookEl.addEventListener("input", () => {
      inst.cookingTimeMinutes = parseInt(cookEl.value) || 0;
      const totalEl = document.querySelector(".total-time");
      if (totalEl) totalEl.textContent = `Total: ${instructionTotalTime(inst)} min`;
    });

    // Input select
    const addInputSelect = document.getElementById("add-input-select");
    if (addInputSelect) addInputSelect.addEventListener("change", () => {
      if (addInputSelect.value) {
        inst.inputs.push(addInputSelect.value);
        updateDialogContent(renderEditorContent()); attachEditorEvents();
      }
    });

    document.querySelectorAll("[data-remove-input]").forEach(chip => {
      chip.addEventListener("click", () => {
        inst.inputs = inst.inputs.filter(id => id !== chip.dataset.removeInput);
        updateDialogContent(renderEditorContent()); attachEditorEvents();
      });
    });

    // Ingredient search with inline add + history
    const searchInput = document.getElementById("ingredient-search-in-editor");
    const resultsEl = document.getElementById("ingredient-search-results");
    if (searchInput && resultsEl) {
      function showIngredientResults() {
        const query = searchInput.value.trim().toLowerCase();
        const usedIds = new Set(inst.ingredientsUsed.map(u => u.ingredient));

        let html = "";

        if (!query) {
          // Show history when search is empty
          const historyItems = appState.ingredientHistory
            .map(id => appState.ingredients.find(i => i.id === id))
            .filter(i => i && !usedIds.has(i.id));
          if (historyItems.length > 0) {
            html = historyItems.map(i =>
              `<div class="search-result-item search-result-history" data-add-ing="${i.id}"><span class="history-icon">&#128337;</span>${escapeHtml(i.name)}</div>`
            ).join("");
          } else {
            html = '<div class="search-result-empty">Type to search ingredients...</div>';
          }
        } else {
          const matches = appState.ingredients
            .filter(i => i.name.toLowerCase().includes(query) && !usedIds.has(i.id))
            .slice(0, 8);
          const exactMatch = appState.ingredients.some(i => i.name.toLowerCase() === query);

          html = matches.map(i =>
            `<div class="search-result-item" data-add-ing="${i.id}">${escapeHtml(i.name)}</div>`
          ).join("");

          if (!exactMatch && query.length > 1) {
            html += `<div class="search-result-item search-result-create" data-create-ing="${escapeHtml(query)}">+ Create "${escapeHtml(query)}"</div>`;
          }
        }

        resultsEl.innerHTML = html;

        resultsEl.querySelectorAll("[data-add-ing]").forEach(el => {
          el.addEventListener("click", () => {
            inst.ingredientsUsed.push(createIngredientUsage({
              ingredient: el.dataset.addIng,
              quantity: createQuantity({ amount: 1, unit: Unit.pieces }),
            }));
            addToIngredientHistory(el.dataset.addIng);
            searchInput.value = "";
            resultsEl.innerHTML = "";
            updateDialogContent(renderEditorContent()); attachEditorEvents();
          });
        });

        resultsEl.querySelectorAll("[data-create-ing]").forEach(el => {
          el.addEventListener("click", () => {
            const newIng = createIngredient({ name: searchInput.value.trim() });
            appState.ingredients.push(newIng);
            inst.ingredientsUsed.push(createIngredientUsage({
              ingredient: newIng.id,
              quantity: createQuantity({ amount: 1, unit: Unit.pieces }),
            }));
            addToIngredientHistory(newIng.id);
            saveAllToStorage();
            searchInput.value = "";
            resultsEl.innerHTML = "";
            updateDialogContent(renderEditorContent()); attachEditorEvents();
          });
        });
      }

      searchInput.addEventListener("input", showIngredientResults);
      searchInput.addEventListener("focus", showIngredientResults);
    }

    // Update ingredient amounts/units
    document.querySelectorAll(".usage-amount").forEach(input => {
      input.addEventListener("input", () => {
        inst.ingredientsUsed[Number(input.dataset.usageIdx)].quantity.amount = parseFloat(input.value) || 0;
      });
    });
    document.querySelectorAll(".usage-unit").forEach(select => {
      select.addEventListener("change", () => {
        inst.ingredientsUsed[Number(select.dataset.usageIdx)].quantity.unit = Number(select.value);
      });
    });

    document.querySelectorAll("[data-remove-usage]").forEach(btn => {
      btn.addEventListener("click", () => {
        inst.ingredientsUsed.splice(Number(btn.dataset.removeUsage), 1);
        updateDialogContent(renderEditorContent()); attachEditorEvents();
      });
    });

    // Outputs
    document.querySelectorAll(".output-desc").forEach(input => {
      input.addEventListener("input", () => { inst.outputs[Number(input.dataset.outputIdx)].description = input.value; });
    });
    document.querySelectorAll("[data-remove-output]").forEach(btn => {
      btn.addEventListener("click", () => {
        inst.outputs.splice(Number(btn.dataset.removeOutput), 1);
        updateDialogContent(renderEditorContent()); attachEditorEvents();
      });
    });
    const addOutputBtn = document.getElementById("add-output-btn");
    if (addOutputBtn) addOutputBtn.addEventListener("click", () => {
      inst.outputs.push(createResult({ description: "" }));
      updateDialogContent(renderEditorContent()); attachEditorEvents();
    });
  }

  showDialog(isNew ? "Add Step" : "Edit Step", renderEditorContent(), [
    { text: "Cancel", action: "close" },
    { text: "Save", primary: true, action: () => {
      if (isNew) {
        recipe.instructions.push(inst);
      } else {
        const idx = recipe.instructions.findIndex(i => i.id === inst.id);
        if (idx >= 0) recipe.instructions[idx] = inst;
      }
      saveAllToStorage(); renderCurrentView();
      return true;
    }},
  ], attachEditorEvents);
}

function addToIngredientHistory(ingredientId) {
  const hist = appState.ingredientHistory;
  const idx = hist.indexOf(ingredientId);
  if (idx >= 0) hist.splice(idx, 1);
  hist.unshift(ingredientId);
  if (hist.length > 10) hist.pop();
}

// --- Menu Configuration Page ---

function renderMenuConfigPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2>Menu Configuration</h2>
      <div class="spacer"></div>
      <button class="btn btn-secondary" id="import-menu-btn">&#128194; Open Menu</button>
      <button class="btn btn-primary" id="generate-menu-btn">&#10024; Generate Menu</button>
    </div>
    <div class="config-grid" id="config-grid"></div>
  `;

  const grid = document.getElementById("config-grid");

  for (let wd = 0; wd < 7; wd++) {
    const dayCard = document.createElement("div");
    dayCard.className = "day-card";
    dayCard.innerHTML = `<h3 class="day-title">${WEEK_DAY_NAMES[wd]}</h3>`;

    for (let mt = 0; mt < 3; mt++) {
      const config = appState.configurations.find(c => c.weekDay === wd && c.mealType === mt);
      if (!config) continue;

      const mealSlot = document.createElement("div");
      mealSlot.className = `meal-config-slot ${config.requiresMeal ? "" : "meal-config-disabled"}`;
      mealSlot.innerHTML = `
        <div class="meal-config-header">
          <span class="meal-config-label">${MEAL_TYPE_NAMES[mt]}</span>
          <label class="switch-label">
            <input type="checkbox" ${config.requiresMeal ? "checked" : ""} data-wd="${wd}" data-mt="${mt}" class="toggle-switch config-require-toggle">
          </label>
        </div>
        ${config.requiresMeal ? `
          <div class="meal-config-time">
            <input type="number" value="${config.availableCookingTimeMinutes}" min="0" class="time-input config-time-input" data-wd="${wd}" data-mt="${mt}">
            <span class="time-unit">min</span>
          </div>
        ` : ""}
      `;
      dayCard.appendChild(mealSlot);
    }

    grid.appendChild(dayCard);
  }

  grid.querySelectorAll(".config-require-toggle").forEach(toggle => {
    toggle.addEventListener("change", () => {
      const config = appState.configurations.find(c => c.weekDay === Number(toggle.dataset.wd) && c.mealType === Number(toggle.dataset.mt));
      if (config) { config.requiresMeal = toggle.checked; saveAllToStorage(); renderCurrentView(); }
    });
  });

  grid.querySelectorAll(".config-time-input").forEach(input => {
    input.addEventListener("input", () => {
      const config = appState.configurations.find(c => c.weekDay === Number(input.dataset.wd) && c.mealType === Number(input.dataset.mt));
      if (config) { config.availableCookingTimeMinutes = parseInt(input.value) || 0; saveAllToStorage(); }
    });
  });

  document.getElementById("generate-menu-btn").addEventListener("click", () => {
    if (appState.recipes.length === 0) { showToast("Add some recipes first"); return; }
    appState.currentMenu = generateMenu(appState.configurations, appState.recipes, Date.now());
    saveAllToStorage(); menuSubView = "menu"; renderCurrentView();
  });

  document.getElementById("import-menu-btn").addEventListener("click", async () => {
    const menu = await importMenuFromFile();
    if (menu) { appState.currentMenu = menu; saveAllToStorage(); menuSubView = "menu"; renderCurrentView(); }
  });
}

// --- Menu Display Page ---

function renderMenuPage(container, initialMenu) {
  let menu = initialMenu || appState.currentMenu;
  if (!menu) return;

  /** @type {string|null} hoveredRecipeId for highlight */
  let hoveredRecipeId = null;

  function render() {
    container.innerHTML = `
      <div class="page-header">
        <button class="btn btn-icon" id="menu-back" title="Back to config">&#8592;</button>
        <h2>Menu</h2>
        <button class="btn btn-icon" id="menu-regenerate" title="Regenerate menu">&#x21BB;</button>
        <div class="spacer"></div>
        <button class="btn btn-secondary" id="menu-copy">&#128203; Copy</button>
        <button class="btn btn-secondary" id="menu-save">&#128190; Save</button>
        <button class="btn btn-primary" id="menu-shopping">&#128722; Shopping List</button>
      </div>
      <div class="menu-grid" id="menu-grid"></div>
    `;

    const grid = document.getElementById("menu-grid");

    for (let wd = 0; wd < 7; wd++) {
      const dayMeals = menuMealsOfDay(menu, wd);
      const dayCard = document.createElement("div");
      dayCard.className = "day-card";
      dayCard.innerHTML = `<h3 class="day-title">${WEEK_DAY_NAMES[wd]}</h3>`;

      for (let mt = 0; mt < 3; mt++) {
        const meal = dayMeals[mt];
        const slot = document.createElement("div");

        if (!meal) {
          slot.className = "meal-slot meal-slot-empty";
          slot.innerHTML = `<span class="meal-type-label">${MEAL_TYPE_NAMES[mt]}</span>`;
        } else {
          const recipeId = meal.cooking ? meal.cooking.recipe.id : null;
          const isHighlighted = hoveredRecipeId && recipeId === hoveredRecipeId;
          slot.className = `meal-slot ${isHighlighted ? "meal-slot-highlight" : ""}`;
          if (recipeId) slot.dataset.recipeId = recipeId;

          if (!meal.cooking) {
            slot.innerHTML = `
              <span class="meal-type-label">${MEAL_TYPE_NAMES[mt]}</span>
              <span class="meal-no-recipe" title="No recipe assigned">&#9888; No recipe</span>
            `;
          } else {
            const yieldStr = meal.cooking.yield > 0 ? `<span class="yield-badge" title="Cook ${meal.cooking.yield} servings">${meal.cooking.yield}x</span>` : `<span class="yield-badge yield-stored" title="Already cooked">stored</span>`;
            slot.innerHTML = `
              <span class="meal-type-label">${MEAL_TYPE_NAMES[mt]}</span>
              <div class="meal-recipe-name" data-swap-wd="${wd}" data-swap-mt="${mt}">
                ${yieldStr}
                ${escapeHtml(meal.cooking.recipe.name)}
              </div>
              <div class="meal-people-row">
                <button class="btn btn-icon btn-small" data-people-minus data-wd="${wd}" data-mt="${mt}" ${meal.people <= 0 ? "disabled" : ""}>&#8722;</button>
                <span class="people-count">${meal.people} &#128100;</span>
                <button class="btn btn-icon btn-small" data-people-plus data-wd="${wd}" data-mt="${mt}">+</button>
              </div>
            `;
          }
        }
        dayCard.appendChild(slot);
      }
      grid.appendChild(dayCard);
    }

    // Hover highlight for shared recipes
    grid.querySelectorAll(".meal-slot[data-recipe-id]").forEach(slot => {
      slot.addEventListener("mouseenter", () => {
        hoveredRecipeId = slot.dataset.recipeId;
        grid.querySelectorAll(".meal-slot[data-recipe-id]").forEach(s => {
          s.classList.toggle("meal-slot-highlight", s.dataset.recipeId === hoveredRecipeId);
        });
      });
      slot.addEventListener("mouseleave", () => {
        hoveredRecipeId = null;
        grid.querySelectorAll(".meal-slot").forEach(s => s.classList.remove("meal-slot-highlight"));
      });
    });

    // Events
    document.getElementById("menu-back").addEventListener("click", () => { menuSubView = "config"; renderCurrentView(); });
    document.getElementById("menu-regenerate").addEventListener("click", () => {
      menu = generateMenu(appState.configurations, appState.recipes, Date.now());
      appState.currentMenu = menu; saveAllToStorage(); render();
    });
    document.getElementById("menu-copy").addEventListener("click", () => {
      navigator.clipboard.writeText(menuToString(menu)); showToast("Menu copied to clipboard");
    });
    document.getElementById("menu-save").addEventListener("click", () => exportMenuToFile());
    document.getElementById("menu-shopping").addEventListener("click", () => { menuSubView = "shopping"; renderCurrentView(); });

    grid.querySelectorAll("[data-swap-wd]").forEach(el => {
      el.addEventListener("click", () => {
        showRecipePickerDialog(Number(el.dataset.swapWd), Number(el.dataset.swapMt), (recipe) => {
          menu = menuUpdateRecipe(menu, Number(el.dataset.swapWd), Number(el.dataset.swapMt), recipe);
          appState.currentMenu = menu; saveAllToStorage(); render();
        });
      });
    });

    grid.querySelectorAll("[data-people-minus]").forEach(btn => {
      btn.addEventListener("click", () => {
        const meal = menu.meals.find(m => m.weekDay === Number(btn.dataset.wd) && m.mealType === Number(btn.dataset.mt));
        if (meal && meal.people > 0) {
          menu = menuUpdatePeople(menu, Number(btn.dataset.wd), Number(btn.dataset.mt), meal.people - 1);
          appState.currentMenu = menu; saveAllToStorage(); render();
        }
      });
    });

    grid.querySelectorAll("[data-people-plus]").forEach(btn => {
      btn.addEventListener("click", () => {
        const meal = menu.meals.find(m => m.weekDay === Number(btn.dataset.wd) && m.mealType === Number(btn.dataset.mt));
        if (meal) {
          menu = menuUpdatePeople(menu, Number(btn.dataset.wd), Number(btn.dataset.mt), meal.people + 1);
          appState.currentMenu = menu; saveAllToStorage(); render();
        }
      });
    });
  }

  render();
}

function showRecipePickerDialog(weekDay, mealType, onPick) {
  const recipeListHtml = appState.recipes.map(r =>
    `<div class="list-item recipe-pick-item" data-pick-id="${r.id}">
      <span class="list-item-name">${escapeHtml(r.name)}</span>
      <span class="list-item-meta">${recipeTotalTime(r)} min</span>
    </div>`
  ).join("");

  showDialog("Select Recipe", `
    <input type="text" id="recipe-picker-search" class="dialog-input" placeholder="Search recipes..." style="margin-bottom:8px">
    <div class="recipe-picker-list" id="recipe-picker-list">${recipeListHtml}</div>
  `, [
    { text: "Cancel", action: "close" },
  ], () => {
    function attachPicks() {
      document.querySelectorAll("[data-pick-id]").forEach(el => {
        el.addEventListener("click", () => {
          const recipe = appState.recipes.find(r => r.id === el.dataset.pickId);
          if (recipe) { closeDialog(); onPick(recipe); }
        });
      });
    }
    attachPicks();

    const searchEl = document.getElementById("recipe-picker-search");
    if (searchEl) {
      searchEl.addEventListener("input", () => {
        const q = searchEl.value.toLowerCase().replace(/\s+/g, "");
        const filtered = q ? appState.recipes.filter(r => r.name.toLowerCase().replace(/\s+/g, "").includes(q)) : appState.recipes;
        const listEl = document.getElementById("recipe-picker-list");
        listEl.innerHTML = filtered.map(r =>
          `<div class="list-item recipe-pick-item" data-pick-id="${r.id}">
            <span class="list-item-name">${escapeHtml(r.name)}</span>
            <span class="list-item-meta">${recipeTotalTime(r)} min</span>
          </div>`
        ).join("");
        attachPicks();
      });
    }
  });
}

// --- Shopping Page ---

function renderShoppingPage(container, menu) {
  const ingredientsRequired = menuAllIngredients(menu);
  /** @type {Record<string, {amount: number, unit: number}[]>} */
  const owned = {};
  for (const [ingId, quantities] of Object.entries(ingredientsRequired)) {
    owned[ingId] = quantities.map(q => createQuantity({ amount: 0, unit: q.unit }));
  }

  function remaining(ingId) {
    const req = ingredientsRequired[ingId];
    const own = owned[ingId];
    return req.map(q => {
      const ownQ = own.find(o => o.unit === q.unit);
      return createQuantity({ amount: Math.max(0, Math.round(q.amount - (ownQ ? ownQ.amount : 0))), unit: q.unit });
    });
  }

  function render() {
    const entries = Object.entries(ingredientsRequired);

    container.innerHTML = `
      <div class="page-header">
        <button class="btn btn-icon" id="shopping-back">&#8592;</button>
        <h2>Shopping List</h2>
        <span class="header-count">${entries.length} items</span>
        <div class="spacer"></div>
        <button class="btn btn-secondary" id="shopping-copy">&#128203; Copy</button>
      </div>
      <div class="shopping-list" id="shopping-list"></div>
    `;

    const listEl = document.getElementById("shopping-list");

    if (entries.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><p>No ingredients needed.</p></div>';
    } else {
      for (const [ingId, quantities] of entries) {
        const remainingQtys = remaining(ingId);
        const allDone = remainingQtys.every(q => q.amount <= 0);
        const card = document.createElement("div");
        card.className = `shopping-item ${allDone ? "shopping-done" : ""}`;

        let quantitiesHtml = "";
        quantities.forEach((q, qi) => {
          const rem = remainingQtys[qi];
          const ownedVal = owned[ingId].find(o => o.unit === q.unit)?.amount || 0;
          quantitiesHtml += `
            <div class="shopping-quantity-row">
              <span class="shopping-desired">${Math.round(q.amount)} ${UNIT_SHORT[q.unit]}</span>
              <input type="number" class="dialog-input small-input owned-input" data-ing="${ingId}" data-unit="${q.unit}" value="${ownedVal}" min="0" step="1">
              <button class="btn btn-icon btn-small mark-owned-btn" data-ing="${ingId}" data-unit="${q.unit}" data-amount="${q.amount}" title="Mark all as owned">&#10003;</button>
              <span class="shopping-remaining ${rem.amount <= 0 ? "done" : ""}">${rem.amount} ${UNIT_SHORT[q.unit]} needed</span>
            </div>
          `;
        });

        card.innerHTML = `
          <div class="shopping-item-name">${escapeHtml(ingredientName(ingId))}</div>
          <div class="shopping-quantities">${quantitiesHtml}</div>
        `;
        listEl.appendChild(card);
      }
    }

    document.getElementById("shopping-back").addEventListener("click", () => { menuSubView = "menu"; renderCurrentView(); });

    document.getElementById("shopping-copy").addEventListener("click", () => {
      const lines = [];
      for (const [ingId, quantities] of entries) {
        const rem = remaining(ingId);
        const needed = rem.filter(q => q.amount > 0);
        if (needed.length > 0) {
          lines.push(`${ingredientName(ingId)}: ${needed.map(q => `${q.amount} ${UNIT_SHORT[q.unit]}`).join(" + ")}`);
        }
      }
      navigator.clipboard.writeText(lines.join("\n"));
      showToast("Shopping list copied");
    });

    listEl.querySelectorAll(".owned-input").forEach(input => {
      input.addEventListener("input", () => {
        const ingId = input.dataset.ing;
        const unit = Number(input.dataset.unit);
        const val = parseFloat(input.value) || 0;
        const ownedQ = owned[ingId].find(q => q.unit === unit);
        if (ownedQ) ownedQ.amount = val;
        // Update remaining displays without full re-render (preserve input focus)
        const row = input.closest(".shopping-quantity-row");
        const remainSpan = row.querySelector(".shopping-remaining");
        const rem = remaining(ingId).find(r => r.unit === unit);
        if (remainSpan && rem) {
          remainSpan.textContent = `${rem.amount} ${UNIT_SHORT[rem.unit]} needed`;
          remainSpan.classList.toggle("done", rem.amount <= 0);
        }
        const card = input.closest(".shopping-item");
        const allDone = remaining(ingId).every(q => q.amount <= 0);
        card.classList.toggle("shopping-done", allDone);
      });
    });

    listEl.querySelectorAll(".mark-owned-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const ingId = btn.dataset.ing;
        const unit = Number(btn.dataset.unit);
        const amount = parseFloat(btn.dataset.amount);
        const ownedQ = owned[ingId].find(q => q.unit === unit);
        if (ownedQ) ownedQ.amount = amount;
        render();
      });
    });
  }

  render();
}

// --- Play Recipe Page ---

function renderPlayRecipePage(container, recipe) {
  let currentStep = 0;
  let servings = 1;
  /** @type {{stepIndex: number, totalSeconds: number, remainingSeconds: number, intervalId: number|null, finished: boolean}[]} */
  const activeTimers = [];
  /** @type {Record<number, {ctx: AudioContext, interval: number}>} */
  const audioContexts = {};

  const instructions = recipe.instructions;
  const totalSteps = instructions.length;

  function cleanup() {
    for (const timer of activeTimers) { if (timer.intervalId) clearInterval(timer.intervalId); }
    for (const entry of Object.values(audioContexts)) {
      clearInterval(entry.interval);
      entry.ctx.close().catch(() => {});
    }
  }

  function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function formatQuantity(quantity) {
    return `${formatNumber(quantity.amount * servings)} ${UNIT_SHORT[quantity.unit]}`;
  }

  function getInputsForStep(stepIndex) {
    const inst = instructions[stepIndex];
    const inputs = [];
    for (const inputId of inst.inputs) {
      for (let i = 0; i < stepIndex; i++) {
        for (const output of instructions[i].outputs) {
          if (output.id === inputId) inputs.push({ result: output, fromStepIndex: i, fromInstruction: instructions[i] });
        }
      }
    }
    return inputs;
  }

  function timerForStep(stepIndex) {
    return activeTimers.find(t => t.stepIndex === stepIndex && (t.intervalId || t.finished)) || null;
  }

  function startTimer(stepIndex, minutes) {
    const existing = activeTimers.findIndex(t => t.stepIndex === stepIndex);
    if (existing >= 0) { if (activeTimers[existing].intervalId) clearInterval(activeTimers[existing].intervalId); activeTimers.splice(existing, 1); }
    const timer = { stepIndex, totalSeconds: minutes * 60, remainingSeconds: minutes * 60, intervalId: null, finished: false };
    timer.intervalId = setInterval(() => {
      timer.remainingSeconds--;
      if (timer.remainingSeconds <= 0) {
        timer.remainingSeconds = 0; timer.finished = true;
        clearInterval(timer.intervalId); timer.intervalId = null;
        playTimerSound(stepIndex);
        showToast(`Timer finished for Step ${stepIndex + 1}!`, { duration: 6000 });
      }
      render();
    }, 1000);
    activeTimers.push(timer);
    render();
  }

  function cancelTimer(stepIndex) {
    const idx = activeTimers.findIndex(t => t.stepIndex === stepIndex);
    if (idx >= 0) { if (activeTimers[idx].intervalId) clearInterval(activeTimers[idx].intervalId); activeTimers.splice(idx, 1); }
    stopTimerSound(stepIndex);
    render();
  }

  function playTimerSound(stepIndex) {
    try {
      const ctx = new AudioContext();
      function beep() {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880; gain.gain.value = 0.3;
        osc.start(); osc.stop(ctx.currentTime + 0.2);
      }
      beep();
      const interval = setInterval(() => { if (!audioContexts[stepIndex]) { clearInterval(interval); return; } beep(); }, 1500);
      audioContexts[stepIndex] = { ctx, interval };
    } catch (e) { /* silent fail */ }
  }

  function stopTimerSound(stepIndex) {
    const entry = audioContexts[stepIndex];
    if (entry) { clearInterval(entry.interval); entry.ctx.close().catch(() => {}); delete audioContexts[stepIndex]; }
  }

  function render() {
    const inst = instructions[currentStep];
    const inputs = getInputsForStep(currentStep);
    const currentTimer = timerForStep(currentStep);
    const otherTimers = activeTimers.filter(t => t.stepIndex !== currentStep && (t.intervalId || t.finished));

    container.innerHTML = `
      <div class="page-header">
        <button class="btn btn-icon" id="play-back">&#8592;</button>
        <h2>${escapeHtml(recipe.name)}</h2>
        <div class="spacer"></div>
        <div class="servings-selector">
          <button class="btn btn-icon btn-small" id="servings-minus" ${servings <= 1 ? "disabled" : ""}>&#8722;</button>
          <span>${servings} ${servings === 1 ? "serving" : "servings"}</span>
          <button class="btn btn-icon btn-small" id="servings-plus" ${servings >= 100 ? "disabled" : ""}>+</button>
        </div>
      </div>

      <div class="step-progress">
        <span class="step-counter">Step ${currentStep + 1} of ${totalSteps}</span>
        <div class="progress-bar"><div class="progress-fill" style="width: ${((currentStep + 1) / totalSteps) * 100}%"></div></div>
      </div>

      <div class="play-content">
        <div class="play-top-row">
          <div class="play-ingredients">
            ${inputs.length > 0 || inst.ingredientsUsed.length > 0 ? '<h3>Ingredients</h3>' : ""}
            ${inputs.map(input => `
              <div class="input-chip" data-goto-step="${input.fromStepIndex}" data-result-desc="${escapeHtml(input.result.description)}">
                <span class="input-icon">&#8678;</span>
                <span>${escapeHtml(input.result.description)}</span>
                <span class="input-from">from Step ${input.fromStepIndex + 1}</span>
              </div>
            `).join("")}
            ${inst.ingredientsUsed.map(usage => `
              <div class="ingredient-row">
                <span class="dot">&#8226;</span>
                <span>${escapeHtml(ingredientName(usage.ingredient))}</span>
                <span class="ingredient-qty">${formatQuantity(usage.quantity)}</span>
              </div>
            `).join("")}
          </div>
          <div class="play-instructions">
            <div class="step-card">
              <div class="step-card-header">
                <span class="step-number">${currentStep + 1}</span>
                <span class="step-card-title">Instructions</span>
                ${inst.workingTimeMinutes > 0 ? `<span class="time-chip">&#9995; ${inst.workingTimeMinutes} min</span>` : ""}
                ${inst.cookingTimeMinutes > 0 ? `<span class="time-chip fire">&#128293; ${inst.cookingTimeMinutes} min</span>` : ""}
              </div>
              <p class="step-description">${escapeHtml(inst.description)}</p>
              ${inst.outputs.length > 0 ? `
                <div class="step-outputs">
                  <span class="outputs-label">Produces:</span>
                  ${inst.outputs.map(o => `<span class="output-chip">&#10132; ${escapeHtml(o.description)}</span>`).join("")}
                </div>
              ` : ""}
            </div>
          </div>
        </div>

        <div class="play-bottom-row">
          <div class="play-nav-card">
            ${currentStep > 0 ? `
              <button class="btn btn-secondary step-nav-btn" id="prev-step">
                &#8592; Previous (${currentStep})
                <small>${escapeHtml(instructions[currentStep - 1].description.substring(0, 60))}${instructions[currentStep - 1].description.length > 60 ? "..." : ""}</small>
              </button>
            ` : '<div></div>'}
          </div>
          <div class="play-timers">
            ${inst.cookingTimeMinutes > 0 || currentTimer ? `
              <div class="timer-card ${currentTimer?.finished ? "timer-finished" : currentTimer?.intervalId ? "timer-running" : ""}">
                <span class="timer-icon">${currentTimer?.finished ? "&#9200;" : "&#9201;"}</span>
                ${currentTimer?.intervalId || currentTimer?.finished
                  ? `<span class="timer-display">${currentTimer.finished ? "Timer finished!" : formatDuration(currentTimer.remainingSeconds)}</span>
                     <button class="btn btn-small" data-cancel-timer="${currentStep}">${currentTimer.finished ? "Dismiss" : "Cancel"}</button>`
                  : `<span>Start ${inst.cookingTimeMinutes}-min timer</span>
                     <button class="btn btn-primary btn-small" data-start-timer="${currentStep}" data-minutes="${inst.cookingTimeMinutes}">Start</button>`
                }
              </div>
            ` : ""}
            ${otherTimers.length > 0 ? '<div class="other-timers-label">Other active timers</div>' : ""}
            ${otherTimers.map(t => `
              <div class="timer-card timer-compact ${t.finished ? "timer-finished" : "timer-running"}" data-goto-timer="${t.stepIndex}">
                <span>Step ${t.stepIndex + 1}</span>
                <span class="timer-display">${t.finished ? "Done!" : formatDuration(t.remainingSeconds)}</span>
                <button class="btn btn-small" data-cancel-timer="${t.stepIndex}">${t.finished ? "Dismiss" : "Cancel"}</button>
              </div>
            `).join("")}
          </div>
          <div class="play-nav-card">
            ${currentStep < totalSteps - 1 ? `
              <button class="btn btn-secondary step-nav-btn" id="next-step">
                Next (${currentStep + 2}) &#8594;
                <small>${escapeHtml(instructions[currentStep + 1].description.substring(0, 60))}${instructions[currentStep + 1].description.length > 60 ? "..." : ""}</small>
              </button>
            ` : '<div class="step-complete">&#10004; Last step!</div>'}
          </div>
        </div>
      </div>
    `;

    document.getElementById("play-back").addEventListener("click", () => {
      if (activeTimers.some(t => t.intervalId)) {
        if (!confirm("You have active timers running. Leave anyway?")) return;
      }
      cleanup(); playingRecipe = null; renderCurrentView();
    });

    document.getElementById("servings-minus")?.addEventListener("click", () => { if (servings > 1) { servings--; render(); } });
    document.getElementById("servings-plus")?.addEventListener("click", () => { if (servings < 100) { servings++; render(); } });
    document.getElementById("prev-step")?.addEventListener("click", () => { if (currentStep > 0) { currentStep--; render(); } });
    document.getElementById("next-step")?.addEventListener("click", () => { if (currentStep < totalSteps - 1) { currentStep++; render(); } });

    container.querySelectorAll("[data-start-timer]").forEach(btn => {
      btn.addEventListener("click", () => startTimer(Number(btn.dataset.startTimer), Number(btn.dataset.minutes)));
    });
    container.querySelectorAll("[data-cancel-timer]").forEach(btn => {
      btn.addEventListener("click", (e) => { e.stopPropagation(); cancelTimer(Number(btn.dataset.cancelTimer)); });
    });
    container.querySelectorAll("[data-goto-step]").forEach(el => {
      el.addEventListener("click", () => {
        const fromStep = Number(el.dataset.gotoStep);
        const fromInst = instructions[fromStep];
        const resultDesc = el.dataset.resultDesc || "";
        showDialog("Input Detail", `
          <div class="input-detail-dialog">
            <div class="input-detail-icon">&#8678;</div>
            <h4 class="input-detail-name">${escapeHtml(resultDesc)}</h4>
            <p class="input-detail-label">Prepared in Step ${fromStep + 1}:</p>
            <p class="input-detail-desc">${escapeHtml(fromInst.description)}</p>
          </div>
        `, [
          { text: "Close", action: "close" },
          { text: `Go to Step ${fromStep + 1}`, primary: true, action: () => { currentStep = fromStep; render(); return true; } },
        ]);
      });
    });
    container.querySelectorAll("[data-goto-timer]").forEach(el => {
      el.addEventListener("click", () => { currentStep = Number(el.dataset.gotoTimer); render(); });
    });
  }

  render();
}

// --- Dialog System ---

/** @type {HTMLElement|null} */
let activeDialog = null;

/**
 * @param {string} title
 * @param {string} contentHtml
 * @param {{text: string, primary?: boolean, action: string|Function}[]} buttons
 * @param {Function} [afterRender]
 */
function showDialog(title, contentHtml, buttons, afterRender) {
  closeDialog();

  const overlay = document.createElement("div");
  overlay.className = "dialog-overlay";
  overlay.innerHTML = `
    <div class="dialog">
      <h3 class="dialog-title">${title}</h3>
      <div class="dialog-content" id="dialog-content-inner">${contentHtml}</div>
      <div class="dialog-actions">
        ${buttons.map((btn, i) =>
          `<button class="btn ${btn.primary ? "btn-primary" : "btn-secondary"}" data-dialog-btn="${i}">${btn.text}</button>`
        ).join("")}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  activeDialog = overlay;

  requestAnimationFrame(() => {
    const firstInput = overlay.querySelector("input:not([type=checkbox]):not([type=number]), textarea");
    if (firstInput) firstInput.focus();
  });

  overlay.querySelectorAll("[data-dialog-btn]").forEach(btn => {
    btn.addEventListener("click", () => {
      const btnConfig = buttons[Number(btn.dataset.dialogBtn)];
      if (btnConfig.action === "close") {
        closeDialog();
      } else if (typeof btnConfig.action === "function") {
        const result = btnConfig.action();
        if (result !== false) closeDialog();
      }
    });
  });

  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeDialog(); });

  // Enter key submits the primary button
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
      const primaryBtn = overlay.querySelector(".btn-primary[data-dialog-btn]");
      if (primaryBtn) primaryBtn.click();
    }
  });

  if (afterRender) afterRender();
}

function updateDialogContent(html) {
  const inner = document.getElementById("dialog-content-inner");
  if (inner) inner.innerHTML = html;
}

function closeDialog() {
  if (activeDialog) { activeDialog.remove(); activeDialog = null; }
}

// --- Theme System ---

const THEME_COLORS = [
  { name: "Teal", hue: 160, primary: "#3d7a4f", bg: "#f8faf6" },
  { name: "Blue", hue: 220, primary: "#3b6db5", bg: "#f6f8fa" },
  { name: "Purple", hue: 270, primary: "#7b52a8", bg: "#f9f6fa" },
  { name: "Red", hue: 0, primary: "#b54a4a", bg: "#faf6f6" },
  { name: "Orange", hue: 25, primary: "#b5713b", bg: "#faf8f6" },
  { name: "Pink", hue: 330, primary: "#a84d7b", bg: "#faf6f9" },
  { name: "Indigo", hue: 240, primary: "#5252a8", bg: "#f7f6fa" },
  { name: "Cyan", hue: 190, primary: "#3b8fa5", bg: "#f6f9fa" },
];

const THEME_MODES = ["light", "dark", "system"];

function loadThemePreferences() {
  try {
    const saved = localStorage.getItem("menuMgmt_theme");
    return saved ? JSON.parse(saved) : { colorIndex: 0, mode: "system" };
  } catch { return { colorIndex: 0, mode: "system" }; }
}

function saveThemePreferences(prefs) {
  localStorage.setItem("menuMgmt_theme", JSON.stringify(prefs));
}

function applyTheme(prefs) {
  const color = THEME_COLORS[prefs.colorIndex] || THEME_COLORS[0];
  const prefersDark = prefs.mode === "dark" || (prefs.mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const h = color.hue;
  const root = document.documentElement;

  if (prefersDark) {
    root.style.setProperty("--color-bg", `hsl(${h}, 8%, 10%)`);
    root.style.setProperty("--color-surface", `hsl(${h}, 8%, 14%)`);
    root.style.setProperty("--color-surface-dim", `hsl(${h}, 6%, 18%)`);
    root.style.setProperty("--color-surface-container", `hsl(${h}, 6%, 22%)`);
    root.style.setProperty("--color-primary", `hsl(${h}, 50%, 65%)`);
    root.style.setProperty("--color-primary-hover", `hsl(${h}, 50%, 72%)`);
    root.style.setProperty("--color-primary-container", `hsl(${h}, 30%, 22%)`);
    root.style.setProperty("--color-on-primary", `hsl(${h}, 8%, 10%)`);
    root.style.setProperty("--color-on-primary-container", `hsl(${h}, 40%, 80%)`);
    root.style.setProperty("--color-secondary", `hsl(${h}, 12%, 55%)`);
    root.style.setProperty("--color-secondary-container", `hsl(${h}, 10%, 24%)`);
    root.style.setProperty("--color-on-secondary-container", `hsl(${h}, 15%, 78%)`);
    root.style.setProperty("--color-tertiary", `hsl(${(h + 120) % 360}, 30%, 65%)`);
    root.style.setProperty("--color-tertiary-container", `hsl(${(h + 120) % 360}, 15%, 22%)`);
    root.style.setProperty("--color-on-tertiary-container", `hsl(${(h + 120) % 360}, 25%, 78%)`);
    root.style.setProperty("--color-text", `hsl(${h}, 5%, 90%)`);
    root.style.setProperty("--color-text-secondary", `hsl(${h}, 5%, 72%)`);
    root.style.setProperty("--color-text-muted", `hsl(${h}, 4%, 55%)`);
    root.style.setProperty("--color-border", `hsl(${h}, 6%, 26%)`);
    root.style.setProperty("--color-outline", `hsl(${h}, 4%, 45%)`);
    root.style.setProperty("--color-error", "#f2938a");
    root.style.setProperty("--color-error-container", "hsl(0, 30%, 22%)");
    root.style.setProperty("--color-on-error-container", "hsl(0, 50%, 80%)");
  } else {
    root.style.setProperty("--color-bg", `hsl(${h}, 14%, 97%)`);
    root.style.setProperty("--color-surface", "#ffffff");
    root.style.setProperty("--color-surface-dim", `hsl(${h}, 10%, 94%)`);
    root.style.setProperty("--color-surface-container", `hsl(${h}, 10%, 90%)`);
    root.style.setProperty("--color-primary", `hsl(${h}, 40%, 36%)`);
    root.style.setProperty("--color-primary-hover", `hsl(${h}, 42%, 44%)`);
    root.style.setProperty("--color-primary-container", `hsl(${h}, 38%, 85%)`);
    root.style.setProperty("--color-on-primary", "#ffffff");
    root.style.setProperty("--color-on-primary-container", `hsl(${h}, 45%, 15%)`);
    root.style.setProperty("--color-secondary", `hsl(${h}, 10%, 32%)`);
    root.style.setProperty("--color-secondary-container", `hsl(${h}, 14%, 85%)`);
    root.style.setProperty("--color-on-secondary-container", `hsl(${h}, 20%, 10%)`);
    root.style.setProperty("--color-tertiary", `hsl(${(h + 120) % 360}, 30%, 35%)`);
    root.style.setProperty("--color-tertiary-container", `hsl(${(h + 120) % 360}, 30%, 87%)`);
    root.style.setProperty("--color-on-tertiary-container", `hsl(${(h + 120) % 360}, 35%, 12%)`);
    root.style.setProperty("--color-text", `hsl(${h}, 8%, 10%)`);
    root.style.setProperty("--color-text-secondary", `hsl(${h}, 6%, 26%)`);
    root.style.setProperty("--color-text-muted", `hsl(${h}, 4%, 47%)`);
    root.style.setProperty("--color-border", `hsl(${h}, 8%, 77%)`);
    root.style.setProperty("--color-outline", `hsl(${h}, 4%, 47%)`);
    root.style.setProperty("--color-error", "#ba1a1a");
    root.style.setProperty("--color-error-container", "#ffdad6");
    root.style.setProperty("--color-on-error-container", "#410002");
  }
}

function showThemeDialog() {
  const prefs = loadThemePreferences();
  let selectedColor = prefs.colorIndex;
  let selectedMode = prefs.mode;

  function renderContent() {
    return `
      <div class="theme-dialog">
        <div class="theme-section">
          <label class="field-label">Color</label>
          <div class="theme-color-grid">
            ${THEME_COLORS.map((c, i) => `
              <button class="theme-color-swatch ${i === selectedColor ? "selected" : ""}" data-color-idx="${i}" style="background: ${c.primary}" title="${c.name}"></button>
            `).join("")}
          </div>
        </div>
        <div class="theme-section">
          <label class="field-label">Appearance</label>
          <div class="chip-group">
            ${THEME_MODES.map(m => `
              <button class="chip ${m === selectedMode ? "chip-selected" : ""}" data-theme-mode="${m}">${m.charAt(0).toUpperCase() + m.slice(1)}</button>
            `).join("")}
          </div>
        </div>
      </div>
    `;
  }

  function attachEvents() {
    document.querySelectorAll("[data-color-idx]").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedColor = Number(btn.dataset.colorIdx);
        const newPrefs = { colorIndex: selectedColor, mode: selectedMode };
        applyTheme(newPrefs);
        updateDialogContent(renderContent()); attachEvents();
      });
    });
    document.querySelectorAll("[data-theme-mode]").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedMode = btn.dataset.themeMode;
        const newPrefs = { colorIndex: selectedColor, mode: selectedMode };
        applyTheme(newPrefs);
        updateDialogContent(renderContent()); attachEvents();
      });
    });
  }

  showDialog("Theme", renderContent(), [
    { text: "Cancel", action: () => { applyTheme(prefs); return true; } },
    { text: "Apply", primary: true, action: () => {
      const newPrefs = { colorIndex: selectedColor, mode: selectedMode };
      saveThemePreferences(newPrefs);
      applyTheme(newPrefs);
      return true;
    }},
  ], attachEvents);
}

// --- Toolbar ---

function setupToolbar() {
  document.getElementById("btn-theme").addEventListener("click", showThemeDialog);
  document.getElementById("btn-import").addEventListener("click", async () => {
    const success = await importDataFromFile();
    if (success) { showToast("Data imported successfully"); renderCurrentView(); }
  });
  document.getElementById("btn-export").addEventListener("click", () => {
    exportDataToFile(); showToast("Data exported");
  });
}

// --- Navigation Setup ---

function setupNavigation() {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => switchTab(item.dataset.tab));
  });
}

// --- Boot ---

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(loadThemePreferences());
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const prefs = loadThemePreferences();
    if (prefs.mode === "system") applyTheme(prefs);
  });
  setupNavigation();
  setupToolbar();
  initApp();
});
