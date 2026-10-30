import type { RecipeSummary } from '@bartender-lab/client-core';
import { difficultyLabel } from '@bartender-lab/client-core';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Badge, Card } from './ui';

export function RecipeBadges({ recipe }: { recipe: RecipeSummary }) {
  return (
    <View style={local.badges}>
      {recipe.origin === 'ORIGINAL' ? (
        <Badge label="Creación original" color={colors.info} />
      ) : recipe.isOfficialClassic ? (
        <Badge label="Clásico oficial" />
      ) : null}
      <Badge label={difficultyLabel(recipe.difficulty)} color={colors.muted} />
      {recipe.outdated ? <Badge label="Actualización disponible" color={colors.warning} /> : null}
      {recipe.withdrawn ? <Badge label="Retirada del servidor" color={colors.danger} /> : null}
    </View>
  );
}

export function RecipeCard({ recipe, footer }: { recipe: RecipeSummary; footer?: ReactNode }) {
  return (
    <Card onPress={() => router.push(`/receta/${recipe.id}`)}>
      <View style={local.header}>
        <Text style={local.name}>{recipe.name}</Text>
        {recipe.isFavorite ? <Ionicons name="heart" size={18} color={colors.danger} /> : null}
      </View>
      <Text style={local.description} numberOfLines={2}>
        {recipe.description}
      </Text>
      <Text style={local.meta}>
        {[recipe.techniqueName, recipe.glasswareName].filter(Boolean).join(' · ')}
      </Text>
      <RecipeBadges recipe={recipe} />
      {footer}
    </Card>
  );
}

const local = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: colors.text, fontSize: 19, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 14 },
  meta: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
