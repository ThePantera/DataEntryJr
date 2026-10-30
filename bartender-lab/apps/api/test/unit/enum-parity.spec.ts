import * as shared from '@bartender-lab/shared';
import { $Enums } from '@prisma/client';

/** The mobile app uses @bartender-lab/shared offline; its enums must match the database. */
describe('shared enums match the Prisma schema', () => {
  const pairs: Array<[string, readonly string[], Record<string, string>]> = [
    ['Unit', shared.UNITS, $Enums.Unit],
    ['IceType', shared.ICE_TYPES, $Enums.IceType],
    ['Difficulty', shared.DIFFICULTIES, $Enums.Difficulty],
    ['VerificationStatus', shared.VERIFICATION_STATUSES, $Enums.VerificationStatus],
    ['RecipeOrigin', shared.RECIPE_ORIGINS, $Enums.RecipeOrigin],
    ['Allergen', shared.ALLERGENS, $Enums.Allergen],
    ['UserRole', shared.USER_ROLES, $Enums.UserRole],
    ['CategoryKind', shared.CATEGORY_KINDS, $Enums.CategoryKind],
    ['ResourceType', shared.RESOURCE_TYPES, $Enums.ResourceType],
  ];

  it.each(pairs)('%s', (_name, sharedValues, prismaEnum) => {
    expect([...sharedValues].sort()).toEqual(Object.values(prismaEnum).sort());
  });
});
