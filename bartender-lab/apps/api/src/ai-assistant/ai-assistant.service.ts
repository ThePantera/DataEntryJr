import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/authenticated-user';
import { toNumber } from '../common/utils/decimal';
import { PrismaService } from '../prisma/prisma.service';
import type { RecipeMatchDto } from '../recipes/dto/recipes.dto';
import { RecipesService } from '../recipes/recipes.service';
import { TechniquesService } from '../techniques/techniques.service';
import type {
  ExplainDto,
  ExplainResponseDto,
  RecommendDto,
  RecommendResponseDto,
  SubstituteDto,
  SubstituteResponseDto,
} from './dto/ai.dto';

const RULES = { engine: 'RULES', llm: false } as const;

const names = (refs: Array<{ name: string }>) => refs.map((r) => r.name).join(', ');

function reasonsFor(match: RecipeMatchDto): string[] {
  const reasons: string[] = [];
  if (match.classification === 'EXACT_MATCH')
    reasons.push('Tienes todos los ingredientes obligatorios.');
  for (const s of match.substitutions) {
    reasons.push(
      `Sustituye ${s.ingredientName} por ${s.substituteName} (sustitución aprobada, proporción ${s.ratio}:1).`,
    );
  }
  if (match.missingRequired.length > 0) reasons.push(`Te falta: ${names(match.missingRequired)}.`);
  if (match.missingOptional.length > 0)
    reasons.push(`Opcional que no tienes: ${names(match.missingOptional)}.`);
  return reasons;
}

/**
 * Assistant endpoints backed by deterministic rules over verified content.
 * No language model is involved in this phase (see ADR-0007); when one is added it may only
 * rephrase or rank these results, never change the matching rules or invent recipes.
 */
@Injectable()
export class AiAssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recipes: RecipesService,
    private readonly techniques: TechniquesService,
  ) {}

  async recommend(dto: RecommendDto, user?: AuthenticatedUser): Promise<RecommendResponseDto> {
    const limit = dto.limit ?? 5;
    const request = { ingredientIds: dto.ingredientIds, useInventory: dto.useInventory, limit };
    let { results } = await this.recipes.match({ ...request, includeIncomplete: false }, user);
    if (results.length === 0) {
      ({ results } = await this.recipes.match(
        { ...request, includeIncomplete: true, maxMissing: 1 },
        user,
      ));
    }
    return {
      ...RULES,
      recommendations: results.map((r) => ({
        recipeId: r.recipeId,
        recipeName: r.recipeName,
        classification: r.classification,
        reasons: reasonsFor(r),
      })),
    };
  }

  async substitute(dto: SubstituteDto, user?: AuthenticatedUser): Promise<SubstituteResponseDto> {
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id: dto.ingredientId },
      select: { id: true, name: true },
    });
    if (!ingredient) throw new NotFoundException('Ingredient not found');
    if (dto.recipeId) await this.recipes.findVisible(dto.recipeId, user);

    const rows = await this.prisma.ingredientSubstitution.findMany({
      where: {
        ingredientId: dto.ingredientId,
        approved: true,
        OR: [{ recipeId: null }, ...(dto.recipeId ? [{ recipeId: dto.recipeId }] : [])],
      },
      include: { substitute: { select: { id: true, name: true } } },
      orderBy: [{ recipeId: { sort: 'asc', nulls: 'last' } }, { substitute: { name: 'asc' } }],
    });
    return {
      ...RULES,
      ingredient,
      substitutions: rows.map((row) => ({
        substitute: row.substitute,
        ratio: toNumber(row.ratio) ?? 1,
        notes: row.notes,
        scope: row.recipeId ? 'RECIPE' : 'GLOBAL',
      })),
    };
  }

  async explain(dto: ExplainDto, user?: AuthenticatedUser): Promise<ExplainResponseDto> {
    if (Boolean(dto.techniqueId) === Boolean(dto.recipeId)) {
      throw new BadRequestException('Provide exactly one of techniqueId or recipeId');
    }

    if (dto.techniqueId) {
      const technique = await this.techniques.get(dto.techniqueId);
      return {
        ...RULES,
        topic: 'TECHNIQUE',
        title: technique.name,
        summary: technique.description,
        steps: [
          {
            stepNumber: 1,
            instruction: technique.instructions,
            durationSeconds: technique.durationSeconds,
          },
        ],
        commonMistakes: technique.commonMistakes,
        equipment: technique.equipment.map((e) => e.name),
        sources: [`technique:${technique.id}`],
      };
    }

    const recipe = await this.recipes.get(dto.recipeId!, user);
    const technique = recipe.technique ? await this.techniques.get(recipe.technique.id) : null;
    const techniqueInfo = technique && {
      id: technique.id,
      name: technique.name,
      description: technique.description,
      instructions: technique.instructions,
      commonMistakes: technique.commonMistakes,
    };
    const sources = [`recipe:${recipe.id}`, ...(technique ? [`technique:${technique.id}`] : [])];
    const toStep = (s: (typeof recipe.steps)[number]) => ({
      stepNumber: s.stepNumber,
      instruction: s.instruction,
      durationSeconds: s.durationSeconds,
    });

    if (dto.stepNumber !== undefined) {
      const step = recipe.steps.find((s) => s.stepNumber === dto.stepNumber);
      if (!step) throw new NotFoundException('Step not found');
      return {
        ...RULES,
        topic: 'RECIPE_STEP',
        title: `${recipe.name} — paso ${step.stepNumber}`,
        summary: step.instruction,
        step: toStep(step),
        technique: techniqueInfo,
        sources,
      };
    }

    const serve = [
      recipe.glassware && `Vaso: ${recipe.glassware.name}`,
      recipe.iceType && `Hielo: ${recipe.iceType}`,
      recipe.garnish && `Decoración: ${recipe.garnish}`,
    ].filter(Boolean);
    return {
      ...RULES,
      topic: 'RECIPE',
      title: recipe.name,
      summary: [recipe.instructions ?? recipe.description, ...serve].join(' · '),
      steps: recipe.steps.map(toStep),
      technique: techniqueInfo,
      sources,
    };
  }
}
