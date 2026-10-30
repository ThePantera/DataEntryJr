import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryKind } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListCategoriesQueryDto {
  @ApiPropertyOptional({ enum: CategoryKind })
  @IsOptional()
  @IsEnum(CategoryKind)
  kind?: CategoryKind;
}

export class CategoryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true, type: String }) description: string | null;
  @ApiProperty({ enum: CategoryKind }) kind: CategoryKind;
  @ApiProperty() version: number;
}
