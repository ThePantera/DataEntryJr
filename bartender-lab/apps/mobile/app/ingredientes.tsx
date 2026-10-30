import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Card, Field, ListRow, Screen } from '../src/components/ui';
import { useClient } from '../src/client-context';
import { useIngredients, useInventory, useMutate, useShoppingList } from '../src/hooks';
import { colors } from '../src/theme';

/** Picks an ingredient for Mi barra (modo=barra) or for a shopping list (modo=lista&lista=<id>). */
export default function IngredientPicker() {
  const { modo, lista } = useLocalSearchParams<{ modo?: string; lista?: string }>();
  const client = useClient();
  const mutate = useMutate();
  const [search, setSearch] = useState('');
  const ingredients = useIngredients(search);
  const inventory = useInventory();
  const list = useShoppingList(lista ?? '');

  const already = new Set(
    modo === 'lista'
      ? (list.data?.items.map((i) => i.ingredientId) ?? [])
      : (inventory.data?.map((i) => i.ingredientId) ?? []),
  );

  const pick = async (ingredientId: string) => {
    if (modo === 'lista' && lista) await mutate(() => client.shopping.addItem(lista, ingredientId));
    else await mutate(() => client.inventory.save({ ingredientId }));
    router.back();
  };

  return (
    <Screen>
      <Field
        placeholder="Buscar ingrediente"
        value={search}
        onChangeText={setSearch}
        autoFocus
        autoCorrect={false}
      />
      <Card>
        {ingredients.data?.map((ingredient) => (
          <ListRow
            key={ingredient.id}
            title={ingredient.name}
            subtitle={[
              ingredient.categoryName,
              ingredient.alcoholPercentage ? `${ingredient.alcoholPercentage}% vol.` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            onPress={already.has(ingredient.id) ? undefined : () => pick(ingredient.id)}
            right={
              already.has(ingredient.id) ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.lime} />
              ) : (
                <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
              )
            }
          />
        ))}
      </Card>
    </Screen>
  );
}
