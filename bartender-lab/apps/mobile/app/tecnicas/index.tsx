import { router } from 'expo-router';
import { Text } from 'react-native';
import { Body, Card, Screen } from '../../src/components/ui';
import { useTechniques } from '../../src/hooks';
import { colors } from '../../src/theme';

export default function TechniquesScreen() {
  const techniques = useTechniques();
  return (
    <Screen>
      <Body muted>
        Las técnicas básicas de la barra, con su equipamiento y los errores más comunes.
      </Body>
      {techniques.data?.map((t) => (
        <Card key={t.id} onPress={() => router.push(`/tecnicas/${t.id}`)}>
          <Text style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>{t.name}</Text>
          <Body muted>{t.description}</Body>
        </Card>
      ))}
    </Screen>
  );
}
