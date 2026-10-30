import type { Prisma } from '@prisma/client';
import { formatDateOnly } from '../common/utils/dates';
import { toNumber } from '../common/utils/decimal';
import type { InventoryItemDto } from './dto/inventory.dto';

export const INVENTORY_INCLUDE = { ingredient: { select: { name: true } } } as const;
export type InventoryRow = Prisma.InventoryItemGetPayload<{ include: typeof INVENTORY_INCLUDE }>;

export function toInventoryItemDto(row: InventoryRow): InventoryItemDto {
  return {
    id: row.id,
    ingredientId: row.ingredientId,
    ingredientName: row.ingredient.name,
    quantity: toNumber(row.quantity),
    unit: row.unit,
    expirationDate: formatDateOnly(row.expirationDate),
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}
