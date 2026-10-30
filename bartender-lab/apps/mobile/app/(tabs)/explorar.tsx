import type { Difficulty, RecipeOrigin } from '@bartender-lab/shared';
import { useState } from 'react';
import { RecipeCard } from '../../src/components/recipe-card';
import { Chip, ChipRow, EmptyState, Screen, SectionTitle } from '../../src/components/ui';
import { useCategories, useRecipes } from '../../src/hooks';

const DIFFICULTIES: Array<[Difficulty, string]> = [
  ['EASY', 'Fácil'],
  ['MEDIUM', 'Media'],
  ['HARD', 'Difícil'],
];

export default function ExploreScreen() {
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>();
  const [origin, setOrigin] = useState<RecipeOrigin | undefined>();
  const categories = useCategories('RECIPE');
  const recipes = useRecipes({ categoryId, difficulty, origin });

  return (
    <Screen>
      <SectionTitle>Categorías</SectionTitle>
      <ChipRow>
        <Chip label="Todas" selected={!categoryId} onPress={() => setCategoryId(undefined)} />
        {categories.data?.map((c) => (
          <Chip
            key={c.id}
            label={`${c.name} (${c.recipeCount})`}
            selected={categoryId === c.id}
            onPress={() => setCategoryId(categoryId === c.id ? undefined : c.id)}
          />
        ))}
      </ChipRow>
      <ChipRow>
        {DIFFICULTIES.map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            selected={difficulty === value}
            onPress={() => setDifficulty(difficulty === value ? undefined : value)}
          />
        ))}
        <Chip
          label="Clásicos"
          selected={origin === 'CLASSIC'}
          onPress={() => setOrigin(origin === 'CLASSIC' ? undefined : 'CLASSIC')}
        />
        <Chip
          label="Creaciones originales"
          selected={origin === 'ORIGINAL'}
          onPress={() => setOrigin(origin === 'ORIGINAL' ? undefined : 'ORIGINAL')}
        />
      </ChipRow>
      <SectionTitle>{`${recipes.data?.length ?? 0} cócteles`}</SectionTitle>
      {recipes.data?.length === 0 ? (
        <EmptyState icon="wine-outline" title="No hay cócteles con esos filtros" />
      ) : (
        recipes.data?.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)
      )}
    </Screen>
  );
}
