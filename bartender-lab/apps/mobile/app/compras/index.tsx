import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Button, Card, EmptyState, Field, ListRow, Screen } from '../../src/components/ui';
import { useClient } from '../../src/client-context';
import { useMutate, useShoppingLists } from '../../src/hooks';
import { colors, spacing } from '../../src/theme';

export default function ShoppingListsScreen() {
  const client = useClient();
  const mutate = useMutate();
  const lists = useShoppingLists();
  const [name, setName] = useState('');

  const create = async () => {
    if (!name.trim()) return;
    const id = await mutate(() => client.shopping.create(name));
    setName('');
    router.push(`/compras/${id}`);
  };

  return (
    <Screen>
      <View style={{ gap: spacing.sm }}>
        <Field
          placeholder="Nombre de la nueva lista"
          value={name}
          onChangeText={setName}
          onSubmitEditing={create}
        />
        <Button label="Crear lista" icon="add" onPress={create} disabled={!name.trim()} />
      </View>
      {lists.data?.length === 0 ? (
        <EmptyState
          icon="cart-outline"
          title="No tienes listas"
          text="Desde una receta puedes añadir los ingredientes que te faltan."
        />
      ) : (
        <Card>
          {lists.data?.map((list) => (
            <ListRow
              key={list.id}
              icon="cart-outline"
              title={list.name}
              subtitle={`${list.completedCount}/${list.itemCount} comprados`}
              onPress={() => router.push(`/compras/${list.id}`)}
              right={
                <Pressable
                  hitSlop={10}
                  onPress={() =>
                    Alert.alert('Eliminar lista', `¿Eliminar “${list.name}”?`, [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Eliminar',
                        style: 'destructive',
                        onPress: () => mutate(() => client.shopping.remove(list.id)),
                      },
                    ])
                  }
                >
                  <Ionicons name="trash-outline" size={22} color={colors.danger} />
                </Pressable>
              }
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}
