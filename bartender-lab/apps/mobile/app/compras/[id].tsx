import { formatQuantity } from '@bartender-lab/client-core';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState, Loading, Screen } from '../../src/components/ui';
import { useClient } from '../../src/client-context';
import { useMutate, useShoppingList } from '../../src/hooks';
import { colors, spacing } from '../../src/theme';

export default function ShoppingListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useClient();
  const mutate = useMutate();
  const list = useShoppingList(id);

  if (list.isLoading) return <Loading />;
  if (!list.data) return <EmptyState icon="cart-outline" title="Lista no encontrada" />;
  const items = list.data.items;
  const bought = items.filter((i) => i.completed);

  const moveToBar = () =>
    mutate(async () => {
      for (const item of bought) {
        await client.inventory.save({
          ingredientId: item.ingredientId,
          quantity: item.quantity,
          unit: item.unit,
        });
        await client.shopping.removeItem(item.id);
      }
    }).then(() => Alert.alert('Mi barra', `${bought.length} ingredientes pasaron a Mi barra.`));

  return (
    <Screen>
      <Stack.Screen options={{ title: list.data.name }} />
      <Button
        label="Añadir ingrediente"
        icon="add"
        onPress={() => router.push(`/ingredientes?modo=lista&lista=${id}`)}
      />
      {items.length === 0 ? (
        <EmptyState icon="cart-outline" title="Lista vacía" />
      ) : (
        <Card>
          {items.map((item) => (
            <View key={item.id} style={styles.item}>
              <Pressable
                style={styles.check}
                onPress={() => mutate(() => client.shopping.setCompleted(item.id, !item.completed))}
              >
                <Ionicons
                  name={item.completed ? 'checkbox' : 'square-outline'}
                  size={26}
                  color={item.completed ? colors.lime : colors.muted}
                />
                <View style={styles.flex}>
                  <Text style={[styles.name, item.completed && styles.done]}>
                    {item.ingredientName}
                  </Text>
                  {item.quantity !== null ? (
                    <Text style={styles.qty}>{formatQuantity(item.quantity, item.unit)}</Text>
                  ) : null}
                </View>
              </Pressable>
              <Pressable
                onPress={() => mutate(() => client.shopping.removeItem(item.id))}
                hitSlop={10}
              >
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </Card>
      )}
      {bought.length > 0 ? (
        <Button
          label={`Pasar ${bought.length} comprados a Mi barra`}
          icon="beaker-outline"
          variant="secondary"
          onPress={moveToBar}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  check: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  name: { color: colors.text, fontSize: 17, fontWeight: '600' },
  done: { color: colors.muted, textDecorationLine: 'line-through' },
  qty: { color: colors.primary, fontSize: 13 },
});
