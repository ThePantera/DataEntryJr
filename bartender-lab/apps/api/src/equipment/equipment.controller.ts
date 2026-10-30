import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { EquipmentDto } from './dto/equipment.dto';

const SELECT = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  version: true,
  updatedAt: true,
} as const;

@ApiTags('equipment')
@Public()
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({ type: [EquipmentDto] })
  list(): Promise<EquipmentDto[]> {
    return this.prisma.equipment.findMany({ select: SELECT, orderBy: { name: 'asc' } });
  }

  @Get(':id')
  @ApiOkResponse({ type: EquipmentDto })
  @ApiNotFoundResponse()
  async get(@Param('id', new ParseUUIDPipe()) id: string): Promise<EquipmentDto> {
    const item = await this.prisma.equipment.findUnique({ where: { id }, select: SELECT });
    if (!item) throw new NotFoundException('Equipment not found');
    return item;
  }
}
