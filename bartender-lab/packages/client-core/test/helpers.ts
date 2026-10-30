import { randomUUID } from 'node:crypto';
import type { CatalogBundle } from '@bartender-lab/shared';
import bundle from '../data/catalog.json';
import type { Session, SessionStore } from '../src/api-client';
import { BartenderClient } from '../src/client';
import { openNodeDb } from '../src/node-sqlite';

export const catalog = bundle as CatalogBundle;

export class MemorySessionStore implements SessionStore {
  session: Session | null = null;
  async load() {
    return this.session;
  }
  async save(session: Session | null) {
    this.session = session;
  }
}

export async function openClient(
  options: { fetchImpl?: typeof fetch; bundle?: CatalogBundle } = {},
) {
  const db = openNodeDb();
  const sessions = new MemorySessionStore();
  const client = await BartenderClient.open({
    db,
    bundle: options.bundle ?? catalog,
    sessions,
    newId: randomUUID,
    fetchImpl: options.fetchImpl,
  });
  return { client, db, sessions };
}

export const ingredientId = (name: string) => {
  const found = catalog.ingredients.find((i) => i.name === name);
  if (!found) throw new Error(`No ingredient ${name}`);
  return found.id;
};

export const recipeId = (slug: string) => {
  const found = catalog.recipes.find((r) => r.slug === slug);
  if (!found) throw new Error(`No recipe ${slug}`);
  return found.id;
};
