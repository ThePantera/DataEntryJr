import type { MatchView } from '@bartender-lab/client-core';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { RecipeCard } from '../../src/components/recipe-card';
import {
  Body,
  Chip,
  ChipRow,
  EmptyState,
  Field,
  Screen,
  SectionTitle,
} from '../../src/components/ui';
import { useInventory, useMatch, useRecipes } from '../../src/hooks';
import { colors } from '../../src/theme';

const SECTION: Record<MatchView['classification'], string> = {
  EXACT_MATCH: 'Tienes todo',
  ADAPTABLE: 'Con sustituciones aprobadas',
  INCOMPLETE: 'Te falta poco',
};

function MatchList({ includeIncomplete }: { includeIncomplete: boolean }) {
  const inventory = useInventory();
  const match = useMatch(includeIncomplete);
  if (!inventory.data?.length) {
    return (
      <EmptyState
        icon="beaker-outline"
        title="Tu barra está vacía"
        text="Añade ingredientes en Mi barra y aquí verás qué cócteles puedes preparar."
      />
    );
  }
  if (!match.data?.length) {
    return (
      <EmptyState
        icon="sad-outline"
        title="Ningún cóctel por ahora"
        text="Activa “Te falta poco” para ver opciones cercanas."
      />
    );
  }
  const data = match.data;
  const groups = (['EXACT_MATCH', 'ADAPTABLE', 'INCOMPLETE'] as const)
    .map((classification) => ({
      classification,
      items: data.filter((m) => m.classification === classification),
    }))
    .filter((g) => g.items.length > 0);
  return (
    <>
      {groups.map((group) => (
        <View key={group.classification} style={styles.group}>
          <SectionTitle>{`${SECTION[group.classification]} (${group.items.length})`}</SectionTitle>
          {group.items.map((m) => (
            <RecipeCard
              key={m.recipe.id}
              recipe={m.recipe}
              footer={
                <>
                  {m.substitutions.map((s) => (
                    <Text key={s.ingredientId} style={styles.sub}>
                      {`Usa ${s.substituteName} en lugar de ${s.ingredientName}${s.notes ? ` — ${s.notes}` : ''}`}
                    </Text>
                  ))}
                  {m.missingRequired.length ? (
                    <Text
                      style={styles.missing}
                    >{`Falta: ${m.missingRequired.map((i) => i.name).join(', ')}`}</Text>
                  ) : null}
                </>
              }
            />
          ))}
        </View>
      ))}
    </>
  );
}

export default function SearchScreen() {
  const params = useLocalSearchParams<{ modo?: string }>();
  const [mode, setMode] = useState<'nombre' | 'preparar'>(
    params.modo === 'preparar' ? 'preparar' : 'nombre',
  );
  const [search, setSearch] = useState('');
  const [includeIncomplete, setIncludeIncomplete] = useState(false);
  const results = useRecipes({ search });

  return (
    <Screen>
      <ChipRow>
        <Chip
          label="Por nombre o ingrediente"
          selected={mode === 'nombre'}
          onPress={() => setMode('nombre')}
        />
        <Chip
          label="¿Qué puedo preparar?"
          selected={mode === 'preparar'}
          onPress={() => setMode('preparar')}
        />
      </ChipRow>
      {mode === 'nombre' ? (
        <>
          <Field
            placeholder="Ej.: negroni, limón, ron…"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            returnKeyType="search"
          />
          {results.data?.length === 0 ? (
            <EmptyState
              icon="search-outline"
              title="Sin resultados"
              text="Prueba con otro nombre o ingrediente."
            />
          ) : (
            results.data?.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)
          )}
        </>
      ) : (
        <>
          <Body muted>
            Motor determinista: “Tienes todo” = todos los ingredientes obligatorios; “Con
            sustituciones” = solo con sustituciones aprobadas. Los opcionales no cuentan.
          </Body>
          <View style={styles.toggle}>
            <Text style={styles.toggleText}>Te falta poco (hasta 3 ingredientes)</Text>
            <Switch
              value={includeIncomplete}
              onValueChange={setIncludeIncomplete}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.text}
            />
          </View>
          <MatchList includeIncomplete={includeIncomplete} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 12 },
  sub: { color: colors.lime, fontSize: 13 },
  missing: { color: colors.warning, fontSize: 13 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleText: { color: colors.text, fontSize: 15, flex: 1 },
});
