import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { GlasswareDto } from './dto/glassware.dto';

const SELECT = {
  id: true,
  name: true,
  description: true,
  capacityMl: true,
  imageUrl: true,
  version: true,
  updatedAt: true,
} as const;

@ApiTags('glassware')
@Public()
@Controller('glassware')
export class GlasswareController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({ type: [GlasswareDto] })
  list(): Promise<GlasswareDto[]> {
    return this.prisma.glassware.findMany({ select: SELECT, orderBy: { name: 'asc' } });
  }

  @Get(':id')
  @ApiOkResponse({ type: GlasswareDto })
  @ApiNotFoundResponse()
  async get(@Param('id', new ParseUUIDPipe()) id: string): Promise<GlasswareDto> {
    const glass = await this.prisma.glassware.findUnique({ where: { id }, select: SELECT });
    if (!glass) throw new NotFoundException('Glassware not found');
    return glass;
  }
}
