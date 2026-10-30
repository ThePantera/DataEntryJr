import { BartenderClient, type Db, type SqlValue } from '@bartender-lab/client-core';
import catalog from '@bartender-lab/client-core/data/catalog.json';
import type { CatalogBundle } from '@bartender-lab/shared';
import * as Crypto from 'expo-crypto';
import * as SplashScreen from 'expo-splash-screen';
import * as SQLite from 'expo-sqlite';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { secureSessionStore } from './session-store';
import { colors } from './theme';

function adapt(db: SQLite.SQLiteDatabase): Db {
  return {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: (sql, ...params: SqlValue[]) => db.runAsync(sql, ...params),
    getAllAsync: <T,>(sql: string, ...params: SqlValue[]) => db.getAllAsync<T>(sql, ...params),
    getFirstAsync: <T,>(sql: string, ...params: SqlValue[]) => db.getFirstAsync<T>(sql, ...params),
    withTransactionAsync: (task) => db.withTransactionAsync(task),
  };
}

async function openClient(): Promise<BartenderClient> {
  const sqlite = await SQLite.openDatabaseAsync('bartender-lab.db');
  return BartenderClient.open({
    db: adapt(sqlite),
    bundle: catalog as CatalogBundle,
    sessions: secureSessionStore,
    newId: () => Crypto.randomUUID(),
  });
}

const ClientContext = createContext<BartenderClient | null>(null);

export function ClientProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<BartenderClient | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    openClient()
      .then(setClient)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => SplashScreen.hideAsync().catch(() => undefined));
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>No se pudo abrir la base de datos</Text>
        <Text style={styles.muted}>{error}</Text>
      </View>
    );
  }
  if (!client) return <View style={styles.center} />;
  return <ClientContext.Provider value={client}>{children}</ClientContext.Provider>;
}

export function useClient(): BartenderClient {
  const client = useContext(ClientContext);
  if (!client) throw new Error('useClient must be used inside ClientProvider');
  return client;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  muted: { color: colors.muted, textAlign: 'center' },
});
