import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { TechniqueDto } from './dto/techniques.dto';

const INCLUDE = {
  equipment: { include: { equipment: { select: { id: true, name: true } } } },
} as const;

@Injectable()
export class TechniquesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<TechniqueDto[]> {
    const techniques = await this.prisma.technique.findMany({
      include: INCLUDE,
      orderBy: { name: 'asc' },
    });
    return techniques.map((t) => this.toDto(t));
  }

  async get(id: string): Promise<TechniqueDto> {
    const technique = await this.prisma.technique.findUnique({ where: { id }, include: INCLUDE });
    if (!technique) throw new NotFoundException('Technique not found');
    return this.toDto(technique);
  }

  private toDto(t: {
    id: string;
    name: string;
    description: string;
    durationSeconds: number | null;
    instructions: string;
    commonMistakes: string[];
    version: number;
    updatedAt: Date;
    equipment: Array<{ equipment: { id: string; name: string } }>;
  }): TechniqueDto {
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      durationSeconds: t.durationSeconds,
      instructions: t.instructions,
      commonMistakes: t.commonMistakes,
      equipment: t.equipment
        .map((e) => e.equipment)
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      version: t.version,
      updatedAt: t.updatedAt,
    };
  }
}
