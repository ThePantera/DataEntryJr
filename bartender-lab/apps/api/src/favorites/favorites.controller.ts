import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/authenticated-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FavoriteDto, FavoriteWithRecipeDto } from './dto/favorites.dto';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  @ApiOkResponse({ type: [FavoriteWithRecipeDto] })
  list(@CurrentUser() user: AuthenticatedUser): Promise<FavoriteWithRecipeDto[]> {
    return this.favorites.list(user.id);
  }

  @Post(':recipeId')
  @ApiCreatedResponse({
    type: FavoriteDto,
    description: 'Idempotente: repetir devuelve el mismo favorito.',
  })
  @ApiNotFoundResponse({ description: 'La receta no existe o no está publicada.' })
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param('recipeId', new ParseUUIDPipe()) recipeId: string,
  ): Promise<FavoriteDto> {
    return this.favorites.add(user.id, recipeId);
  }

  @Delete(':recipeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Idempotente.' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('recipeId', new ParseUUIDPipe()) recipeId: string,
  ): Promise<void> {
    return this.favorites.remove(user.id, recipeId);
  }
}
