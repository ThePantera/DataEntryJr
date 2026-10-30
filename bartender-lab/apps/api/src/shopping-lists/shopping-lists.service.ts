import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateShoppingListDto,
  CreateShoppingListItemDto,
  ShoppingListDetailDto,
  ShoppingListDto,
  ShoppingListItemDto,
  ShoppingListOverviewDto,
  UpdateShoppingListDto,
  UpdateShoppingListItemDto,
} from './dto/shopping-lists.dto';
import { ITEM_INCLUDE, toShoppingListDto, toShoppingListItemDto } from './shopping-list.mapper';

type Tx = Prisma.TransactionClient;

@Injectable()
export class ShoppingListsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ShoppingListOverviewDto[]> {
    const lists = await this.prisma.shoppingList.findMany({
      where: { userId, deletedAt: null },
      include: { items: { where: { deletedAt: null }, select: { completed: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    return lists.map(({ items, ...list }) => ({
      ...toShoppingListDto(list),
      itemCount: items.length,
      completedCount: items.filter((i) => i.completed).length,
    }));
  }

  async get(userId: string, id: string): Promise<ShoppingListDetailDto> {
    const list = await this.findLiveList(this.prisma, userId, id);
    const items = await this.prisma.shoppingListItem.findMany({
      where: { shoppingListId: id, deletedAt: null },
      include: ITEM_INCLUDE,
      orderBy: [{ completed: 'asc' }, { ingredient: { name: 'asc' } }],
    });
    return { ...toShoppingListDto(list), items: items.map(toShoppingListItemDto) };
  }

  async create(userId: string, dto: CreateShoppingListDto): Promise<ShoppingListDto> {
    if (
      dto.id &&
      (await this.prisma.shoppingList.findUnique({ where: { id: dto.id }, select: { id: true } }))
    ) {
      throw new ConflictException('id is already in use');
    }
    return toShoppingListDto(
      await this.prisma.shoppingList.create({ data: { id: dto.id, userId, name: dto.name } }),
    );
  }

  async rename(userId: string, id: string, dto: UpdateShoppingListDto): Promise<ShoppingListDto> {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.findLiveList(tx, userId, id);
      const { count } = await tx.shoppingList.updateMany({
        where: { id, version: dto.version ?? current.version },
        data: { name: dto.name, version: { increment: 1 } },
      });
      if (count === 0)
        throw new ConflictException('Shopping list was modified elsewhere (version mismatch)');
      return toShoppingListDto(await tx.shoppingList.findUniqueOrThrow({ where: { id } }));
    });
  }

  /** Soft-deletes the list and its items (each item gets its own tombstone for sync). */
  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.findLiveList(tx, userId, id);
      await softDeleteList(tx, id);
    });
  }

  async addItem(
    userId: string,
    listId: string,
    dto: CreateShoppingListItemDto,
  ): Promise<ShoppingListItemDto> {
    return this.prisma.$transaction(async (tx) => {
      await this.findLiveList(tx, userId, listId);
      if (
        !(await tx.ingredient.findUnique({ where: { id: dto.ingredientId }, select: { id: true } }))
      ) {
        throw new BadRequestException('ingredientId does not exist');
      }
      const existing = await tx.shoppingListItem.findUnique({
        where: {
          shoppingListId_ingredientId: { shoppingListId: listId, ingredientId: dto.ingredientId },
        },
      });
      if (existing && !existing.deletedAt)
        throw new ConflictException('This ingredient is already in the list');
      const fields = { quantity: dto.quantity, unit: dto.unit };
      if (existing) {
        return toShoppingListItemDto(
          await tx.shoppingListItem.update({
            where: { id: existing.id },
            data: { ...fields, completed: false, deletedAt: null, version: { increment: 1 } },
            include: ITEM_INCLUDE,
          }),
        );
      }
      if (
        dto.id &&
        (await tx.shoppingListItem.findUnique({ where: { id: dto.id }, select: { id: true } }))
      ) {
        throw new ConflictException('id is already in use');
      }
      return toShoppingListItemDto(
        await tx.shoppingListItem.create({
          data: { id: dto.id, shoppingListId: listId, ingredientId: dto.ingredientId, ...fields },
          include: ITEM_INCLUDE,
        }),
      );
    });
  }

  async updateItem(
    userId: string,
    listId: string,
    itemId: string,
    dto: UpdateShoppingListItemDto,
  ): Promise<ShoppingListItemDto> {
    const { version, ...fields } = dto;
    return this.prisma.$transaction(async (tx) => {
      const current = await this.findLiveItem(tx, userId, listId, itemId);
      const { count } = await tx.shoppingListItem.updateMany({
        where: { id: itemId, version: version ?? current.version },
        data: { ...fields, version: { increment: 1 } },
      });
      if (count === 0)
        throw new ConflictException('Item was modified elsewhere (version mismatch)');
      return toShoppingListItemDto(
        await tx.shoppingListItem.findUniqueOrThrow({
          where: { id: itemId },
          include: ITEM_INCLUDE,
        }),
      );
    });
  }

  async removeItem(userId: string, listId: string, itemId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.findLiveItem(tx, userId, listId, itemId);
      await tx.shoppingListItem.update({
        where: { id: itemId },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
    });
  }

  private async findLiveList(db: Tx | PrismaService, userId: string, id: string) {
    const list = await db.shoppingList.findFirst({ where: { id, userId, deletedAt: null } });
    if (!list) throw new NotFoundException('Shopping list not found');
    return list;
  }

  private async findLiveItem(tx: Tx, userId: string, listId: string, itemId: string) {
    await this.findLiveList(tx, userId, listId);
    const item = await tx.shoppingListItem.findFirst({
      where: { id: itemId, shoppingListId: listId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Shopping list item not found');
    return item;
  }
}

export async function softDeleteList(tx: Tx, listId: string): Promise<void> {
  const now = new Date();
  await tx.shoppingListItem.updateMany({
    where: { shoppingListId: listId, deletedAt: null },
    data: { deletedAt: now, version: { increment: 1 } },
  });
  await tx.shoppingList.update({
    where: { id: listId },
    data: { deletedAt: now, version: { increment: 1 } },
  });
}
