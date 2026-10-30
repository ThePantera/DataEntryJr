import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { paginationArgs, type Paginated } from '../common/dto/pagination.dto';
import { toNumber } from '../common/utils/decimal';
import { rejectNulls } from '../common/utils/reject-nulls';
import { ManifestService } from '../manifest/manifest.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateIngredientDto,
  IngredientDto,
  ListIngredientsQueryDto,
  UpdateIngredientDto,
} from './dto/ingredients.dto';

const INCLUDE = { category: { select: { id: true, name: true } } } as const;
type IngredientRow = Prisma.IngredientGetPayload<{ include: typeof INCLUDE }>;

function toDto(row: IngredientRow): IngredientDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    alcoholPercentage: toNumber(row.alcoholPercentage) ?? 0,
    imageUrl: row.imageUrl,
    allergens: row.allergens,
    version: row.version,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class IngredientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly manifest: ManifestService,
  ) {}

  async list(query: ListIngredientsQueryDto): Promise<Paginated<IngredientDto>> {
    const where: Prisma.IngredientWhereInput = {
      categoryId: query.categoryId,
      name: query.search ? { contains: query.search, mode: 'insensitive' } : undefined,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.ingredient.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.ingredient.count({ where }),
    ]);
    return { items: rows.map(toDto), page: query.page, pageSize: query.pageSize, total };
  }

  async get(id: string): Promise<IngredientDto> {
    const row = await this.prisma.ingredient.findUnique({ where: { id }, include: INCLUDE });
    if (!row) throw new NotFoundException('Ingredient not found');
    return toDto(row);
  }

  async create(dto: CreateIngredientDto): Promise<IngredientDto> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertIngredientCategory(tx, dto.categoryId);
      await this.assertNameAvailable(tx, dto.name);
      const row = await tx.ingredient.create({ data: dto, include: INCLUDE });
      await this.manifest.record(tx, 'INGREDIENT', row.id, row.version);
      return toDto(row);
    });
  }

  async update(id: string, dto: UpdateIngredientDto): Promise<IngredientDto> {
    rejectNulls(dto, ['name', 'categoryId', 'alcoholPercentage', 'allergens', 'version']);
    const { version, ...changes } = dto;
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.ingredient.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Ingredient not found');
      if (changes.categoryId) await this.assertIngredientCategory(tx, changes.categoryId);
      if (changes.name && changes.name !== current.name)
        await this.assertNameAvailable(tx, changes.name);

      // Conditional update: fails if someone else changed the row since it was read.
      const expectedVersion = version ?? current.version;
      const { count } = await tx.ingredient.updateMany({
        where: { id, version: expectedVersion },
        data: { ...changes, version: { increment: 1 } },
      });
      if (count === 0)
        throw new ConflictException('Ingredient was modified by someone else (version mismatch)');

      const row = await tx.ingredient.findUniqueOrThrow({ where: { id }, include: INCLUDE });
      await this.manifest.record(tx, 'INGREDIENT', row.id, row.version);
      return toDto(row);
    });
  }

  private async assertIngredientCategory(tx: Prisma.TransactionClient, categoryId: string) {
    const category = await tx.category.findUnique({ where: { id: categoryId } });
    if (!category || category.kind !== 'INGREDIENT') {
      throw new BadRequestException('categoryId must reference an existing INGREDIENT category');
    }
  }

  private async assertNameAvailable(tx: Prisma.TransactionClient, name: string) {
    const existing = await tx.ingredient.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('An ingredient with this name already exists');
  }
}
