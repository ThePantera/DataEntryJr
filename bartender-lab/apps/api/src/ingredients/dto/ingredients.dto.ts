import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Allergen } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class ListIngredientsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Búsqueda por nombre (sin distinguir mayúsculas).' })
  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

export class CreateIngredientDto {
  @ApiProperty({ example: 'Gin', minLength: 1, maxLength: 100 })
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ format: 'uuid', description: 'Categoría de tipo INGREDIENT.' })
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  alcoholPercentage?: number;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/gin.webp' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string;

  @ApiPropertyOptional({ enum: Allergen, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Allergen, { each: true })
  allergens?: Allergen[];
}

export class UpdateIngredientDto extends PartialType(CreateIngredientDto) {
  @ApiPropertyOptional({
    description: 'Versión que se está editando. Si no coincide con la actual, responde 409.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;
}

export class IngredientCategoryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
}

export class IngredientDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true, type: String }) description: string | null;
  @ApiProperty({ type: IngredientCategoryDto }) category: IngredientCategoryDto;
  @ApiProperty() alcoholPercentage: number;
  @ApiProperty({ nullable: true, type: String }) imageUrl: string | null;
  @ApiProperty({ enum: Allergen, isArray: true }) allergens: Allergen[];
  @ApiProperty() version: number;
  @ApiProperty() updatedAt: Date;
}

export class IngredientPageDto {
  @ApiProperty({ type: [IngredientDto] }) items: IngredientDto[];
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() total: number;
}
