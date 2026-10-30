import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { InventoryFieldsDto } from '../../inventory/dto/inventory.dto';
import {
  ShoppingListItemFieldsDto,
  ShoppingListNameDto,
} from '../../shopping-lists/dto/shopping-lists.dto';

export class FavoritePayloadDto {
  @IsUUID()
  recipeId: string;
}

export class InventoryPayloadDto extends InventoryFieldsDto {
  @IsUUID()
  ingredientId: string;
}

export class ShoppingListPayloadDto extends ShoppingListNameDto {}

export class ShoppingListItemPayloadDto extends ShoppingListItemFieldsDto {
  @IsUUID()
  shoppingListId: string;

  @IsUUID()
  ingredientId: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
