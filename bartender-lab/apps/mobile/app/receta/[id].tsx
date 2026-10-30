import { allergenLabel, formatQuantity, iceLabel } from '@bartender-lab/client-core';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { RecipeBadges } from '../../src/components/recipe-card';
import {
  Body,
  Button,
  Card,
  EmptyState,
  ListRow,
  Loading,
  Screen,
  SectionTitle,
} from '../../src/components/ui';
import { useClient } from '../../src/client-context';
import { useMutate, useRecipe } from '../../src/hooks';
import { colors, radius, spacing } from '../../src/theme';

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useClient();
  const mutate = useMutate();
  const [servings, setServings] = useState<number | undefined>();
  const recipe = useRecipe(id, servings);

  if (recipe.isLoading) return <Loading />;
  if (!recipe.data) return <EmptyState icon="alert-circle-outline" title="Receta no encontrada" />;
  const r = recipe.data;

  const addMissing = async () => {
    const lists = await client.shopping.lists();
    const listId = lists[0]?.id ?? (await client.shopping.create('Mi lista de compras'));
    const added = await mutate(() =>
      client.shopping.addMissingFromRecipe(listId, r.id, r.servings),
    );
    Alert.alert(
      'Lista de compras',
      added === 0
        ? 'Ya tienes todos los ingredientes obligatorios.'
        : `Se añadieron ${added} ingredientes.`,
      added === 0
        ? undefined
        : [
            { text: 'Cerrar' },
            { text: 'Ver lista', onPress: () => router.push(`/compras/${listId}`) },
          ],
    );
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: r.name,
          headerRight: () => (
            <Pressable onPress={() => mutate(() => client.favorites.toggle(r.id))} hitSlop={12}>
              <Ionicons
                name={r.isFavorite ? 'heart' : 'heart-outline'}
                size={24}
                color={r.isFavorite ? colors.danger : colors.text}
              />
            </Pressable>
          ),
        }}
      />
      <Text style={styles.title}>{r.name}</Text>
      <RecipeBadges recipe={r} />
      <Body>{r.description}</Body>
      {r.outdated ? (
        <Card onPress={() => router.push('/descargas')} style={{ borderColor: colors.warning }}>
          <Body>Hay una versión más reciente en el servidor. Toca para actualizar.</Body>
        </Card>
      ) : null}
      {r.withdrawn ? (
        <Card style={{ borderColor: colors.danger }}>
          <Body>Esta receta ya no se publica en el servidor. Conservas tu copia descargada.</Body>
        </Card>
      ) : null}

      <View style={styles.facts}>
        <Fact icon="wine-outline" label="Vaso" value={r.glassware?.name ?? '—'} />
        <Fact icon="snow-outline" label="Hielo" value={r.iceType ? iceLabel(r.iceType) : '—'} />
      </View>
      <View style={styles.facts}>
        <Fact icon="flask-outline" label="Método" value={r.technique?.name ?? '—'} />
        <Fact icon="leaf-outline" label="Decoración" value={r.garnish ?? 'Sin decoración'} />
      </View>

      <SectionTitle>Ingredientes</SectionTitle>
      <View style={styles.servings}>
        <Text style={styles.servingsText}>
          {r.servings === 1 ? '1 porción' : `${r.servings} porciones`}
        </Text>
        <Pressable style={styles.stepper} onPress={() => setServings(Math.max(1, r.servings - 1))}>
          <Ionicons name="remove" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          style={styles.stepper}
          onPress={() => setServings(Math.min(100, r.servings + 1))}
        >
          <Ionicons name="add" size={20} color={colors.text} />
        </Pressable>
      </View>
      <Card>
        {r.ingredients.map((line) => (
          <View key={line.id} style={styles.ingredient}>
            <Ionicons
              name={line.inInventory ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={line.inInventory ? colors.lime : colors.muted}
            />
            <Text style={styles.ingredientName}>
              {line.name}
              {line.optional ? <Text style={styles.optional}> (opcional)</Text> : null}
            </Text>
            <Text style={styles.quantity}>{formatQuantity(line.quantity, line.unit)}</Text>
          </View>
        ))}
      </Card>
      <Button
        label="Añadir faltantes a la lista de compras"
        icon="cart-outline"
        variant="secondary"
        onPress={addMissing}
      />

      <SectionTitle>Preparación</SectionTitle>
      {r.steps.map((step) => (
        <View key={step.id} style={styles.step}>
          <Text style={styles.stepNumber}>{step.stepNumber}</Text>
          <Text style={styles.stepText}>{step.instruction}</Text>
        </View>
      ))}
      <Button
        label="Modo preparación"
        icon="play"
        onPress={() => router.push(`/preparar/${r.id}?porciones=${r.servings}`)}
      />

      {r.technique ? (
        <ListRow
          icon="school-outline"
          title={`Técnica: ${r.technique.name}`}
          subtitle="Ver la explicación y los errores comunes"
          onPress={() => router.push(`/tecnicas/${r.technique!.id}`)}
        />
      ) : null}
      {r.allergens.length ? (
        <>
          <SectionTitle>Alérgenos</SectionTitle>
          <Body>{r.allergens.map(allergenLabel).join(', ')}</Body>
        </>
      ) : null}
      {r.categories.length ? (
        <Body muted>{r.categories.map((c) => c.name).join(' · ')}</Body>
      ) : null}
      {r.source ? <Body muted>{`Fuente: ${r.source}`}</Body> : null}
    </Screen>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: 'wine-outline' | 'snow-outline' | 'flask-outline' | 'leaf-outline';
  label: string;
  value: string;
}) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 30, fontWeight: '900' },
  facts: { flexDirection: 'row', gap: spacing.md },
  fact: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  factLabel: { color: colors.muted, fontSize: 12 },
  factValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
  servings: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  servingsText: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  stepper: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ingredient: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  ingredientName: { color: colors.text, fontSize: 16, flex: 1 },
  optional: { color: colors.muted, fontSize: 13 },
  quantity: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepNumber: {
    color: colors.onPrimary,
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '800',
    overflow: 'hidden',
  },
  stepText: { color: colors.text, fontSize: 16, lineHeight: 23, flex: 1 },
});
