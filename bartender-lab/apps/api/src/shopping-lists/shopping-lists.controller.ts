import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/authenticated-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CreateShoppingListDto,
  CreateShoppingListItemDto,
  ShoppingListDetailDto,
  ShoppingListDto,
  ShoppingListItemDto,
  ShoppingListOverviewDto,
  UpdateShoppingListDto,
  UpdateShoppingListItemDto,
} from './dto/shopping-lists.dto';
import { ShoppingListsService } from './shopping-lists.service';

const uuid = new ParseUUIDPipe();

@ApiTags('shopping-lists')
@ApiBearerAuth()
@ApiNotFoundResponse({ description: 'La lista o el ítem no existen o no son del usuario.' })
@Controller('shopping-lists')
export class ShoppingListsController {
  constructor(private readonly lists: ShoppingListsService) {}

  @Get()
  @ApiOkResponse({ type: [ShoppingListOverviewDto] })
  list(@CurrentUser() user: AuthenticatedUser): Promise<ShoppingListOverviewDto[]> {
    return this.lists.list(user.id);
  }

  @Post()
  @ApiCreatedResponse({ type: ShoppingListDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateShoppingListDto,
  ): Promise<ShoppingListDto> {
    return this.lists.create(user.id, dto);
  }

  @Get(':id')
  @ApiOkResponse({ type: ShoppingListDetailDto })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<ShoppingListDetailDto> {
    return this.lists.get(user.id, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ShoppingListDto })
  @ApiConflictResponse({ description: 'Versión desactualizada.' })
  rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() dto: UpdateShoppingListDto,
  ): Promise<ShoppingListDto> {
    return this.lists.rename(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', uuid) id: string): Promise<void> {
    return this.lists.remove(user.id, id);
  }

  @Post(':id/items')
  @ApiCreatedResponse({ type: ShoppingListItemDto })
  @ApiConflictResponse({ description: 'El ingrediente ya está en la lista.' })
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() dto: CreateShoppingListItemDto,
  ): Promise<ShoppingListItemDto> {
    return this.lists.addItem(user.id, id, dto);
  }

  @Patch(':id/items/:itemId')
  @ApiOkResponse({ type: ShoppingListItemDto })
  @ApiConflictResponse({ description: 'Versión desactualizada.' })
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Param('itemId', uuid) itemId: string,
    @Body() dto: UpdateShoppingListItemDto,
  ): Promise<ShoppingListItemDto> {
    return this.lists.updateItem(user.id, id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Param('itemId', uuid) itemId: string,
  ): Promise<void> {
    return this.lists.removeItem(user.id, id, itemId);
  }
}
