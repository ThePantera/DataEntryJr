import type {
  IceType,
  RecipeOrigin,
  Unit,
  UserRole,
  VerificationStatus,
} from '@bartender-lab/shared';

/**
 * Editorial workflow for recipes (spec section 8).
 *
 *   DRAFT ──► REVIEW ──► VERIFIED ──► PUBLISHED
 *     ▲         │           │             │
 *     └─────────┴───────────┴─────────────┘  (back to DRAFT)
 *
 * Only PUBLISHED recipes are visible to the public. Reaching VERIFIED or PUBLISHED requires
 * quantities, method, glass, ice and instructions. Only admins publish, unpublish or edit
 * official (VERIFIED/PUBLISHED) recipes; common users never change recipes.
 */

export type PublicationIssue =
  | 'MISSING_INGREDIENTS'
  | 'MISSING_QUANTITY'
  | 'MISSING_METHOD'
  | 'MISSING_GLASSWARE'
  | 'MISSING_ICE_TYPE'
  | 'MISSING_INSTRUCTIONS'
  | 'MISSING_SOURCE';

export interface PublicationCandidate {
  origin: RecipeOrigin;
  source: string | null;
  techniqueId: string | null;
  glasswareId: string | null;
  iceType: IceType | null;
  ingredients: ReadonlyArray<{ unit: Unit; quantity: number | null; optional: boolean }>;
  stepCount: number;
}

export function getPublicationIssues(recipe: PublicationCandidate): PublicationIssue[] {
  const issues: PublicationIssue[] = [];
  if (!recipe.ingredients.some((i) => !i.optional)) issues.push('MISSING_INGREDIENTS');
  if (recipe.ingredients.some((i) => i.unit !== 'TOP_UP' && i.quantity === null)) {
    issues.push('MISSING_QUANTITY');
  }
  if (!recipe.techniqueId) issues.push('MISSING_METHOD');
  if (!recipe.glasswareId) issues.push('MISSING_GLASSWARE');
  if (!recipe.iceType) issues.push('MISSING_ICE_TYPE');
  if (recipe.stepCount < 1) issues.push('MISSING_INSTRUCTIONS');
  if (recipe.origin === 'CLASSIC' && !recipe.source?.trim()) issues.push('MISSING_SOURCE');
  return issues;
}

export type TransitionResult =
  { ok: true } | { ok: false; reason: 'INVALID_TRANSITION' | 'FORBIDDEN' | 'INCOMPLETE' };

interface TransitionRule {
  roles: readonly UserRole[];
  requiresComplete: boolean;
}

const EDITORS: readonly UserRole[] = ['EDITOR', 'ADMIN'];
const ADMINS: readonly UserRole[] = ['ADMIN'];

const TRANSITIONS: Partial<
  Record<VerificationStatus, Partial<Record<VerificationStatus, TransitionRule>>>
> = {
  DRAFT: { REVIEW: { roles: EDITORS, requiresComplete: false } },
  REVIEW: {
    DRAFT: { roles: EDITORS, requiresComplete: false },
    VERIFIED: { roles: EDITORS, requiresComplete: true },
  },
  VERIFIED: {
    DRAFT: { roles: EDITORS, requiresComplete: false },
    PUBLISHED: { roles: ADMINS, requiresComplete: true },
  },
  PUBLISHED: { DRAFT: { roles: ADMINS, requiresComplete: false } },
};

export function validateStatusTransition(
  from: VerificationStatus,
  to: VerificationStatus,
  role: UserRole,
  issues: readonly PublicationIssue[],
): TransitionResult {
  const rule = TRANSITIONS[from]?.[to];
  if (!rule) return { ok: false, reason: 'INVALID_TRANSITION' };
  if (!rule.roles.includes(role)) return { ok: false, reason: 'FORBIDDEN' };
  if (rule.requiresComplete && issues.length > 0) return { ok: false, reason: 'INCOMPLETE' };
  return { ok: true };
}

/** Editors work on drafts and recipes in review; official recipes can only be changed by admins. */
export function canEditRecipe(status: VerificationStatus, role: UserRole): boolean {
  if (role === 'ADMIN') return true;
  if (role === 'EDITOR') return status === 'DRAFT' || status === 'REVIEW';
  return false;
}

/** Statuses whose content must stay complete after an edit. */
export function isOfficialStatus(status: VerificationStatus): boolean {
  return status === 'VERIFIED' || status === 'PUBLISHED';
}
