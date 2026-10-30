import {
  formatQuantity,
  INPUT_UNITS,
  unitLabel,
  type InventoryItemView,
} from '@bartender-lab/client-core';
import type { Unit } from '@bartender-lab/shared';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Body,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Field,
  Screen,
} from '../../src/components/ui';
import { useClient } from '../../src/client-context';
import { useInventory, useMatch, useMutate } from '../../src/hooks';
import { colors, spacing } from '../../src/theme';

function parseQuantity(text: string): number | null {
  const value = Number(text.replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(value) || value < 0
    ? null
    : Math.round(value * 100) / 100;
}

function InventoryEditor({ item, onDone }: { item: InventoryItemView; onDone: () => void }) {
  const client = useClient();
  const mutate = useMutate();
  const [quantity, setQuantity] = useState(
    item.quantity === null ? '' : String(item.quantity).replace('.', ','),
  );
  const [unit, setUnit] = useState<Unit | null>(item.unit);

  const save = async (override?: { quantity: number | null }) => {
    const value = override ? override.quantity : parseQuantity(quantity);
    await mutate(() =>
      client.inventory.save({
        ingredientId: item.ingredientId,
        quantity: value,
        unit: value === null ? null : (unit ?? 'ML'),
        expirationDate: item.expirationDate,
      }),
    );
    onDone();
  };

  const remove = () =>
    Alert.alert('Quitar de Mi barra', `¿Quitar ${item.ingredientName}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          await mutate(() => client.inventory.remove(item.id));
          onDone();
        },
      },
    ]);

  return (
    <View style={styles.editor}>
      <Field
        label="Cantidad (opcional)"
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="decimal-pad"
        placeholder="Sin precisar"
      />
      <ChipRow>
        {INPUT_UNITS.map((u) => (
          <Chip key={u} label={unitLabel(u)} selected={unit === u} onPress={() => setUnit(u)} />
        ))}
      </ChipRow>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button label="Guardar" icon="checkmark" onPress={() => save()} />
        </View>
        <View style={styles.flex}>
          <Button
            label="Agotado"
            icon="alert-circle-outline"
            variant="secondary"
            onPress={() => save({ quantity: 0 })}
          />
        </View>
      </View>
      <Button label="Quitar de Mi barra" icon="trash-outline" variant="danger" onPress={remove} />
    </View>
  );
}

export default function MyBarScreen() {
  const inventory = useInventory();
  const match = useMatch(false);
  const [editing, setEditing] = useState<string | null>(null);
  const items = inventory.data ?? [];

  return (
    <Screen>
      <Button
        label="Añadir ingrediente"
        icon="add"
        onPress={() => router.push('/ingredientes?modo=barra')}
      />
      {items.length > 0 ? (
        <Card onPress={() => router.push('/buscar?modo=preparar')}>
          <Body>{`Con lo que tienes puedes preparar ${match.data?.length ?? 0} cócteles.`}</Body>
          <Body muted>Toca para verlos.</Body>
        </Card>
      ) : null}
      {items.length === 0 ? (
        <EmptyState
          icon="beaker-outline"
          title="Mi barra está vacía"
          text="Registra los ingredientes que tienes para saber qué cócteles puedes preparar, incluso sin conexión."
        />
      ) : (
        items.map((item) => (
          <Card key={item.id}>
            <Pressable
              style={styles.row}
              onPress={() => setEditing(editing === item.id ? null : item.id)}
            >
              <View style={styles.flex}>
                <Text style={[styles.name, item.depleted && styles.depleted]}>
                  {item.ingredientName}
                </Text>
                <Text style={styles.meta}>
                  {item.depleted
                    ? 'Agotado'
                    : [item.categoryName, formatQuantity(item.quantity, item.unit)]
                        .filter(Boolean)
                        .join(' · ')}
                </Text>
              </View>
              <Ionicons
                name={editing === item.id ? 'chevron-up' : 'create-outline'}
                size={20}
                color={colors.muted}
              />
            </Pressable>
            {editing === item.id ? (
              <InventoryEditor item={item} onDone={() => setEditing(null)} />
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  depleted: { color: colors.muted, textDecorationLine: 'line-through' },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  editor: { gap: spacing.md, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
