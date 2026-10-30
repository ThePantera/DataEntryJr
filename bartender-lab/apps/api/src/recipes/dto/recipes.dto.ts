import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  Allergen,
  Difficulty,
  IceType,
  RecipeOrigin,
  Unit,
  VerificationStatus,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

// ─── Queries ────────────────────────────────────────────────────────────────

export class ListRecipesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca en el nombre de la receta y de sus ingredientes.' })
  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: Difficulty })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Recetas que usan este ingrediente.' })
  @IsOptional()
  @IsUUID()
  ingredientId?: string;

  @ApiPropertyOptional({ enum: RecipeOrigin })
  @IsOptional()
  @IsEnum(RecipeOrigin)
  origin?: RecipeOrigin;

  @ApiPropertyOptional({
    enum: VerificationStatus,
    description: 'Solo editores/administradores pueden pedir estados distintos de PUBLISHED.',
  })
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;
}

export class ServingsQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, description: 'Escala las cantidades.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  servings?: number;
}

export class MatchRecipesDto {
  @ApiPropertyOptional({ type: [String], format: 'uuid', description: 'Ingredientes disponibles.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  ingredientIds?: string[];

  @ApiPropertyOptional({
    description: 'Suma el inventario guardado del usuario (requiere autenticación).',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  useInventory?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  includeIncomplete?: boolean;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 20,
    description: 'Máximo de faltantes en INCOMPLETE.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  maxMissing?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

// ─── Editor input ───────────────────────────────────────────────────────────

export class RecipeIngredientInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ingredientId: string;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description: 'Obligatoria salvo para la unidad TOP_UP (completar), que no lleva cantidad.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(10000)
  quantity?: number | null;

  @ApiProperty({ enum: Unit })
  @IsEnum(Unit)
  unit: Unit;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  optional?: boolean;
}

export class RecipeStepInputDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  instruction: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 3600 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3600)
  durationSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string;
}

export class CreateRecipeDto {
  @ApiProperty({ minLength: 1, maxLength: 120, example: 'Daiquiri' })
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({
    description: 'Se genera a partir del nombre si se omite.',
    example: 'daiquiri',
  })
  @IsOptional()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  @MaxLength(100)
  slug?: string;

  @ApiProperty({ maxLength: 2000 })
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  history?: string | null;

  @ApiProperty({ enum: Difficulty })
  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @ApiPropertyOptional({ minimum: 1, maximum: 7200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7200)
  preparationTimeSeconds?: number | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  servings?: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  @IsOptional()
  @IsUUID()
  glasswareId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String, description: 'Método.' })
  @IsOptional()
  @IsUUID()
  techniqueId?: string | null;

  @ApiPropertyOptional({ enum: IceType, nullable: true })
  @IsOptional()
  @IsEnum(IceType)
  iceType?: IceType | null;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  garnish?: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  alcoholPercentageEstimated?: number | null;

  @ApiPropertyOptional({ maxLength: 5000, description: 'Resumen del método.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  instructions?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string | null;

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Fuente documental (obligatoria para clásicos).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  source?: string | null;

  @ApiPropertyOptional({ enum: RecipeOrigin, default: RecipeOrigin.CLASSIC })
  @IsOptional()
  @IsEnum(RecipeOrigin)
  origin?: RecipeOrigin;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Categorías de tipo RECIPE.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  categoryIds?: string[];

  @ApiProperty({ type: [RecipeIngredientInputDto] })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientInputDto)
  ingredients: RecipeIngredientInputDto[];

  @ApiProperty({ type: [RecipeStepInputDto], description: 'En orden; se numeran desde 1.' })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RecipeStepInputDto)
  steps: RecipeStepInputDto[];
}

export class UpdateRecipeDto extends PartialType(CreateRecipeDto) {
  @ApiPropertyOptional({
    description: 'Versión que se está editando; si no coincide responde 409.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class ChangeRecipeStatusDto {
  @ApiProperty({ enum: VerificationStatus })
  @IsEnum(VerificationStatus)
  status: VerificationStatus;
}

// ─── Responses ──────────────────────────────────────────────────────────────

export class NamedRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
}

export class GlasswareRefDto extends NamedRefDto {
  @ApiProperty({ nullable: true, type: Number }) capacityMl: number | null;
}

export class RecipeIngredientDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) ingredientId: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true, type: Number }) quantity: number | null;
  @ApiProperty({ enum: Unit }) unit: Unit;
  @ApiProperty() optional: boolean;
  @ApiProperty() position: number;
}

export class RecipeStepDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() stepNumber: number;
  @ApiProperty() instruction: string;
  @ApiProperty({ nullable: true, type: Number }) durationSeconds: number | null;
  @ApiProperty({ nullable: true, type: String }) imageUrl: string | null;
}

export class RecipeSummaryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty() description: string;
  @ApiProperty({ enum: Difficulty }) difficulty: Difficulty;
  @ApiProperty({ nullable: true, type: Number }) preparationTimeSeconds: number | null;
  @ApiProperty({ type: GlasswareRefDto, nullable: true }) glassware: GlasswareRefDto | null;
  @ApiProperty({ type: NamedRefDto, nullable: true }) technique: NamedRefDto | null;
  @ApiProperty({ enum: IceType, nullable: true }) iceType: IceType | null;
  @ApiProperty({ nullable: true, type: String }) imageUrl: string | null;
  @ApiProperty({ enum: RecipeOrigin }) origin: RecipeOrigin;
  @ApiProperty({ description: 'Clásico verificado y publicado.' }) isOfficialClassic: boolean;
  @ApiProperty({ enum: VerificationStatus }) verificationStatus: VerificationStatus;
  @ApiProperty() version: number;
  @ApiProperty() updatedAt: Date;
}

export class RecipeDetailDto extends RecipeSummaryDto {
  @ApiProperty({ nullable: true, type: String }) history: string | null;
  @ApiProperty({ description: 'Porciones de las cantidades devueltas.' }) servings: number;
  @ApiProperty({ description: 'Porciones de la receta original.' }) baseServings: number;
  @ApiProperty({ nullable: true, type: String }) garnish: string | null;
  @ApiProperty({ nullable: true, type: Number }) alcoholPercentageEstimated: number | null;
  @ApiProperty({ nullable: true, type: String }) instructions: string | null;
  @ApiProperty({ nullable: true, type: String }) source: string | null;
  @ApiProperty({ type: [NamedRefDto] }) categories: NamedRefDto[];
  @ApiProperty({
    enum: Allergen,
    isArray: true,
    description: 'Unión de alérgenos de sus ingredientes.',
  })
  allergens: Allergen[];
  @ApiProperty({ type: [RecipeIngredientDto] }) ingredients: RecipeIngredientDto[];
  @ApiProperty({ type: [RecipeStepDto] }) steps: RecipeStepDto[];
  @ApiProperty({ nullable: true, type: Date }) publishedAt: Date | null;
  @ApiProperty() createdAt: Date;
}

export class RecipePageDto {
  @ApiProperty({ type: [RecipeSummaryDto] }) items: RecipeSummaryDto[];
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() total: number;
}

export class RecipeCategoryDto extends NamedRefDto {
  @ApiProperty({ nullable: true, type: String }) description: string | null;
  @ApiProperty() publishedRecipeCount: number;
}

export class MatchIngredientRefDto extends NamedRefDto {}

export class MatchSubstitutionDto {
  @ApiProperty({ format: 'uuid' }) ingredientId: string;
  @ApiProperty() ingredientName: string;
  @ApiProperty({ format: 'uuid' }) substituteId: string;
  @ApiProperty() substituteName: string;
  @ApiProperty({ description: 'Cantidad del sustituto = cantidad original × ratio.' })
  ratio: number;
  @ApiProperty({ nullable: true, type: String }) notes: string | null;
}

export class RecipeMatchDto {
  @ApiProperty({ format: 'uuid' }) recipeId: string;
  @ApiProperty() recipeName: string;
  @ApiProperty() recipeSlug: string;
  @ApiProperty({ enum: RecipeOrigin }) origin: RecipeOrigin;
  @ApiProperty() isOfficialClassic: boolean;
  @ApiProperty({ enum: ['EXACT_MATCH', 'ADAPTABLE', 'INCOMPLETE'] }) classification:
    'EXACT_MATCH' | 'ADAPTABLE' | 'INCOMPLETE';
  @ApiProperty() requiredCount: number;
  @ApiProperty() availableRequiredCount: number;
  @ApiProperty({ type: [MatchIngredientRefDto] }) missingRequired: MatchIngredientRefDto[];
  @ApiProperty({ type: [MatchIngredientRefDto] }) missingOptional: MatchIngredientRefDto[];
  @ApiProperty({ type: [MatchSubstitutionDto] }) substitutions: MatchSubstitutionDto[];
}

export class MatchResponseDto {
  @ApiProperty({ type: [RecipeMatchDto] }) results: RecipeMatchDto[];
  @ApiProperty({ description: 'Recetas publicadas evaluadas.' }) evaluatedRecipes: number;
  @ApiProperty({ description: 'Motor determinista; la IA no altera sus reglas.' }) engine: string;
}
