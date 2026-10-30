import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/authenticated-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ChangeRecipeStatusDto,
  CreateRecipeDto,
  ListRecipesQueryDto,
  MatchRecipesDto,
  MatchResponseDto,
  RecipeCategoryDto,
  RecipeDetailDto,
  RecipeIngredientDto,
  RecipePageDto,
  RecipeStepDto,
  ServingsQueryDto,
  UpdateRecipeDto,
} from './dto/recipes.dto';
import { RecipeAdminService } from './recipe-admin.service';
import { RecipesService } from './recipes.service';

const idPipe = new ParseUUIDPipe();

@ApiTags('recipes')
@Controller('recipes')
export class RecipesController {
  constructor(
    private readonly recipes: RecipesService,
    private readonly admin: RecipeAdminService,
  ) {}

  @Get()
  @Public()
  @ApiOkResponse({ type: RecipePageDto, description: 'Por defecto solo recetas publicadas.' })
  list(
    @Query() query: ListRecipesQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<RecipePageDto> {
    return this.recipes.list(query, user);
  }

  @Get('categories')
  @Public()
  @ApiOkResponse({ type: [RecipeCategoryDto] })
  categories(): Promise<RecipeCategoryDto[]> {
    return this.recipes.categories();
  }

  @Post('match')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MatchResponseDto })
  match(
    @Body() dto: MatchRecipesDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<MatchResponseDto> {
    return this.recipes.match(dto, user);
  }

  @Get(':id')
  @Public()
  @ApiOkResponse({ type: RecipeDetailDto })
  @ApiNotFoundResponse()
  get(
    @Param('id', idPipe) id: string,
    @Query() query: ServingsQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<RecipeDetailDto> {
    return this.recipes.get(id, user, query.servings);
  }

  @Get(':id/ingredients')
  @Public()
  @ApiOkResponse({ type: [RecipeIngredientDto] })
  @ApiNotFoundResponse()
  ingredients(
    @Param('id', idPipe) id: string,
    @Query() query: ServingsQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<RecipeIngredientDto[]> {
    return this.recipes.ingredients(id, user, query.servings);
  }

  @Get(':id/steps')
  @Public()
  @ApiOkResponse({ type: [RecipeStepDto] })
  @ApiNotFoundResponse()
  steps(
    @Param('id', idPipe) id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<RecipeStepDto[]> {
    return this.recipes.steps(id, user);
  }

  @Post()
  @Roles('EDITOR', 'ADMIN')
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: RecipeDetailDto, description: 'Se crea siempre en estado DRAFT.' })
  @ApiForbiddenResponse({ description: 'Solo editores y administradores.' })
  create(
    @Body() dto: CreateRecipeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RecipeDetailDto> {
    return this.admin.create(dto, user);
  }

  @Patch(':id')
  @Roles('EDITOR', 'ADMIN')
  @ApiBearerAuth()
  @ApiOkResponse({ type: RecipeDetailDto })
  @ApiForbiddenResponse({
    description: 'Las recetas verificadas/publicadas solo las edita un administrador.',
  })
  @ApiConflictResponse({ description: 'Versión desactualizada o slug duplicado.' })
  @ApiUnprocessableEntityResponse({
    description: 'La edición dejaría incompleta una receta oficial.',
  })
  update(
    @Param('id', idPipe) id: string,
    @Body() dto: UpdateRecipeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RecipeDetailDto> {
    return this.admin.update(id, dto, user);
  }

  @Post(':id/status')
  @Roles('EDITOR', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOkResponse({ type: RecipeDetailDto })
  @ApiForbiddenResponse({ description: 'Publicar y despublicar es exclusivo de administradores.' })
  @ApiConflictResponse({ description: 'Transición no permitida.' })
  @ApiUnprocessableEntityResponse({
    description: 'Faltan cantidades, método, vaso, hielo o instrucciones.',
  })
  changeStatus(
    @Param('id', idPipe) id: string,
    @Body() dto: ChangeRecipeStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RecipeDetailDto> {
    return this.admin.changeStatus(id, dto.status, user);
  }
}
