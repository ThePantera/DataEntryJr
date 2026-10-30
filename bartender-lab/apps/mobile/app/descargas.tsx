import type { RemoteRecipe } from '@bartender-lab/client-core';
import { useState } from 'react';
import { Alert } from 'react-native';
import { RecipeCard } from '../src/components/recipe-card';
import {
  Body,
  Button,
  Card,
  EmptyState,
  ListRow,
  Screen,
  SectionTitle,
} from '../src/components/ui';
import { useClient } from '../src/client-context';
import { useMutate, useRecipes, useSyncState } from '../src/hooks';

export default function DownloadsScreen() {
  const client = useClient();
  const mutate = useMutate();
  const recipes = useRecipes();
  const sync = useSyncState();
  const [remote, setRemote] = useState<RemoteRecipe[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const local = recipes.data ?? [];
  const outdated = local.filter((r) => r.outdated);
  const withdrawn = local.filter((r) => r.withdrawn);

  const run = async (key: string, task: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await mutate(task);
    } catch (error) {
      Alert.alert(
        'Sin conexión',
        error instanceof Error ? error.message : 'No se pudo contactar al servidor.',
      );
    } finally {
      setBusy(null);
    }
  };

  const loadRemote = () =>
    run('remote', async () => setRemote(await client.sync.listRemoteRecipes()));

  return (
    <Screen>
      <Card>
        <Body>{`${local.length} recetas guardadas en este teléfono. Todas se pueden usar sin conexión y sin cuenta.`}</Body>
        <Body muted>
          {sync.data?.serverUrl
            ? `Servidor: ${sync.data.serverUrl}`
            : 'Sin servidor configurado: se usa el recetario incorporado.'}
        </Body>
      </Card>

      {outdated.length > 0 ? (
        <>
          <SectionTitle>{`Actualizaciones disponibles (${outdated.length})`}</SectionTitle>
          <Button
            label="Actualizar todas"
            icon="refresh"
            loading={busy === 'all'}
            onPress={() => run('all', () => client.sync.updateOutdatedRecipes())}
          />
          {outdated.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              footer={
                <Button
                  label="Actualizar"
                  variant="secondary"
                  loading={busy === recipe.id}
                  onPress={() => run(recipe.id, () => client.sync.downloadRecipe(recipe.id))}
                />
              }
            />
          ))}
        </>
      ) : null}

      {withdrawn.length > 0 ? (
        <>
          <SectionTitle>Retiradas del servidor</SectionTitle>
          <Body muted>Ya no se publican, pero conservas tu copia.</Body>
          {withdrawn.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </>
      ) : null}

      <SectionTitle>Recetas del servidor</SectionTitle>
      {!sync.data?.serverUrl ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Sin servidor"
          text="Configura un servidor en Configuración para descargar más recetas."
        />
      ) : (
        <>
          <Button
            label="Ver recetas disponibles"
            icon="cloud-download-outline"
            variant="secondary"
            loading={busy === 'remote'}
            onPress={loadRemote}
          />
          {remote ? (
            <Card>
              {remote.length === 0 ? (
                <Body muted>El servidor no tiene recetas publicadas.</Body>
              ) : null}
              {remote.map((r) => (
                <ListRow
                  key={r.id}
                  title={r.name}
                  subtitle={
                    r.status === 'downloaded'
                      ? 'Guardada en el teléfono'
                      : r.status === 'outdated'
                        ? 'Hay una versión nueva'
                        : r.description
                  }
                  onPress={
                    r.status === 'downloaded'
                      ? undefined
                      : () =>
                          run(r.id, async () => {
                            await client.sync.downloadRecipe(r.id);
                            setRemote(await client.sync.listRemoteRecipes());
                          })
                  }
                />
              ))}
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}
