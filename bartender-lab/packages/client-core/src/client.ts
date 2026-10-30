import type { CatalogBundle } from '@bartender-lab/shared';
import { ApiClient, type SessionStore } from './api-client';
import { importBundledCatalog } from './catalog-store';
import { CatalogRepository } from './catalog-repo';
import type { Db } from './db';
import { Outbox } from './outbox';
import { getMeta, migrate, setMeta } from './schema';
import { SyncEngine } from './sync-engine';
import { FavoritesRepository, InventoryRepository, ShoppingListsRepository } from './user-data';

export interface BartenderClientOptions {
  db: Db;
  bundle: CatalogBundle;
  sessions: SessionStore;
  newId: () => string;
  fetchImpl?: typeof fetch;
}

const SERVER_URL_KEY = 'server_url';

/** Everything the app needs, wired together. Works fully offline; the server is optional. */
export class BartenderClient {
  readonly catalog: CatalogRepository;
  readonly inventory: InventoryRepository;
  readonly favorites: FavoritesRepository;
  readonly shopping: ShoppingListsRepository;
  readonly outbox: Outbox;
  readonly api: ApiClient;
  readonly sync: SyncEngine;

  private constructor(private readonly options: BartenderClientOptions) {
    const { db, newId } = options;
    this.outbox = new Outbox(db, newId);
    this.catalog = new CatalogRepository(db);
    this.inventory = new InventoryRepository(db, this.outbox, newId);
    this.favorites = new FavoritesRepository(db, this.outbox, newId);
    this.shopping = new ShoppingListsRepository(db, this.outbox, newId);
    this.api = new ApiClient({
      getBaseUrl: () => this.getServerUrl(),
      sessions: options.sessions,
      fetchImpl: options.fetchImpl,
    });
    this.sync = new SyncEngine(db, this.api, this.outbox);
  }

  /** Creates the schema if needed and loads the catalog bundled with the app. */
  static async open(options: BartenderClientOptions): Promise<BartenderClient> {
    await migrate(options.db);
    await importBundledCatalog(options.db, options.bundle);
    const client = new BartenderClient(options);
    await client.outbox.resetInFlight();
    return client;
  }

  getServerUrl(): Promise<string | null> {
    return getMeta(this.options.db, SERVER_URL_KEY);
  }

  /** Empty or null = no server (offline-only mode). Changing server resets the sync cursor. */
  async setServerUrl(url: string | null): Promise<void> {
    const value = url?.trim().replace(/\/+$/, '') || null;
    if (value && !/^https?:\/\/[^\s]+$/i.test(value))
      throw new Error('La dirección debe empezar por http:// o https://');
    if (value !== (await this.getServerUrl())) await setMeta(this.options.db, 'sync_cursor', null);
    await setMeta(this.options.db, SERVER_URL_KEY, value);
  }
}
