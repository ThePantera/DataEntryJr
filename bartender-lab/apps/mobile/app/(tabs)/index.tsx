import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RecipeCard } from '../../src/components/recipe-card';
import { Body, Card, ListRow, Screen, SectionTitle } from '../../src/components/ui';
import { useInventory, useMatch, useRecipes, useSyncState } from '../../src/hooks';
import { colors, spacing } from '../../src/theme';

export default function HomeScreen() {
  const recipes = useRecipes();
  const match = useMatch(false);
  const inventory = useInventory();
  const sync = useSyncState();

  const exact = match.data?.filter((m) => m.classification === 'EXACT_MATCH').length ?? 0;
  const adaptable = match.data?.filter((m) => m.classification === 'ADAPTABLE').length ?? 0;
  const outdated = sync.data?.outdated ?? 0;

  return (
    <Screen>
      <Body muted>Coctelería profesional en tu bolsillo. Funciona sin conexión y es gratis.</Body>

      <Card onPress={() => router.push('/buscar?modo=preparar')} style={styles.hero}>
        <Text style={styles.heroLabel}>Con tu barra puedes preparar</Text>
        <Text style={styles.heroNumber}>{exact}</Text>
        <Text style={styles.heroText}>
          {inventory.data?.length
            ? `cócteles${adaptable ? ` · ${adaptable} más con sustituciones` : ''}`
            : 'Añade ingredientes a Mi barra para descubrir qué preparar'}
        </Text>
      </Card>

      {outdated > 0 ? (
        <Card onPress={() => router.push('/descargas')} style={styles.warning}>
          <Text style={styles.warningText}>
            {outdated === 1
              ? 'Hay 1 receta con una versión nueva'
              : `Hay ${outdated} recetas con versiones nuevas`}
          </Text>
          <Body muted>Toca para actualizarlas.</Body>
        </Card>
      ) : null}

      <View style={styles.quick}>
        <Card onPress={() => router.push('/mi-barra')} style={styles.quickCard}>
          <Text style={styles.quickTitle}>Mi barra</Text>
          <Body muted>{inventory.data?.length ?? 0} ingredientes</Body>
        </Card>
        <Card onPress={() => router.push('/tecnicas')} style={styles.quickCard}>
          <Text style={styles.quickTitle}>Técnicas</Text>
          <Body muted>Escuela</Body>
        </Card>
      </View>
      <View style={styles.quick}>
        <Card onPress={() => router.push('/favoritos')} style={styles.quickCard}>
          <Text style={styles.quickTitle}>Favoritos</Text>
          <Body muted>{recipes.data?.filter((r) => r.isFavorite).length ?? 0} recetas</Body>
        </Card>
        <Card onPress={() => router.push('/compras')} style={styles.quickCard}>
          <Text style={styles.quickTitle}>Compras</Text>
          <Body muted>Listas</Body>
        </Card>
      </View>

      <SectionTitle>Recetario</SectionTitle>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
      >
        {recipes.data?.map((recipe) => (
          <View key={recipe.id} style={styles.carouselItem}>
            <RecipeCard recipe={recipe} />
          </View>
        ))}
      </ScrollView>

      <SectionTitle>Estado</SectionTitle>
      <ListRow
        icon={sync.data?.serverUrl ? 'cloud-done-outline' : 'cloud-offline-outline'}
        title={sync.data?.serverUrl ? 'Sincronización activada' : 'Modo sin conexión'}
        subtitle={
          sync.data?.serverUrl
            ? sync.data.lastSyncAt
              ? `Última sincronización: ${new Date(sync.data.lastSyncAt).toLocaleString('es')}`
              : 'Aún no se sincronizó'
            : 'Todo funciona sin servidor. Puedes conectar uno en Configuración.'
        }
        onPress={() => router.push('/configuracion')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.surfaceAlt, borderColor: colors.primary },
  heroLabel: { color: colors.muted, fontSize: 14 },
  heroNumber: { color: colors.primary, fontSize: 48, fontWeight: '900' },
  heroText: { color: colors.text, fontSize: 15 },
  warning: { borderColor: colors.warning },
  warningText: { color: colors.warning, fontWeight: '700', fontSize: 15 },
  quick: { flexDirection: 'row', gap: spacing.md },
  quickCard: { flex: 1 },
  quickTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  carousel: { gap: spacing.md },
  carouselItem: { width: 260 },
});
