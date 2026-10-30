import type { Prisma, ShoppingList } from '@prisma/client';
import { toNumber } from '../common/utils/decimal';
import type { ShoppingListDto, ShoppingListItemDto } from './dto/shopping-lists.dto';

export const ITEM_INCLUDE = { ingredient: { select: { name: true } } } as const;
export type ShoppingListItemRow = Prisma.ShoppingListItemGetPayload<{
  include: typeof ITEM_INCLUDE;
}>;

export function toShoppingListDto(row: ShoppingList): ShoppingListDto {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function toShoppingListItemDto(row: ShoppingListItemRow): ShoppingListItemDto {
  return {
    id: row.id,
    shoppingListId: row.shoppingListId,
    ingredientId: row.ingredientId,
    ingredientName: row.ingredient.name,
    quantity: toNumber(row.quantity),
    unit: row.unit,
    completed: row.completed,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}
