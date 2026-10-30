import { matchRecipe, matchRecipes, type MatchRecipe, type MatchSubstitution } from '../src';

const daiquiri: MatchRecipe = {
  id: 'daiquiri',
  name: 'Daiquiri',
  ingredients: [
    { ingredientId: 'white-rum', optional: false },
    { ingredientId: 'lime-juice', optional: false },
    { ingredientId: 'simple-syrup', optional: false },
  ],
};

const whiskeySour: MatchRecipe = {
  id: 'whiskey-sour',
  name: 'Whiskey Sour',
  ingredients: [
    { ingredientId: 'bourbon', optional: false },
    { ingredientId: 'lemon-juice', optional: false },
    { ingredientId: 'gomme-syrup', optional: false },
    { ingredientId: 'egg-white', optional: true },
  ],
};

const syrupForGomme: MatchSubstitution = {
  ingredientId: 'gomme-syrup',
  substituteId: 'simple-syrup',
  recipeId: null,
  ratio: 1,
};

describe('matchRecipe', () => {
  it('is an EXACT_MATCH when every required ingredient is available', () => {
    const result = matchRecipe(daiquiri, new Set(['white-rum', 'lime-juice', 'simple-syrup']), []);
    expect(result.classification).toBe('EXACT_MATCH');
    expect(result.missingRequired).toEqual([]);
    expect(result.substitutions).toEqual([]);
  });

  it('does not require optional ingredients', () => {
    const result = matchRecipe(whiskeySour, new Set(['bourbon', 'lemon-juice', 'gomme-syrup']), []);
    expect(result.classification).toBe('EXACT_MATCH');
    expect(result.missingOptional).toEqual(['egg-white']);
  });

  it('is ADAPTABLE when a missing ingredient has an approved substitute the user has', () => {
    const result = matchRecipe(whiskeySour, new Set(['bourbon', 'lemon-juice', 'simple-syrup']), [
      syrupForGomme,
    ]);
    expect(result.classification).toBe('ADAPTABLE');
    expect(result.substitutions).toEqual([
      { ingredientId: 'gomme-syrup', substituteId: 'simple-syrup', ratio: 1 },
    ]);
    expect(result.missingRequired).toEqual([]);
  });

  it('is INCOMPLETE when a required ingredient is missing and has no usable substitute', () => {
    const result = matchRecipe(daiquiri, new Set(['white-rum', 'simple-syrup']), [syrupForGomme]);
    expect(result.classification).toBe('INCOMPLETE');
    expect(result.missingRequired).toEqual(['lime-juice']);
  });

  it('ignores a substitute the user does not have', () => {
    const result = matchRecipe(whiskeySour, new Set(['bourbon', 'lemon-juice']), [syrupForGomme]);
    expect(result.classification).toBe('INCOMPLETE');
    expect(result.missingRequired).toEqual(['gomme-syrup']);
  });

  it('applies a recipe-specific substitution only to that recipe', () => {
    const onlyForOtherRecipe: MatchSubstitution = { ...syrupForGomme, recipeId: 'another-recipe' };
    const result = matchRecipe(whiskeySour, new Set(['bourbon', 'lemon-juice', 'simple-syrup']), [
      onlyForOtherRecipe,
    ]);
    expect(result.classification).toBe('INCOMPLETE');
  });

  it('rejects a substitute that is already an ingredient of the same recipe', () => {
    const lemonForLime: MatchSubstitution = {
      ingredientId: 'gomme-syrup',
      substituteId: 'lemon-juice',
      recipeId: null,
      ratio: 1,
    };
    const result = matchRecipe(whiskeySour, new Set(['bourbon', 'lemon-juice']), [lemonForLime]);
    expect(result.classification).toBe('INCOMPLETE');
  });

  it('prefers a recipe-specific substitution over a global one', () => {
    const global: MatchSubstitution = { ...syrupForGomme, substituteId: 'a-syrup' };
    const specific: MatchSubstitution = {
      ...syrupForGomme,
      substituteId: 'z-syrup',
      recipeId: 'whiskey-sour',
      ratio: 0.75,
    };
    const result = matchRecipe(
      whiskeySour,
      new Set(['bourbon', 'lemon-juice', 'a-syrup', 'z-syrup']),
      [global, specific],
    );
    expect(result.substitutions).toEqual([
      { ingredientId: 'gomme-syrup', substituteId: 'z-syrup', ratio: 0.75 },
    ]);
  });

  it('chooses among equivalent substitutes deterministically regardless of input order', () => {
    const first: MatchSubstitution = { ...syrupForGomme, substituteId: 'b-syrup' };
    const second: MatchSubstitution = { ...syrupForGomme, substituteId: 'a-syrup' };
    const available = new Set(['bourbon', 'lemon-juice', 'a-syrup', 'b-syrup']);
    const one = matchRecipe(whiskeySour, available, [first, second]);
    const other = matchRecipe(whiskeySour, available, [second, first]);
    expect(one.substitutions).toEqual(other.substitutions);
    expect(one.substitutions[0].substituteId).toBe('a-syrup');
  });

  it('does not chain substitutions', () => {
    const chain: MatchSubstitution[] = [
      syrupForGomme,
      { ingredientId: 'simple-syrup', substituteId: 'sugar', recipeId: null, ratio: 1 },
    ];
    const result = matchRecipe(whiskeySour, new Set(['bourbon', 'lemon-juice', 'sugar']), chain);
    expect(result.classification).toBe('INCOMPLETE');
  });
});

describe('matchRecipes', () => {
  const negroni: MatchRecipe = {
    id: 'negroni',
    name: 'Negroni',
    ingredients: [
      { ingredientId: 'gin', optional: false },
      { ingredientId: 'campari', optional: false },
      { ingredientId: 'sweet-vermouth', optional: false },
    ],
  };

  const available = ['white-rum', 'lime-juice', 'simple-syrup', 'bourbon', 'lemon-juice', 'gin'];

  it('orders results: exact matches, then adaptable, then incomplete by fewest missing', () => {
    const results = matchRecipes([negroni, whiskeySour, daiquiri], available, [syrupForGomme]);
    expect(results.map((r) => [r.recipeId, r.classification])).toEqual([
      ['daiquiri', 'EXACT_MATCH'],
      ['whiskey-sour', 'ADAPTABLE'],
      ['negroni', 'INCOMPLETE'],
    ]);
  });

  it('can exclude incomplete recipes', () => {
    const results = matchRecipes([negroni, whiskeySour, daiquiri], available, [syrupForGomme], {
      includeIncomplete: false,
    });
    expect(results.map((r) => r.recipeId)).toEqual(['daiquiri', 'whiskey-sour']);
  });

  it('can limit incomplete recipes to a maximum number of missing ingredients', () => {
    const results = matchRecipes([negroni], ['gin', 'campari'], [], { maxMissing: 1 });
    expect(results.map((r) => r.recipeId)).toEqual(['negroni']);
    expect(matchRecipes([negroni], ['gin'], [], { maxMissing: 1 })).toEqual([]);
  });

  it('breaks ties by name so the order is stable', () => {
    const a: MatchRecipe = {
      id: '2',
      name: 'Bramble',
      ingredients: [{ ingredientId: 'gin', optional: false }],
    };
    const b: MatchRecipe = {
      id: '1',
      name: 'Aviation',
      ingredients: [{ ingredientId: 'gin', optional: false }],
    };
    expect(matchRecipes([a, b], ['gin'], []).map((r) => r.recipeName)).toEqual([
      'Aviation',
      'Bramble',
    ]);
  });
});
