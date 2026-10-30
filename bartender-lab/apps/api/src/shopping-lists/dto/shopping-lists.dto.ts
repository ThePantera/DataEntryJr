import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unit } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SyncedRecordDto } from '../../common/dto/user-data.dto';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class ShoppingListNameDto {
  @ApiProperty({ minLength: 1, maxLength: 100, example: 'Para el sábado' })
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}

export class CreateShoppingListDto extends ShoppingListNameDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'UUID generado por el cliente (opcional).' })
  @IsOptional()
  @IsUUID()
  id?: string;
}

export class UpdateShoppingListDto extends ShoppingListNameDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class ShoppingListItemFieldsDto {
  @ApiPropertyOptional({ nullable: true, type: Number })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1_000_000)
  quantity?: number | null;

  @ApiPropertyOptional({ enum: Unit, nullable: true })
  @IsOptional()
  @IsEnum(Unit)
  unit?: Unit | null;
}

export class CreateShoppingListItemDto extends ShoppingListItemFieldsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ingredientId: string;
}

export class UpdateShoppingListItemDto extends ShoppingListItemFieldsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class ShoppingListDto extends SyncedRecordDto {
  @ApiProperty() name: string;
}

export class ShoppingListOverviewDto extends ShoppingListDto {
  @ApiProperty() itemCount: number;
  @ApiProperty() completedCount: number;
}

export class ShoppingListItemDto extends SyncedRecordDto {
  @ApiProperty({ format: 'uuid' }) shoppingListId: string;
  @ApiProperty({ format: 'uuid' }) ingredientId: string;
  @ApiProperty() ingredientName: string;
  @ApiProperty({ nullable: true, type: Number }) quantity: number | null;
  @ApiProperty({ enum: Unit, nullable: true }) unit: Unit | null;
  @ApiProperty() completed: boolean;
}

export class ShoppingListDetailDto extends ShoppingListDto {
  @ApiProperty({ type: [ShoppingListItemDto] }) items: ShoppingListItemDto[];
}
