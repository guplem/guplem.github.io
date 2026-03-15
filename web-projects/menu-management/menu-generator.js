// --- Menu Generation Algorithm ---
// Port of Flutter MenuGenerator

/**
 * Seeded pseudo-random number generator (mulberry32).
 * @param {number} seed
 * @returns {function(): number} returns value in [0, 1)
 */
function createSeededRandom(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Shuffle an array in place using a seeded RNG.
 * @template T
 * @param {T[]} arr
 * @param {function(): number} rng
 * @returns {T[]}
 */
function shuffleWithRng(arr, rng) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate a weekly menu.
 * @param {MenuConfiguration[]} configurations
 * @param {Recipe[]} allRecipes
 * @param {number} baseSeed
 * @returns {Menu}
 */
function generateMenu(configurations, allRecipes, baseSeed) {
  let seedIncrement = 0;
  function nextSeed() {
    seedIncrement++;
    return baseSeed + seedIncrement;
  }

  const recipesIncludedInGeneration = allRecipes.filter(r => r.includeInMenuGeneration);

  // --- Breakfasts ---
  const breakfastConfigs = configurations.filter(c => c.requiresMeal && c.mealType === MealType.breakfast);
  const breakfastRecipes = new Set(shuffleWithRng(
    recipesIncludedInGeneration.filter(r => r.type === RecipeType.breakfast),
    createSeededRandom(nextSeed())
  ));
  const breakfastResult = getRecipesFor(breakfastConfigs, breakfastRecipes, nextSeed, recipesIncludedInGeneration);

  // --- Meals (lunch + dinner) ---
  const mealsConfigs = configurations.filter(c => c.requiresMeal && (c.mealType === MealType.lunch || c.mealType === MealType.dinner));
  const mealsRecipes = new Set(shuffleWithRng(
    recipesIncludedInGeneration.filter(r => r.type === RecipeType.meal),
    createSeededRandom(nextSeed())
  ));
  const mealsResult = getRecipesFor(mealsConfigs, mealsRecipes, nextSeed, recipesIncludedInGeneration);

  // --- Combine ---
  const allSelected = new Map([...breakfastResult, ...mealsResult]);

  const meals = configurations.filter(c => c.requiresMeal).map(config => {
    const key = `${config.weekDay}-${config.mealType}`;
    const recipe = allSelected.get(key) || null;
    return createMeal({
      cooking: recipe ? createCooking(recipe, -1) : null,
      weekDay: config.weekDay,
      mealType: config.mealType,
    });
  });

  return menuUpdateYields(createMenu(meals));
}

/**
 * @param {MenuConfiguration[]} configurationsToFindRecipesFor
 * @param {Set<Recipe>} recipesToConsider
 * @param {function(): number} nextSeed
 * @param {Recipe[]} allRecipes
 * @returns {Map<string, Recipe>}
 */
function getRecipesFor(configurationsToFindRecipesFor, recipesToConsider, nextSeed, allRecipes) {
  if (configurationsToFindRecipesFor.length === 0) return new Map();

  /** @type {Map<string, Recipe>} key = "weekDay-mealType" */
  const result = new Map();

  const configs = shuffleWithRng([...configurationsToFindRecipesFor], createSeededRandom(nextSeed()));

  const totalConfigs = configs.length;
  const canCookCount = configs.filter(c => configurationCanBeCookedAtTheSpot(c)).length;
  const pctCanCook = canCookCount / totalConfigs;
  const maxRepetitions = Math.ceil(totalConfigs * (pctCanCook / 3.1));

  function selectedRecipes() {
    return [...result.values()];
  }

  function configKey(config) {
    return `${config.weekDay}-${config.mealType}`;
  }

  function leastUsedSelectedRecipe() {
    const selected = selectedRecipes();
    if (selected.length === 0) return null;
    const countMap = new Map();
    for (const r of selected) {
      countMap.set(r.id, (countMap.get(r.id) || 0) + 1);
    }
    let leastRecipe = selected[0];
    let leastCount = countMap.get(leastRecipe.id);
    for (const r of selected) {
      const count = countMap.get(r.id);
      if (count < leastCount) {
        leastCount = count;
        leastRecipe = r;
      }
    }
    return leastRecipe;
  }

  // Sort by available cooking time (ascending)
  const configsByTime = [...configs].sort((a, b) => a.availableCookingTimeMinutes - b.availableCookingTimeMinutes);

  for (let i = 0; i < configsByTime.length; i++) {
    const config = configsByTime[i];
    const key = configKey(config);

    if (result.has(key)) continue;

    // Try to find a recipe directly
    let recipe = getValidRecipeForConfiguration({
      maxRepetitions,
      strictMealTime: true,
      configuration: config,
      candidates: recipesToConsider,
      needToBeStored: false,
      alreadySelected: selectedRecipes(),
      nextSeed,
    });

    if (recipe) {
      result.set(key, recipe);
    } else {
      // Try previous moments
      const previousConfigs = getPreviousMomentConfigurations(config, configs);
      const unsetPrevious = previousConfigs.filter(c => !result.has(configKey(c)));

      if (unsetPrevious.length === 0) {
        // All previous moments set, use least-used recipe
        const fallback = leastUsedSelectedRecipe();
        if (fallback) result.set(key, fallback);
      } else {
        let found = false;
        for (const prevConfig of unsetPrevious) {
          recipe = getValidRecipeForConfiguration({
            maxRepetitions,
            strictMealTime: false,
            configuration: prevConfig,
            candidates: recipesToConsider,
            needToBeStored: true,
            alreadySelected: selectedRecipes(),
            nextSeed,
          });
          if (recipe) {
            if (!selectedRecipes().some(r => r.id === recipe.id)) {
              result.set(configKey(prevConfig), recipe);
            }
            result.set(key, recipe);
            found = true;
            break;
          }
        }
        if (!found) {
          // Fallback
          const fallback = leastUsedSelectedRecipe();
          if (fallback) result.set(key, fallback);
        }
      }
    }
  }

  // --- Fill gaps ---
  const configsWithRecipe = new Set();
  const configsWithoutRecipe = [];
  for (const config of configs) {
    if (result.has(configKey(config))) {
      configsWithRecipe.add(config);
    } else {
      configsWithoutRecipe.push(config);
    }
  }

  for (const config of configsWithoutRecipe) {
    const previousSet = getPreviousMomentConfigurations(config, [...configsWithRecipe]);
    if (previousSet.length === 0) continue;

    const candidatesFromPrevious = new Set();
    for (const prev of previousSet) {
      const recipe = result.get(configKey(prev));
      if (recipe && recipe.canBeStored) candidatesFromPrevious.add(recipe);
    }

    if (candidatesFromPrevious.size === 0) continue;

    const configForSearch = { ...config, availableCookingTimeMinutes: 24 * 60 };
    const recipe = getValidRecipeForConfiguration({
      maxRepetitions,
      strictMealTime: false,
      configuration: configForSearch,
      candidates: candidatesFromPrevious,
      needToBeStored: true,
      alreadySelected: selectedRecipes(),
      nextSeed,
    });
    if (recipe) {
      result.set(configKey(config), recipe);
    }
  }

  return result;
}

/**
 * @param {object} opts
 * @param {number} opts.maxRepetitions
 * @param {boolean} opts.strictMealTime
 * @param {MenuConfiguration} opts.configuration
 * @param {Set<Recipe>|Iterable<Recipe>} opts.candidates
 * @param {boolean} opts.needToBeStored
 * @param {Recipe[]} opts.alreadySelected
 * @param {function(): number} opts.nextSeed
 * @returns {Recipe|null}
 */
function getValidRecipeForConfiguration({ maxRepetitions, strictMealTime, configuration, candidates, needToBeStored, alreadySelected, nextSeed }) {
  const rng = createSeededRandom(nextSeed());

  // Count nutritional categories already selected
  let selectedCarbs = 0, selectedProteins = 0, selectedVegetables = 0;
  for (const recipe of alreadySelected) {
    if (recipe.carbs) selectedCarbs++;
    if (recipe.proteins) selectedProteins++;
    if (recipe.vegetables) selectedVegetables++;
  }

  function getSelectedCount(id) {
    if (id === 1) return selectedCarbs;
    if (id === 2) return selectedProteins;
    if (id === 3) return selectedVegetables;
    return 0;
  }

  // Build shuffled candidates list
  let shuffledCandidates = shuffleWithRng([...candidates], rng);

  // Prioritize already-selected storable recipes (move to front)
  const uniqueAlreadySelected = shuffleWithRng([...new Set(alreadySelected.map(r => r.id))].map(id => alreadySelected.find(r => r.id === id)), createSeededRandom(nextSeed()));
  for (const recipe of uniqueAlreadySelected) {
    if (recipe.canBeStored && shuffledCandidates.some(c => c.id === recipe.id)) {
      shuffledCandidates = shuffledCandidates.filter(c => c.id !== recipe.id);
      shuffledCandidates.unshift(recipe);
    }
    const timesSelected = alreadySelected.filter(r => r.id === recipe.id).length;
    if (timesSelected >= maxRepetitions) {
      shuffledCandidates = shuffledCandidates.filter(c => c.id !== recipe.id);
      shuffledCandidates.push(recipe);
    }
  }

  // Find candidates per category
  const findFitting = (list) => list.find(r => recipeFitsConfiguration(r, configuration, needToBeStored, strictMealTime)) || null;

  const carbsRecipe = findFitting(shuffledCandidates.filter(r => r.carbs));
  const proteinsRecipe = findFitting(shuffledCandidates.filter(r => r.proteins));
  const vegetablesRecipe = findFitting(shuffledCandidates.filter(r => r.vegetables));
  const otherRecipe = findFitting(shuffledCandidates.filter(r => !r.carbs && !r.proteins && !r.vegetables));

  // Sort categories by least selected
  const categories = [
    { id: 1, recipe: carbsRecipe },
    { id: 2, recipe: proteinsRecipe },
    { id: 3, recipe: vegetablesRecipe },
  ].sort((a, b) => getSelectedCount(a.id) - getSelectedCount(b.id));

  categories.push({ id: 0, recipe: otherRecipe });

  return categories.find(c => c.recipe !== null)?.recipe || null;
}

/**
 * Get configurations that go before a given configuration.
 * @param {MenuConfiguration} target
 * @param {MenuConfiguration[]} possibleConfigs
 * @returns {MenuConfiguration[]}
 */
function getPreviousMomentConfigurations(target, possibleConfigs) {
  const all = [target, ...possibleConfigs];
  all.sort((a, b) => configurationBefore(a, b) ? -1 : configurationBefore(b, a) ? 1 : 0);
  const targetIndex = all.findIndex(c => c.weekDay === target.weekDay && c.mealType === target.mealType);
  return all.slice(0, targetIndex);
}
