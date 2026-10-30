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
  CreateInventoryItemDto,
  InventoryItemDto,
  UpdateInventoryItemDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @ApiOkResponse({ type: [InventoryItemDto] })
  list(@CurrentUser() user: AuthenticatedUser): Promise<InventoryItemDto[]> {
    return this.inventory.list(user.id);
  }

  @Post()
  @ApiCreatedResponse({ type: InventoryItemDto })
  @ApiConflictResponse({ description: 'El ingrediente ya está en el inventario.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    return this.inventory.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: InventoryItemDto })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Versión desactualizada.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    return this.inventory.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.inventory.remove(user.id, id);
  }
}
