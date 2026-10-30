import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceType, SyncAction, SyncEntityType, SyncStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { FavoriteDto } from '../../favorites/dto/favorites.dto';
import { InventoryItemDto } from '../../inventory/dto/inventory.dto';
import { ShoppingListDto, ShoppingListItemDto } from '../../shopping-lists/dto/shopping-lists.dto';

export const MAX_PUSH_OPERATIONS = 100;

export class ManifestQueryDto {
  @ApiPropertyOptional({ description: 'Tipos separados por coma.', example: 'RECIPE,TECHNIQUE' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @IsEnum(ResourceType, { each: true })
  types?: ResourceType[];
}

export class ChangesQueryDto {
  @ApiPropertyOptional({
    description:
      'Valor nextSince de la respuesta anterior (ISO 8601). Omitir en la primera sincronización.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  since?: string;
}

export class ManifestEntryDto {
  @ApiProperty({ enum: ResourceType }) resourceType: ResourceType;
  @ApiProperty({ format: 'uuid' }) resourceId: string;
  @ApiProperty({ description: 'Si es mayor que la copia local, la copia está desactualizada.' })
  version: number;
  @ApiProperty({ description: 'true = el recurso dejó de publicarse.' }) deleted: boolean;
  @ApiProperty() updatedAt: Date;
}

export class ManifestResponseDto {
  @ApiProperty({ type: [ManifestEntryDto] }) entries: ManifestEntryDto[];
  @ApiProperty() serverTime: Date;
}

export class UserChangesDto {
  @ApiProperty({ type: [FavoriteDto] }) favorites: FavoriteDto[];
  @ApiProperty({ type: [InventoryItemDto] }) inventory: InventoryItemDto[];
  @ApiProperty({ type: [ShoppingListDto] }) shoppingLists: ShoppingListDto[];
  @ApiProperty({ type: [ShoppingListItemDto] }) shoppingListItems: ShoppingListItemDto[];
}

export class ChangesResponseDto {
  @ApiProperty({ type: [ManifestEntryDto], description: 'Cambios del contenido público.' })
  content: ManifestEntryDto[];
  @ApiProperty({
    type: UserChangesDto,
    nullable: true,
    description: 'Datos propios (incluye lápidas con deletedAt). null sin autenticación.',
  })
  user: UserChangesDto | null;
  @ApiProperty({
    description:
      'Cursor para la próxima llamada. Incluye una ventana de seguridad, así que pueden repetirse ' +
      'cambios ya recibidos: el cliente los aplica de forma idempotente por id y versión.',
  })
  nextSince: string;
  @ApiProperty() serverTime: Date;
}

export class SyncOperationDto {
  @ApiProperty({ format: 'uuid', description: 'Id único de la operación en la cola del cliente.' })
  @IsUUID()
  opId: string;

  @ApiProperty({ enum: SyncEntityType })
  @IsEnum(SyncEntityType)
  entityType: SyncEntityType;

  @ApiProperty({ enum: SyncAction })
  @IsEnum(SyncAction)
  action: SyncAction;

  @ApiProperty({
    format: 'uuid',
    description: 'UUID del registro (generado por el cliente al crearlo).',
  })
  @IsUUID()
  entityId: string;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description: 'Versión del registro sobre la que el cliente hizo el cambio (null al crear).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  baseVersion?: number | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Estado completo del registro para UPSERT. FAVORITE {recipeId}; INVENTORY {ingredientId, quantity?, ' +
      'unit?, expirationDate?}; SHOPPING_LIST {name}; SHOPPING_LIST_ITEM {shoppingListId, ingredientId, ' +
      'quantity?, unit?, completed?}.',
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class SyncPushDto {
  @ApiProperty({ type: [SyncOperationDto], maxItems: MAX_PUSH_OPERATIONS })
  @IsArray()
  @ArrayMaxSize(MAX_PUSH_OPERATIONS)
  @ValidateNested({ each: true })
  @Type(() => SyncOperationDto)
  operations: SyncOperationDto[];
}

export const SYNC_REASONS = [
  'STALE_VERSION',
  'DELETED_ON_SERVER',
  'DUPLICATE',
  'NOT_FOUND',
  'INVALID_PAYLOAD',
  'UNKNOWN_INGREDIENT',
  'RECIPE_NOT_AVAILABLE',
  'PARENT_DELETED',
] as const;
export type SyncReason = (typeof SYNC_REASONS)[number];

export class SyncOperationResultDto {
  @ApiProperty({ format: 'uuid' }) opId: string;
  @ApiProperty({ enum: SyncEntityType }) entityType: SyncEntityType;
  @ApiProperty({ format: 'uuid' }) entityId: string;
  @ApiProperty({
    enum: SyncStatus,
    description:
      'APPLIED: aplicado. MERGED: ya existía el mismo registro con otro id (usar canonicalId). ' +
      'CONFLICT: no aplicado, gana el servidor (reemplazar la copia local por entity). ' +
      'REJECTED: inválido o sin permiso; descartar la operación.',
  })
  status: SyncStatus;
  @ApiPropertyOptional({ enum: SYNC_REASONS }) reason?: SyncReason;
  @ApiPropertyOptional({ type: [String] }) details?: string[];
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Id definitivo del registro si difiere de entityId.',
  })
  canonicalId?: string;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Copia del servidor.',
  })
  entity: object | null;
  @ApiProperty({
    description: 'true = la operación ya se había procesado; se devuelve el resultado guardado.',
  })
  replayed: boolean;
}

export class SyncPushResponseDto {
  @ApiProperty({ type: [SyncOperationResultDto] }) results: SyncOperationResultDto[];
  @ApiProperty() serverTime: Date;
}
