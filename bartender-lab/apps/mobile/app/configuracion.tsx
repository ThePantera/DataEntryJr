import type { SyncReport } from '@bartender-lab/client-core';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, Field, Screen, SectionTitle } from '../src/components/ui';
import { useClient } from '../src/client-context';
import { useMutate, useSyncState } from '../src/hooks';
import { useSyncNow } from '../src/sync-context';
import { colors, spacing } from '../src/theme';

const STATUS: Record<SyncReport['status'], string> = {
  ok: 'Sincronizado',
  offline: 'Sin conexión: tus cambios se guardaron y se enviarán al reconectar',
  'not-configured': 'Sin servidor configurado',
  'session-expired': 'La sesión expiró: vuelve a iniciar sesión',
  error: 'El servidor respondió con un error',
};

function describe(report: SyncReport): string {
  const parts = [STATUS[report.status]];
  if (report.pushed) parts.push(`${report.pushed} cambios enviados`);
  if (report.userChanges) parts.push(`${report.userChanges} cambios recibidos`);
  if (report.conflicts)
    parts.push(`${report.conflicts} conflictos (se conservó la versión del servidor)`);
  if (report.outdatedRecipes) parts.push(`${report.outdatedRecipes} recetas con actualización`);
  return parts.join(' · ');
}

export default function SettingsScreen() {
  const client = useClient();
  const mutate = useMutate();
  const syncNow = useSyncNow();
  const state = useSyncState();
  const [url, setUrl] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<string | null>(null);

  const serverUrl = url ?? state.data?.serverUrl ?? '';
  const session = state.data?.session;

  const attempt = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    try {
      await task();
    } catch (error) {
      Alert.alert('No se pudo completar', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const saveServer = () =>
    attempt('server', async () => {
      await mutate(() => client.setServerUrl(serverUrl));
      setUrl(null);
      setLastReport(describe(await syncNow()));
    });

  const authenticate = (mode: 'login' | 'register') =>
    attempt(mode, async () => {
      await mutate(() =>
        mode === 'login'
          ? client.sync.login(email.trim(), password)
          : client.sync.register(email.trim(), password, name.trim() || 'Bartender'),
      );
      setPassword('');
      setLastReport(describe(await syncNow()));
    });

  const logout = () =>
    Alert.alert(
      'Cerrar sesión',
      'Se enviarán tus cambios pendientes y se borrarán tus datos personales de este teléfono. El recetario se conserva.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: () =>
            attempt('logout', async () => {
              const result = await mutate(() => client.sync.logout());
              if (result.unsyncedDiscarded)
                Alert.alert(
                  'Aviso',
                  `${result.unsyncedDiscarded} cambios no se pudieron enviar y se descartaron.`,
                );
            }),
        },
      ],
    );

  return (
    <Screen>
      <SectionTitle>Servidor (opcional)</SectionTitle>
      <Body muted>
        La app funciona completa sin servidor. Conecta uno solo si quieres sincronizar Mi barra,
        favoritos y listas entre dispositivos o descargar recetas nuevas.
      </Body>
      <Field
        label="Dirección del servidor"
        placeholder="https://mi-servidor.com"
        value={serverUrl}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      {serverUrl.startsWith('http://') ? (
        <Text style={styles.warning}>Conexión sin cifrar: úsala solo en tu red local.</Text>
      ) : null}
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            label="Guardar"
            icon="save-outline"
            onPress={saveServer}
            loading={busy === 'server'}
          />
        </View>
        {state.data?.serverUrl ? (
          <View style={styles.flex}>
            <Button
              label="Quitar"
              variant="secondary"
              onPress={() =>
                attempt('server', () =>
                  mutate(() => client.setServerUrl(null)).then(() => setUrl(null)),
                )
              }
            />
          </View>
        ) : null}
      </View>

      {state.data?.serverUrl ? (
        <>
          <SectionTitle>Cuenta</SectionTitle>
          {session ? (
            <Card>
              <Body>{`${session.user.displayName} · ${session.user.email}`}</Body>
              <Button
                label="Cerrar sesión"
                icon="log-out-outline"
                variant="danger"
                onPress={logout}
                loading={busy === 'logout'}
              />
            </Card>
          ) : (
            <Card>
              <Field
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
              <Field
                placeholder="Contraseña (mínimo 8 caracteres)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <Field
                placeholder="Nombre (solo para registrarte)"
                value={name}
                onChangeText={setName}
              />
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button
                    label="Entrar"
                    onPress={() => authenticate('login')}
                    loading={busy === 'login'}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    label="Registrarme"
                    variant="secondary"
                    onPress={() => authenticate('register')}
                    loading={busy === 'register'}
                  />
                </View>
              </View>
            </Card>
          )}

          <SectionTitle>Sincronización</SectionTitle>
          <Card>
            <Body>{`Cambios pendientes de enviar: ${state.data.pending}`}</Body>
            <Body muted>
              {state.data.lastSyncAt
                ? `Última sincronización: ${new Date(state.data.lastSyncAt).toLocaleString('es')}`
                : 'Aún no se sincronizó'}
            </Body>
            {lastReport ? <Text style={styles.report}>{lastReport}</Text> : null}
            <Button
              label="Sincronizar ahora"
              icon="sync"
              loading={busy === 'sync'}
              onPress={() => attempt('sync', async () => setLastReport(describe(await syncNow())))}
            />
          </Card>
          {state.data.notices.length ? (
            <>
              <SectionTitle>Avisos de sincronización</SectionTitle>
              {state.data.notices.map((n) => (
                <Card key={n.id} style={{ borderColor: colors.warning }}>
                  <Body>{n.message}</Body>
                  <Body muted>{new Date(n.createdAt).toLocaleString('es')}</Body>
                </Card>
              ))}
              <Button
                label="Borrar avisos"
                variant="secondary"
                onPress={() => mutate(() => client.sync.clearNotices())}
              />
            </>
          ) : null}
        </>
      ) : null}

      <SectionTitle>Acerca de</SectionTitle>
      <Body muted>
        Bartender Lab 1.0 · Gratis, sin anuncios ni pagos. Tus datos se guardan en tu teléfono.
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  warning: { color: colors.warning, fontSize: 13 },
  report: { color: colors.lime, fontSize: 14 },
});
