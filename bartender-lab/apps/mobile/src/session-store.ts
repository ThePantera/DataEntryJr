import type { Session, SessionStore } from '@bartender-lab/client-core';
import * as SecureStore from 'expo-secure-store';

const KEY = 'bartender-lab.session';

/** Tokens live in the OS keystore (expo-secure-store), never in SQLite. */
export const secureSessionStore: SessionStore = {
  async load() {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  },
  async save(session) {
    if (session) await SecureStore.setItemAsync(KEY, JSON.stringify(session));
    else await SecureStore.deleteItemAsync(KEY);
  },
};
