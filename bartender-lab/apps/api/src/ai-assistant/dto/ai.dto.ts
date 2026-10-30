import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class RecommendDto {
  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  ingredientIds?: string[];

  @ApiPropertyOptional({ description: 'Usa el inventario guardado (requiere autenticación).' })
  @IsOptional()
  @IsBoolean()
  useInventory?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 10, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;
}

export class SubstituteDto {
  @ApiProperty({ format: 'uuid', description: 'Ingrediente a reemplazar.' })
  @IsUUID()
  ingredientId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Incluye sustituciones específicas de esta receta.',
  })
  @IsOptional()
  @IsUUID()
  recipeId?: string;
}

export class ExplainDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Explicar una técnica (excluyente con recipeId).',
  })
  @IsOptional()
  @IsUUID()
  techniqueId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Explicar una receta o uno de sus pasos.' })
  @IsOptional()
  @IsUUID()
  recipeId?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  stepNumber?: number;
}

class AssistantResponseDto {
  @ApiProperty({ example: 'RULES', description: 'Motor que generó la respuesta.' }) engine: 'RULES';
  @ApiProperty({ description: 'false: no interviene un modelo de lenguaje (Fase 10).' }) llm: false;
}

class RefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
}

export class RecommendationDto {
  @ApiProperty({ format: 'uuid' }) recipeId: string;
  @ApiProperty() recipeName: string;
  @ApiProperty({ enum: ['EXACT_MATCH', 'ADAPTABLE', 'INCOMPLETE'] }) classification: string;
  @ApiProperty({ type: [String] }) reasons: string[];
}

export class RecommendResponseDto extends AssistantResponseDto {
  @ApiProperty({ type: [RecommendationDto] }) recommendations: RecommendationDto[];
}

export class SubstitutionOptionDto {
  @ApiProperty({ type: RefDto }) substitute: RefDto;
  @ApiProperty() ratio: number;
  @ApiProperty({ nullable: true, type: String }) notes: string | null;
  @ApiProperty({ enum: ['GLOBAL', 'RECIPE'] }) scope: 'GLOBAL' | 'RECIPE';
}

export class SubstituteResponseDto extends AssistantResponseDto {
  @ApiProperty({ type: RefDto }) ingredient: RefDto;
  @ApiProperty({ type: [SubstitutionOptionDto] }) substitutions: SubstitutionOptionDto[];
}

class ExplainStepDto {
  @ApiProperty() stepNumber: number;
  @ApiProperty() instruction: string;
  @ApiProperty({ nullable: true, type: Number }) durationSeconds: number | null;
}

class ExplainTechniqueDto extends RefDto {
  @ApiProperty() description: string;
  @ApiProperty() instructions: string;
  @ApiProperty({ type: [String] }) commonMistakes: string[];
}

export class ExplainResponseDto extends AssistantResponseDto {
  @ApiProperty({ enum: ['TECHNIQUE', 'RECIPE', 'RECIPE_STEP'] }) topic:
    'TECHNIQUE' | 'RECIPE' | 'RECIPE_STEP';
  @ApiProperty() title: string;
  @ApiProperty() summary: string;
  @ApiPropertyOptional({ type: [String] }) commonMistakes?: string[];
  @ApiPropertyOptional({ type: [String] }) equipment?: string[];
  @ApiPropertyOptional({ type: ExplainStepDto }) step?: ExplainStepDto;
  @ApiPropertyOptional({ type: [ExplainStepDto] }) steps?: ExplainStepDto[];
  @ApiPropertyOptional({ type: ExplainTechniqueDto, nullable: true })
  technique?: ExplainTechniqueDto | null;
  @ApiProperty({ type: [String], description: 'Recursos verificados usados para la respuesta.' })
  sources: string[];
}
