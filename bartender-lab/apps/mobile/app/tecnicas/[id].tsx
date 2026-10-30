import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import {
  Badge,
  Body,
  Card,
  EmptyState,
  Loading,
  Screen,
  SectionTitle,
} from '../../src/components/ui';
import { useTechnique } from '../../src/hooks';
import { colors, spacing } from '../../src/theme';

export default function TechniqueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const technique = useTechnique(id);
  if (technique.isLoading) return <Loading />;
  if (!technique.data)
    return <EmptyState icon="alert-circle-outline" title="Técnica no encontrada" />;
  const t = technique.data;
  return (
    <Screen>
      <Stack.Screen options={{ title: t.name }} />
      <Text style={{ color: colors.text, fontSize: 30, fontWeight: '900' }}>{t.name}</Text>
      <Body>{t.description}</Body>
      {t.durationSeconds ? <Badge label={`Duración típica: hasta ${t.durationSeconds} s`} /> : null}
      <SectionTitle>Cómo se hace</SectionTitle>
      <Card>
        <Body>{t.instructions}</Body>
      </Card>
      <SectionTitle>Equipamiento</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {t.equipment.map((name) => (
          <Badge key={name} label={name} color={colors.text} />
        ))}
      </View>
      {t.commonMistakes.length ? (
        <>
          <SectionTitle>Errores comunes</SectionTitle>
          {t.commonMistakes.map((mistake) => (
            <Card key={mistake} style={{ borderColor: colors.warning }}>
              <Body>{mistake}</Body>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
