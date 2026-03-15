// --- UUID Generation ---

/** @returns {string} */
function generateId() {
  return crypto.randomUUID();
}

// --- Enums ---

/** @enum {number} */
const WeekDay = Object.freeze({
  saturday: 0,
  sunday: 1,
  monday: 2,
  tuesday: 3,
  wednesday: 4,
  thursday: 5,
  friday: 6,
});

/** @type {string[]} */
const WEEK_DAY_NAMES = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/** @enum {number} */
const MealType = Object.freeze({
  breakfast: 0,
  lunch: 1,
  dinner: 2,
});

/** @type {string[]} */
const MEAL_TYPE_NAMES = ["Breakfast", "Lunch", "Dinner"];

/** @enum {number} */
const RecipeType = Object.freeze({
  breakfast: 0,
  meal: 1,
  snack: 3,
  dessert: 4,
});

/** @type {Record<number, string>} */
const RECIPE_TYPE_NAMES = {
  [RecipeType.breakfast]: "Breakfast",
  [RecipeType.meal]: "Meal",
  [RecipeType.snack]: "Snack",
  [RecipeType.dessert]: "Dessert",
};

/** @enum {number} */
const Unit = Object.freeze({
  grams: 0,
  centiliters: 1,
  pieces: 2,
  tablespoons: 3,
  teaspoons: 4,
});

/** @type {Record<number, string>} */
const UNIT_NAMES = {
  [Unit.grams]: "grams",
  [Unit.centiliters]: "centiliters",
  [Unit.pieces]: "pieces",
  [Unit.tablespoons]: "tablespoons",
  [Unit.teaspoons]: "teaspoons",
};

/** @type {Record<number, string>} */
const UNIT_SHORT = {
  [Unit.grams]: "g",
  [Unit.centiliters]: "cl",
  [Unit.pieces]: "pcs",
  [Unit.tablespoons]: "tbsp",
  [Unit.teaspoons]: "tsp",
};

// --- Model Factories ---

/**
 * @param {object} opts
 * @param {string} [opts.id]
 * @param {string} opts.name
 * @returns {{id: string, name: string}}
 */
function createIngredient({ id, name }) {
  return { id: id || generateId(), name };
}

/**
 * @param {object} opts
 * @param {double} opts.amount
 * @param {number} opts.unit
 * @returns {{amount: number, unit: number}}
 */
function createQuantity({ amount, unit }) {
  return { amount, unit };
}

/**
 * @param {object} opts
 * @param {string} opts.ingredient - ingredient ID
 * @param {{amount: number, unit: number}} opts.quantity
 * @returns {{ingredient: string, quantity: {amount: number, unit: number}}}
 */
function createIngredientUsage({ ingredient, quantity }) {
  return { ingredient, quantity };
}

/**
 * @param {object} opts
 * @param {string} [opts.id]
 * @param {string} opts.description
 * @returns {{id: string, description: string}}
 */
function createResult({ id, description }) {
  return { id: id || generateId(), description };
}

/**
 * @param {object} opts
 * @param {string} [opts.id]
 * @param {string} opts.description
 * @param {number} [opts.workingTimeMinutes]
 * @param {number} [opts.cookingTimeMinutes]
 * @param {Array} [opts.ingredientsUsed]
 * @param {Array} [opts.outputs]
 * @param {string[]} [opts.inputs]
 * @returns {Instruction}
 */
function createInstruction({ id, description, workingTimeMinutes = 10, cookingTimeMinutes = 10, ingredientsUsed = [], outputs = [], inputs = [] }) {
  return { id: id || generateId(), description, workingTimeMinutes, cookingTimeMinutes, ingredientsUsed, outputs, inputs };
}

/** @param {Instruction} instruction @returns {number} */
function instructionTotalTime(instruction) {
  return instruction.workingTimeMinutes + instruction.cookingTimeMinutes;
}

/**
 * @param {object} opts
 * @param {string} [opts.id]
 * @param {string} opts.name
 * @param {Instruction[]} [opts.instructions]
 * @param {boolean} [opts.carbs]
 * @param {boolean} [opts.proteins]
 * @param {boolean} [opts.vegetables]
 * @param {number} [opts.type]
 * @param {boolean} [opts.lunch]
 * @param {boolean} [opts.dinner]
 * @param {boolean} [opts.canBeStored]
 * @param {boolean} [opts.includeInMenuGeneration]
 * @returns {Recipe}
 */
function createRecipe({
  id, name, instructions = [],
  carbs = true, proteins = true, vegetables = true,
  type = RecipeType.meal,
  lunch = true, dinner = true,
  canBeStored = true, includeInMenuGeneration = true,
}) {
  return { id: id || generateId(), name, instructions, carbs, proteins, vegetables, type, lunch, dinner, canBeStored, includeInMenuGeneration };
}

/** @param {Recipe} recipe @returns {number} */
function recipeWorkingTime(recipe) {
  return recipe.instructions.reduce((sum, inst) => sum + inst.workingTimeMinutes, 0);
}

/** @param {Recipe} recipe @returns {number} */
function recipeCookingTime(recipe) {
  return recipe.instructions.reduce((sum, inst) => sum + inst.cookingTimeMinutes, 0);
}

/** @param {Recipe} recipe @returns {number} */
function recipeTotalTime(recipe) {
  return recipe.instructions.reduce((sum, inst) => sum + inst.workingTimeMinutes + inst.cookingTimeMinutes, 0);
}

/** @param {Recipe} recipe @returns {string} */
function recipeShortString(recipe) {
  return `${recipe.name} (${recipeTotalTime(recipe)}min)`;
}

/**
 * Check if a recipe fits a menu configuration.
 * @param {Recipe} recipe
 * @param {MenuConfiguration} configuration
 * @param {boolean} needToBeStored
 * @param {boolean} strictMealTime
 * @returns {boolean}
 */
function recipeFitsConfiguration(recipe, configuration, needToBeStored, strictMealTime) {
  if (needToBeStored && !recipe.canBeStored) return false;
  if (!configurationCanBeCookedAtTheSpot(configuration) && recipeTotalTime(recipe) > 0) return false;
  if (configurationIsMeal(configuration) && !recipe.lunch && !recipe.dinner) return false;
  if (strictMealTime) {
    // Match Flutter logic: reject recipes marked for the *other* meal time only
    if (configuration.mealType === MealType.breakfast && (recipe.lunch || recipe.dinner)) return false;
    if (configuration.mealType === MealType.lunch && recipe.dinner && !recipe.lunch) return false;
    if (configuration.mealType === MealType.dinner && recipe.lunch && !recipe.dinner) return false;
  }
  return true;
}

// --- MealTime helpers ---

/**
 * @param {number} weekDay
 * @param {number} mealType
 * @returns {{weekDay: number, mealType: number}}
 */
function createMealTime(weekDay, mealType) {
  return { weekDay, mealType };
}

/** @param {{weekDay: number, mealType: number}} a @param {{weekDay: number, mealType: number}} b @returns {boolean} */
function mealTimeSame(a, b) {
  return a.weekDay === b.weekDay && a.mealType === b.mealType;
}

/** @param {{weekDay: number, mealType: number}} a @param {{weekDay: number, mealType: number}} b @returns {boolean} */
function mealTimeBefore(a, b) {
  if (a.weekDay === b.weekDay) return a.mealType < b.mealType;
  return a.weekDay < b.weekDay;
}

// --- MenuConfiguration ---

/**
 * @param {object} opts
 * @param {number} opts.weekDay
 * @param {number} opts.mealType
 * @param {boolean} [opts.requiresMeal]
 * @param {number} [opts.availableCookingTimeMinutes]
 * @returns {MenuConfiguration}
 */
function createMenuConfiguration({ weekDay, mealType, requiresMeal = true, availableCookingTimeMinutes = 60 }) {
  return { weekDay, mealType, requiresMeal, availableCookingTimeMinutes };
}

/** @param {MenuConfiguration} config @returns {boolean} */
function configurationIsMeal(config) {
  return config.mealType === MealType.lunch || config.mealType === MealType.dinner;
}

/** @param {MenuConfiguration} config @returns {boolean} */
function configurationCanBeCookedAtTheSpot(config) {
  return config.requiresMeal && config.availableCookingTimeMinutes > 0;
}

/** @param {MenuConfiguration} a @param {MenuConfiguration} b @returns {boolean} */
function configurationBefore(a, b) {
  return mealTimeBefore(createMealTime(a.weekDay, a.mealType), createMealTime(b.weekDay, b.mealType));
}

// --- Cooking ---

/**
 * @param {Recipe} recipe
 * @param {number} yieldCount
 * @returns {{recipe: Recipe, yield: number}}
 */
function createCooking(recipe, yieldCount) {
  return { recipe, yield: yieldCount };
}

// --- Meal ---

/**
 * @param {object} opts
 * @param {{recipe: Recipe, yield: number}|null} opts.cooking
 * @param {number} opts.weekDay
 * @param {number} opts.mealType
 * @param {number} [opts.people]
 * @returns {Meal}
 */
function createMeal({ cooking, weekDay, mealType, people = 2 }) {
  return { cooking, weekDay, mealType, people };
}

// --- Menu ---

/**
 * @param {Meal[]} meals
 * @returns {Menu}
 */
function createMenu(meals) {
  return { meals };
}

/**
 * Update yields on a menu: first occurrence of each recipe gets yield = total count, others get 0.
 * @param {Menu} menu
 * @returns {Menu}
 */
function menuUpdateYields(menu) {
  const sortedMeals = [...menu.meals].sort((a, b) => {
    const mtA = createMealTime(a.weekDay, a.mealType);
    const mtB = createMealTime(b.weekDay, b.mealType);
    return mealTimeBefore(mtA, mtB) ? -1 : mealTimeBefore(mtB, mtA) ? 1 : 0;
  });

  /** @type {Map<string, boolean>} track which recipe IDs have been seen */
  const seenRecipeIds = new Set();

  const updatedMeals = sortedMeals.map(meal => {
    if (!meal.cooking) return meal;
    const recipeId = meal.cooking.recipe.id;
    let yieldCount = 1;
    if (meal.cooking.recipe.canBeStored) {
      if (!seenRecipeIds.has(recipeId)) {
        seenRecipeIds.add(recipeId);
        // Count total occurrences
        yieldCount = menu.meals.filter(m => m.cooking && m.cooking.recipe.id === recipeId).length;
      } else {
        yieldCount = 0;
      }
    }
    return { ...meal, cooking: createCooking(meal.cooking.recipe, yieldCount) };
  });

  return createMenu(updatedMeals);
}

/**
 * Get meals for a specific day, returns [breakfast, lunch, dinner] (null if missing).
 * @param {Menu} menu
 * @param {number} weekDay
 * @returns {(Meal|null)[]}
 */
function menuMealsOfDay(menu, weekDay) {
  const dayMeals = menu.meals.filter(m => m.weekDay === weekDay);
  return [
    dayMeals.find(m => m.mealType === MealType.breakfast) || null,
    dayMeals.find(m => m.mealType === MealType.lunch) || null,
    dayMeals.find(m => m.mealType === MealType.dinner) || null,
  ];
}

/**
 * Replace a recipe in a meal slot and recalculate yields.
 * @param {Menu} menu
 * @param {number} weekDay
 * @param {number} mealType
 * @param {Recipe} recipe
 * @returns {Menu}
 */
function menuUpdateRecipe(menu, weekDay, mealType, recipe) {
  const newMeals = menu.meals.map(meal => {
    if (meal.weekDay === weekDay && meal.mealType === mealType) {
      return { ...meal, cooking: createCooking(recipe, 1) };
    }
    return meal;
  });
  return menuUpdateYields(createMenu(newMeals));
}

/**
 * Update people count for a meal slot.
 * @param {Menu} menu
 * @param {number} weekDay
 * @param {number} mealType
 * @param {number} people
 * @returns {Menu}
 */
function menuUpdatePeople(menu, weekDay, mealType, people) {
  const newMeals = menu.meals.map(meal => {
    if (meal.weekDay === weekDay && meal.mealType === mealType) {
      return { ...meal, people };
    }
    return meal;
  });
  return createMenu(newMeals);
}

/**
 * Aggregate all ingredients from a menu.
 * @param {Menu} menu
 * @returns {Map<string, {amount: number, unit: number}[]>}
 */
function menuAllIngredients(menu) {
  /** @type {Record<string, {amount: number, unit: number}[]>} */
  const ingredients = {};

  for (const meal of menu.meals) {
    if (!meal.cooking) continue;
    const yields = meal.cooking.yield;

    let peopleFactor;
    if (yields > 0) {
      peopleFactor = menu.meals
        .filter(m => m.cooking && m.cooking.recipe.id === meal.cooking.recipe.id)
        .reduce((sum, m) => sum + m.people, 0);
    } else {
      peopleFactor = 0;
    }

    for (const instruction of meal.cooking.recipe.instructions) {
      for (const usage of instruction.ingredientsUsed) {
        const ingId = usage.ingredient;
        if (!ingredients[ingId]) ingredients[ingId] = [];

        const existing = ingredients[ingId].find(q => q.unit === usage.quantity.unit);
        const amountToAdd = usage.quantity.amount * peopleFactor;

        if (existing) {
          existing.amount += amountToAdd;
        } else {
          ingredients[ingId].push(createQuantity({ amount: amountToAdd, unit: usage.quantity.unit }));
        }
      }
    }
  }

  return ingredients;
}

/**
 * Format menu as beautified string.
 * @param {Menu} menu
 * @returns {string}
 */
function menuToString(menu) {
  let result = "";
  for (let wd = 0; wd < 7; wd++) {
    result += WEEK_DAY_NAMES[wd] + "\n";
    const dayMeals = menuMealsOfDay(menu, wd);
    for (let mt = 0; mt < 3; mt++) {
      const meal = dayMeals[mt];
      let recipeStr = "-";
      if (meal && meal.cooking) {
        recipeStr = `${meal.cooking.recipe.name} (${meal.cooking.yield} pp)`;
      }
      result += `  ${MEAL_TYPE_NAMES[mt]}: ${recipeStr}\n`;
    }
    result += "\n";
  }
  return result.trim();
}

/**
 * Format a number: show decimals only if not integer.
 * @param {number} value
 * @returns {string}
 */
function formatNumber(value) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
