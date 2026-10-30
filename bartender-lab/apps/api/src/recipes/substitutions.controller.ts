import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { toNumber } from '../common/utils/decimal';
import { PrismaService } from '../prisma/prisma.service';

export class SubstitutionDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) ingredientId: string;
  @ApiProperty({ format: 'uuid' }) substituteId: string;
  @ApiProperty({ format: 'uuid', nullable: true, type: String, description: 'null = global.' })
  recipeId: string | null;
  @ApiProperty() ratio: number;
  @ApiProperty({ nullable: true, type: String }) notes: string | null;
}

/** Approved substitutions, so offline clients can run the same matching engine locally. */
@ApiTags('recipes')
@Public()
@Controller('substitutions')
export class SubstitutionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({ type: [SubstitutionDto] })
  async list(): Promise<SubstitutionDto[]> {
    const rows = await this.prisma.ingredientSubstitution.findMany({
      where: { approved: true },
      orderBy: { id: 'asc' },
    });
    return rows.map((s) => ({
      id: s.id,
      ingredientId: s.ingredientId,
      substituteId: s.substituteId,
      recipeId: s.recipeId,
      ratio: toNumber(s.ratio) ?? 1,
      notes: s.notes,
    }));
  }
}
