import {
  canEditRecipe,
  getPublicationIssues,
  validateStatusTransition,
  type PublicationCandidate,
} from '../../src/recipes/recipe-workflow';

const complete: PublicationCandidate = {
  origin: 'CLASSIC',
  source: 'IBA Official Cocktails',
  techniqueId: 'shake',
  glasswareId: 'coupe',
  iceType: 'NONE',
  ingredients: [
    { unit: 'ML', quantity: 60, optional: false },
    { unit: 'TOP_UP', quantity: null, optional: false },
  ],
  stepCount: 3,
};

describe('getPublicationIssues', () => {
  it('accepts a recipe with quantities, method, glass, ice and instructions', () => {
    expect(getPublicationIssues(complete)).toEqual([]);
  });

  it('reports every missing requirement', () => {
    const issues = getPublicationIssues({
      ...complete,
      source: null,
      techniqueId: null,
      glasswareId: null,
      iceType: null,
      ingredients: [],
      stepCount: 0,
    });
    expect(issues).toEqual([
      'MISSING_INGREDIENTS',
      'MISSING_METHOD',
      'MISSING_GLASSWARE',
      'MISSING_ICE_TYPE',
      'MISSING_INSTRUCTIONS',
      'MISSING_SOURCE',
    ]);
  });

  it('requires a quantity for every measurable ingredient', () => {
    const issues = getPublicationIssues({
      ...complete,
      ingredients: [{ unit: 'ML', quantity: null, optional: false }],
    });
    expect(issues).toEqual(['MISSING_QUANTITY']);
  });

  it('does not require a documented source for original creations', () => {
    expect(getPublicationIssues({ ...complete, origin: 'ORIGINAL', source: null })).toEqual([]);
  });
});

describe('validateStatusTransition', () => {
  it('lets an editor send a draft to review without checks', () => {
    expect(validateStatusTransition('DRAFT', 'REVIEW', 'EDITOR', ['MISSING_METHOD'])).toEqual({
      ok: true,
    });
  });

  it('lets an editor verify a complete recipe in review', () => {
    expect(validateStatusTransition('REVIEW', 'VERIFIED', 'EDITOR', [])).toEqual({ ok: true });
  });

  it('refuses to verify an incomplete recipe', () => {
    expect(validateStatusTransition('REVIEW', 'VERIFIED', 'ADMIN', ['MISSING_ICE_TYPE'])).toEqual({
      ok: false,
      reason: 'INCOMPLETE',
    });
  });

  it('only lets an admin publish', () => {
    expect(validateStatusTransition('VERIFIED', 'PUBLISHED', 'EDITOR', [])).toEqual({
      ok: false,
      reason: 'FORBIDDEN',
    });
    expect(validateStatusTransition('VERIFIED', 'PUBLISHED', 'ADMIN', [])).toEqual({ ok: true });
  });

  it('does not allow skipping review', () => {
    expect(validateStatusTransition('DRAFT', 'PUBLISHED', 'ADMIN', [])).toEqual({
      ok: false,
      reason: 'INVALID_TRANSITION',
    });
    expect(validateStatusTransition('DRAFT', 'VERIFIED', 'ADMIN', [])).toEqual({
      ok: false,
      reason: 'INVALID_TRANSITION',
    });
  });

  it('only lets an admin unpublish', () => {
    expect(validateStatusTransition('PUBLISHED', 'DRAFT', 'EDITOR', [])).toEqual({
      ok: false,
      reason: 'FORBIDDEN',
    });
    expect(validateStatusTransition('PUBLISHED', 'DRAFT', 'ADMIN', [])).toEqual({ ok: true });
  });

  it('never lets a common user change a status', () => {
    expect(validateStatusTransition('DRAFT', 'REVIEW', 'USER', [])).toEqual({
      ok: false,
      reason: 'FORBIDDEN',
    });
  });
});

describe('canEditRecipe', () => {
  it('lets editors edit drafts and recipes in review only', () => {
    expect(canEditRecipe('DRAFT', 'EDITOR')).toBe(true);
    expect(canEditRecipe('REVIEW', 'EDITOR')).toBe(true);
    expect(canEditRecipe('VERIFIED', 'EDITOR')).toBe(false);
    expect(canEditRecipe('PUBLISHED', 'EDITOR')).toBe(false);
  });

  it('lets admins edit official recipes', () => {
    expect(canEditRecipe('PUBLISHED', 'ADMIN')).toBe(true);
  });

  it('never lets a common user edit a recipe', () => {
    expect(canEditRecipe('DRAFT', 'USER')).toBe(false);
    expect(canEditRecipe('PUBLISHED', 'USER')).toBe(false);
  });
});
