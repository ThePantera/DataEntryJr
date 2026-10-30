import { RecipeCard } from '../src/components/recipe-card';
import { EmptyState, Screen } from '../src/components/ui';
import { useRecipes } from '../src/hooks';

export default function FavoritesScreen() {
  const favorites = useRecipes({ favoritesOnly: true });
  return (
    <Screen>
      {favorites.data?.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title="Sin favoritos todavía"
          text="Toca el corazón en cualquier receta para guardarla aquí."
        />
      ) : (
        favorites.data?.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)
      )}
    </Screen>
  );
}
