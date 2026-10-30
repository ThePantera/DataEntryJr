import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { parseDateOnly } from '../common/utils/dates';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateInventoryItemDto,
  InventoryFieldsDto,
  InventoryItemDto,
  UpdateInventoryItemDto,
} from './dto/inventory.dto';
import { INVENTORY_INCLUDE, toInventoryItemDto } from './inventory.mapper';

export function inventoryData(fields: InventoryFieldsDto) {
  return {
    quantity: fields.quantity,
    unit: fields.unit,
    expirationDate:
      fields.expirationDate === undefined
        ? undefined
        : fields.expirationDate === null
          ? null
          : parseDateOnly(fields.expirationDate),
  };
}

/** Every query is scoped by userId: another user's item is indistinguishable from a missing one. */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<InventoryItemDto[]> {
    const rows = await this.prisma.inventoryItem.findMany({
      where: { userId, deletedAt: null },
      include: INVENTORY_INCLUDE,
      orderBy: [{ ingredient: { name: 'asc' } }, { id: 'asc' }],
    });
    return rows.map(toInventoryItemDto);
  }

  async create(userId: string, dto: CreateInventoryItemDto): Promise<InventoryItemDto> {
    return this.prisma.$transaction(async (tx) => {
      if (
        !(await tx.ingredient.findUnique({ where: { id: dto.ingredientId }, select: { id: true } }))
      ) {
        throw new BadRequestException('ingredientId does not exist');
      }
      const existing = await tx.inventoryItem.findUnique({
        where: { userId_ingredientId: { userId, ingredientId: dto.ingredientId } },
      });
      if (existing && !existing.deletedAt) {
        throw new ConflictException('This ingredient is already in your inventory');
      }
      if (existing) {
        // Revive the tombstone so the (user, ingredient) pair keeps a single identity.
        const row = await tx.inventoryItem.update({
          where: { id: existing.id },
          data: { ...inventoryData(dto), deletedAt: null, version: { increment: 1 } },
          include: INVENTORY_INCLUDE,
        });
        return toInventoryItemDto(row);
      }
      if (
        dto.id &&
        (await tx.inventoryItem.findUnique({ where: { id: dto.id }, select: { id: true } }))
      ) {
        throw new ConflictException('id is already in use');
      }
      const row = await tx.inventoryItem.create({
        data: { id: dto.id, userId, ingredientId: dto.ingredientId, ...inventoryData(dto) },
        include: INVENTORY_INCLUDE,
      });
      return toInventoryItemDto(row);
    });
  }

  async update(userId: string, id: string, dto: UpdateInventoryItemDto): Promise<InventoryItemDto> {
    const { version, ...fields } = dto;
    return this.prisma.$transaction(async (tx) => {
      const current = await this.findLive(tx, userId, id);
      const { count } = await tx.inventoryItem.updateMany({
        where: { id, userId, deletedAt: null, version: version ?? current.version },
        data: { ...inventoryData(fields), version: { increment: 1 } },
      });
      if (count === 0)
        throw new ConflictException('Inventory item was modified elsewhere (version mismatch)');
      return toInventoryItemDto(
        await tx.inventoryItem.findUniqueOrThrow({ where: { id }, include: INVENTORY_INCLUDE }),
      );
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.findLive(tx, userId, id);
      await tx.inventoryItem.update({
        where: { id },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
    });
  }

  private async findLive(tx: Prisma.TransactionClient, userId: string, id: string) {
    const row = await tx.inventoryItem.findFirst({ where: { id, userId, deletedAt: null } });
    if (!row) throw new NotFoundException('Inventory item not found');
    return row;
  }
}
