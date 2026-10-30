import { router } from 'expo-router';
import { Body, Card, ListRow, Screen, SectionTitle } from '../../src/components/ui';
import { useSyncState } from '../../src/hooks';

export default function MoreScreen() {
  const sync = useSyncState();
  return (
    <Screen>
      <Card>
        <ListRow icon="heart-outline" title="Favoritos" onPress={() => router.push('/favoritos')} />
        <ListRow
          icon="school-outline"
          title="Escuela de técnicas"
          onPress={() => router.push('/tecnicas')}
        />
        <ListRow
          icon="cart-outline"
          title="Listas de compras"
          onPress={() => router.push('/compras')}
        />
        <ListRow
          icon="cloud-download-outline"
          title="Descargas offline"
          subtitle={
            sync.data?.outdated ? `${sync.data.outdated} con actualización disponible` : undefined
          }
          onPress={() => router.push('/descargas')}
        />
        <ListRow
          icon="settings-outline"
          title="Configuración"
          subtitle={
            sync.data?.session ? sync.data.session.user.email : 'Sin cuenta (modo sin conexión)'
          }
          onPress={() => router.push('/configuracion')}
        />
      </Card>
      <SectionTitle>Acerca de</SectionTitle>
      <Body muted>
        Bartender Lab es gratuito: sin suscripciones, sin pagos y sin recetas bloqueadas. Las
        recetas clásicas siguen las especificaciones de la IBA.
      </Body>
    </Screen>
  );
}
