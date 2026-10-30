import type { Session, SessionStore } from '@bartender-lab/client-core';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'bartender-lab.session';

/** Tokens live in the OS keystore (expo-secure-store), never in SQLite. */
const secureStore: SessionStore = {
  async load() {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  },
  async save(session) {
    if (session) await SecureStore.setItemAsync(KEY, JSON.stringify(session));
    else await SecureStore.deleteItemAsync(KEY);
  },
};

/** The web build exists only for automated smoke tests; it keeps the session in memory. */
let memorySession: Session | null = null;
const memoryStore: SessionStore = {
  async load() {
    return memorySession;
  },
  async save(session) {
    memorySession = session;
  },
};

export const secureSessionStore: SessionStore = Platform.OS === 'web' ? memoryStore : secureStore;
