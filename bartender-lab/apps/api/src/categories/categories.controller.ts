import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryDto, ListCategoriesQueryDto } from './dto/categories.dto';

@ApiTags('categories')
@Public()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({ type: [CategoryDto] })
  list(@Query() query: ListCategoriesQueryDto): Promise<CategoryDto[]> {
    return this.prisma.category.findMany({
      where: { kind: query.kind },
      select: { id: true, name: true, description: true, kind: true, version: true },
      orderBy: { name: 'asc' },
    });
  }
}
