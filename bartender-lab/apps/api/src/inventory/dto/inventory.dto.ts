import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unit } from '@prisma/client';
import { IsEnum, IsInt, IsNumber, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { SyncedRecordDto } from '../../common/dto/user-data.dto';

const DATE_ONLY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export class InventoryFieldsDto {
  @ApiPropertyOptional({ nullable: true, type: Number, minimum: 0, description: '0 = agotado.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  quantity?: number | null;

  @ApiPropertyOptional({ enum: Unit, nullable: true })
  @IsOptional()
  @IsEnum(Unit)
  unit?: Unit | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: '2027-12-31' })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'expirationDate must be a date in YYYY-MM-DD format' })
  expirationDate?: string | null;
}

export class CreateInventoryItemDto extends InventoryFieldsDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'UUID generado por el cliente (opcional).' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ingredientId: string;
}

export class UpdateInventoryItemDto extends InventoryFieldsDto {
  @ApiPropertyOptional({ description: 'Versión editada; si no coincide responde 409.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class InventoryItemDto extends SyncedRecordDto {
  @ApiProperty({ format: 'uuid' }) ingredientId: string;
  @ApiProperty() ingredientName: string;
  @ApiProperty({ nullable: true, type: Number }) quantity: number | null;
  @ApiProperty({ enum: Unit, nullable: true }) unit: Unit | null;
  @ApiProperty({ nullable: true, type: String }) expirationDate: string | null;
}
