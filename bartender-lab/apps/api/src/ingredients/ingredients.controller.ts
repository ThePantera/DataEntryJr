import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateIngredientDto,
  IngredientDto,
  IngredientPageDto,
  ListIngredientsQueryDto,
  UpdateIngredientDto,
} from './dto/ingredients.dto';
import { IngredientsService } from './ingredients.service';

@ApiTags('ingredients')
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredients: IngredientsService) {}

  @Get()
  @Public()
  @ApiOkResponse({ type: IngredientPageDto })
  list(@Query() query: ListIngredientsQueryDto): Promise<IngredientPageDto> {
    return this.ingredients.list(query);
  }

  @Get(':id')
  @Public()
  @ApiOkResponse({ type: IngredientDto })
  @ApiNotFoundResponse()
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<IngredientDto> {
    return this.ingredients.get(id);
  }

  @Post()
  @Roles('EDITOR', 'ADMIN')
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: IngredientDto })
  @ApiForbiddenResponse({ description: 'Solo editores y administradores.' })
  @ApiConflictResponse({ description: 'Ya existe un ingrediente con ese nombre.' })
  create(@Body() dto: CreateIngredientDto): Promise<IngredientDto> {
    return this.ingredients.create(dto);
  }

  @Patch(':id')
  @Roles('EDITOR', 'ADMIN')
  @ApiBearerAuth()
  @ApiOkResponse({ type: IngredientDto })
  @ApiForbiddenResponse({ description: 'Solo editores y administradores.' })
  @ApiConflictResponse({ description: 'Versión desactualizada o nombre duplicado.' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateIngredientDto,
  ): Promise<IngredientDto> {
    return this.ingredients.update(id, dto);
  }
}
