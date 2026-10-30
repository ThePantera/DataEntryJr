import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Prisma, VerificationStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../common/authenticated-user';
import { toNumber } from '../common/utils/decimal';
import { rejectNulls } from '../common/utils/reject-nulls';
import { slugify } from '../common/utils/slug';
import { ManifestService } from '../manifest/manifest.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateRecipeDto,
  RecipeDetailDto,
  RecipeIngredientInputDto,
  RecipeStepInputDto,
  UpdateRecipeDto,
} from './dto/recipes.dto';
import { DETAIL_INCLUDE, toRecipeDetail, type RecipeDetailRow } from './recipe.mapper';
import {
  canEditRecipe,
  getPublicationIssues,
  isOfficialStatus,
  validateStatusTransition,
  type PublicationIssue,
} from './recipe-workflow';

type Tx = Prisma.TransactionClient;

function incompleteError(issues: PublicationIssue[]): UnprocessableEntityException {
  return new UnprocessableEntityException({
    statusCode: 422,
    error: 'Unprocessable Entity',
    message: 'The recipe does not meet the requirements of its status',
    issues,
  });
}

function ingredientRows(ingredients: RecipeIngredientInputDto[]) {
  return ingredients.map((line, position) => ({
    ingredientId: line.ingredientId,
    quantity: line.unit === 'TOP_UP' ? null : (line.quantity ?? null),
    unit: line.unit,
    optional: line.optional ?? false,
    position,
  }));
}

function stepRows(steps: RecipeStepInputDto[]) {
  return steps.map((step, index) => ({
    stepNumber: index + 1,
    instruction: step.instruction,
    durationSeconds: step.durationSeconds ?? null,
    imageUrl: step.imageUrl ?? null,
  }));
}

/** Editorial writes. Every route using this service is restricted to EDITOR/ADMIN by the controller. */
@Injectable()
export class RecipeAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly manifest: ManifestService,
  ) {}

  async create(dto: CreateRecipeDto, user: AuthenticatedUser): Promise<RecipeDetailDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      await this.validateReferences(tx, dto);
      const slug = dto.slug
        ? await this.assertSlugAvailable(tx, dto.slug)
        : await this.uniqueSlug(tx, dto.name);
      const { ingredients, steps, categoryIds, ...fields } = dto;
      return tx.recipe.create({
        data: {
          ...fields,
          slug,
          verificationStatus: 'DRAFT',
          createdById: user.id,
          ingredients: { create: ingredientRows(ingredients) },
          steps: { create: stepRows(steps) },
          categories: { create: (categoryIds ?? []).map((categoryId) => ({ categoryId })) },
        },
        include: DETAIL_INCLUDE,
      });
    });
    return toRecipeDetail(row);
  }

  async update(
    id: string,
    dto: UpdateRecipeDto,
    user: AuthenticatedUser,
  ): Promise<RecipeDetailDto> {
    rejectNulls(dto, [
      'name',
      'slug',
      'description',
      'difficulty',
      'servings',
      'origin',
      'categoryIds',
      'ingredients',
      'steps',
      'version',
    ]);
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await this.findForUpdate(tx, id);
      if (!canEditRecipe(current.verificationStatus, user.role)) {
        throw new ForbiddenException('Only admins can modify verified or published recipes');
      }
      if (dto.version !== undefined && dto.version !== current.version) {
        throw new ConflictException('Recipe was modified by someone else (version mismatch)');
      }
      await this.validateReferences(tx, dto);
      if (dto.slug && dto.slug !== current.slug) await this.assertSlugAvailable(tx, dto.slug);

      const { ingredients, steps, categoryIds, version: _version, ...fields } = dto;
      if (isOfficialStatus(current.verificationStatus)) {
        const issues = getPublicationIssues({
          origin: fields.origin ?? current.origin,
          source: fields.source !== undefined ? fields.source : current.source,
          techniqueId: fields.techniqueId !== undefined ? fields.techniqueId : current.techniqueId,
          glasswareId: fields.glasswareId !== undefined ? fields.glasswareId : current.glasswareId,
          iceType: fields.iceType !== undefined ? fields.iceType : current.iceType,
          ingredients: ingredients
            ? ingredientRows(ingredients)
            : current.ingredients.map((i) => ({ ...i, quantity: toNumber(i.quantity) })),
          stepCount: steps ? steps.length : current.steps.length,
        });
        if (issues.length > 0) throw incompleteError(issues);
      }

      const { count } = await tx.recipe.updateMany({
        where: { id, version: current.version },
        data: { ...fields, version: { increment: 1 } },
      });
      if (count === 0)
        throw new ConflictException('Recipe was modified by someone else (version mismatch)');

      if (ingredients) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
        await tx.recipeIngredient.createMany({
          data: ingredientRows(ingredients).map((line) => ({ ...line, recipeId: id })),
        });
      }
      if (steps) {
        await tx.recipeStep.deleteMany({ where: { recipeId: id } });
        await tx.recipeStep.createMany({
          data: stepRows(steps).map((s) => ({ ...s, recipeId: id })),
        });
      }
      if (categoryIds) {
        await tx.recipeCategory.deleteMany({ where: { recipeId: id } });
        await tx.recipeCategory.createMany({
          data: categoryIds.map((categoryId) => ({ recipeId: id, categoryId })),
        });
      }

      const updated = await tx.recipe.findUniqueOrThrow({ where: { id }, include: DETAIL_INCLUDE });
      if (updated.verificationStatus === 'PUBLISHED') {
        await this.manifest.record(tx, 'RECIPE', id, updated.version);
      }
      return updated;
    });
    return toRecipeDetail(row);
  }

  async changeStatus(
    id: string,
    to: VerificationStatus,
    user: AuthenticatedUser,
  ): Promise<RecipeDetailDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await this.findForUpdate(tx, id);
      const from = current.verificationStatus;
      const issues = getPublicationIssues({
        ...current,
        ingredients: current.ingredients.map((i) => ({ ...i, quantity: toNumber(i.quantity) })),
        stepCount: current.steps.length,
      });
      const result = validateStatusTransition(from, to, user.role, issues);
      if (!result.ok) {
        if (result.reason === 'FORBIDDEN')
          throw new ForbiddenException(`Your role cannot move a recipe from ${from} to ${to}`);
        if (result.reason === 'INCOMPLETE') throw incompleteError(issues);
        throw new ConflictException(`Invalid status transition from ${from} to ${to}`);
      }

      const { count } = await tx.recipe.updateMany({
        where: { id, verificationStatus: from },
        data: {
          verificationStatus: to,
          publishedAt: to === 'PUBLISHED' ? new Date() : from === 'PUBLISHED' ? null : undefined,
        },
      });
      if (count === 0) throw new ConflictException('Recipe status changed concurrently, retry');

      if (to === 'PUBLISHED') await this.manifest.record(tx, 'RECIPE', id, current.version);
      if (from === 'PUBLISHED') await this.manifest.withdraw(tx, 'RECIPE', id, current.version);
      return tx.recipe.findUniqueOrThrow({ where: { id }, include: DETAIL_INCLUDE });
    });
    return toRecipeDetail(row);
  }

  private async findForUpdate(tx: Tx, id: string): Promise<RecipeDetailRow> {
    const row = await tx.recipe.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!row) throw new NotFoundException('Recipe not found');
    return row;
  }

  private async validateReferences(tx: Tx, dto: UpdateRecipeDto): Promise<void> {
    const problems: string[] = [];

    if (dto.ingredients) {
      const ids = dto.ingredients.map((i) => i.ingredientId);
      if (new Set(ids).size !== ids.length)
        problems.push('ingredients must not repeat an ingredient');
      const found = await tx.ingredient.count({ where: { id: { in: ids } } });
      if (found !== new Set(ids).size)
        problems.push('ingredients reference unknown ingredientId values');
      dto.ingredients.forEach((line, index) => {
        if (line.unit === 'TOP_UP' && line.quantity != null) {
          problems.push(`ingredients.${index}.quantity must be empty for TOP_UP`);
        }
        if (line.unit !== 'TOP_UP' && line.quantity == null) {
          problems.push(`ingredients.${index}.quantity is required for unit ${line.unit}`);
        }
      });
    }
    if (dto.glasswareId && !(await tx.glassware.findUnique({ where: { id: dto.glasswareId } }))) {
      problems.push('glasswareId does not exist');
    }
    if (dto.techniqueId && !(await tx.technique.findUnique({ where: { id: dto.techniqueId } }))) {
      problems.push('techniqueId does not exist');
    }
    if (dto.categoryIds?.length) {
      const found = await tx.category.count({
        where: { id: { in: dto.categoryIds }, kind: 'RECIPE' },
      });
      if (found !== dto.categoryIds.length)
        problems.push('categoryIds must reference RECIPE categories');
    }
    if (problems.length > 0) throw new BadRequestException(problems);
  }

  private async assertSlugAvailable(tx: Tx, slug: string): Promise<string> {
    if (await tx.recipe.findUnique({ where: { slug }, select: { id: true } })) {
      throw new ConflictException('A recipe with this slug already exists');
    }
    return slug;
  }

  private async uniqueSlug(tx: Tx, name: string): Promise<string> {
    const base = slugify(name) || 'receta';
    const taken = new Set(
      (
        await tx.recipe.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })
      ).map((r) => r.slug),
    );
    if (!taken.has(base)) return base;
    for (let n = 2; ; n += 1) {
      if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
    }
  }
}
