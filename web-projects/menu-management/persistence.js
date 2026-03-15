// --- Persistence Layer ---
// localStorage + JSON file import/export

const STORAGE_KEYS = {
  ingredients: "menuMgmt_ingredients",
  recipes: "menuMgmt_recipes",
  configurations: "menuMgmt_configurations",
  menu: "menuMgmt_menu",
};

// --- localStorage ---

/** @param {string} key @param {*} data */
function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
  }
}

/** @param {string} key @returns {*|null} */
function loadFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("Failed to load from localStorage:", e);
    return null;
  }
}

/** Save all app state to localStorage. */
function saveAllToStorage() {
  saveToStorage(STORAGE_KEYS.ingredients, appState.ingredients);
  saveToStorage(STORAGE_KEYS.recipes, appState.recipes);
  saveToStorage(STORAGE_KEYS.configurations, appState.configurations);
  if (appState.currentMenu) {
    saveToStorage(STORAGE_KEYS.menu, appState.currentMenu);
  }
}

/** Load all app state from localStorage. */
function loadAllFromStorage() {
  const ingredients = loadFromStorage(STORAGE_KEYS.ingredients);
  const recipes = loadFromStorage(STORAGE_KEYS.recipes);
  const configurations = loadFromStorage(STORAGE_KEYS.configurations);
  const menu = loadFromStorage(STORAGE_KEYS.menu);

  if (ingredients) appState.ingredients = ingredients;
  if (recipes) appState.recipes = recipes;
  if (configurations) appState.configurations = configurations;
  if (menu) appState.currentMenu = menu;
}

// --- JSON File Export ---

/** Export ingredients + recipes + configurations as a downloadable JSON file. */
function exportDataToFile() {
  const data = {
    Ingredients: appState.ingredients,
    Recipes: appState.recipes,
    Configurations: appState.configurations,
  };
  downloadJson(data, "RecipeBook.json");
}

/** Export current menu as a downloadable JSON file. */
function exportMenuToFile() {
  if (!appState.currentMenu) return;
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const daysUntilSat = (6 - dayOfWeek + 7) % 7;
  const nextSat = new Date(now);
  nextSat.setDate(now.getDate() + daysUntilSat);
  const dateStr = `${nextSat.getFullYear()}-${nextSat.getMonth() + 1}-${nextSat.getDate()}`;
  downloadJson(appState.currentMenu, `Menu-${dateStr}.json`);
}

/**
 * @param {*} data
 * @param {string} filename
 */
function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- JSON File Import ---

/**
 * Import ingredients + recipes from a JSON file.
 * @returns {Promise<boolean>} true if data was loaded
 */
function importDataFromFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.tsr";
    input.addEventListener("change", () => {
      const file = input.files[0];
      if (!file) { resolve(false); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const json = JSON.parse(/** @type {string} */ (reader.result));
          if (json.Ingredients) appState.ingredients = json.Ingredients;
          if (json.Recipes) appState.recipes = json.Recipes;
          if (json.Configurations) appState.configurations = json.Configurations;
          saveAllToStorage();
          resolve(true);
        } catch (e) {
          console.error("Failed to parse imported file:", e);
          showToast("Failed to import file: invalid JSON");
          resolve(false);
        }
      };
      reader.readAsText(file);
    });
    input.click();
  });
}

/**
 * Import a menu from a JSON file.
 * @returns {Promise<Menu|null>}
 */
function importMenuFromFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.tsm";
    input.addEventListener("change", () => {
      const file = input.files[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const menu = JSON.parse(/** @type {string} */ (reader.result));
          resolve(menu);
        } catch (e) {
          console.error("Failed to parse menu file:", e);
          showToast("Failed to import menu: invalid JSON");
          resolve(null);
        }
      };
      reader.readAsText(file);
    });
    input.click();
  });
}
