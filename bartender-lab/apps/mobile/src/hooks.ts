import type { RecipeFilters } from '@bartender-lab/client-core';
import type { CategoryKind } from '@bartender-lab/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useClient } from './client-context';

/** All reads come from the local SQLite database, so they work offline. */
export function useRecipes(filters: RecipeFilters = {}) {
  const client = useClient();
  return useQuery({
    queryKey: ['recipes', filters],
    queryFn: () => client.catalog.listRecipes(filters),
  });
}

export function useRecipe(id: string, servings?: number) {
  const client = useClient();
  return useQuery({
    queryKey: ['recipe', id, servings],
    queryFn: () => client.catalog.getRecipe(id, servings),
  });
}

export function useCategories(kind: CategoryKind) {
  const client = useClient();
  return useQuery({
    queryKey: ['categories', kind],
    queryFn: () => client.catalog.listCategories(kind),
  });
}

export function useIngredients(search: string) {
  const client = useClient();
  return useQuery({
    queryKey: ['ingredients', search],
    queryFn: () => client.catalog.listIngredients(search),
  });
}

export function useTechniques() {
  const client = useClient();
  return useQuery({ queryKey: ['techniques'], queryFn: () => client.catalog.listTechniques() });
}

export function useTechnique(id: string) {
  const client = useClient();
  return useQuery({ queryKey: ['technique', id], queryFn: () => client.catalog.getTechnique(id) });
}

export function useMatch(includeIncomplete: boolean) {
  const client = useClient();
  return useQuery({
    queryKey: ['match', includeIncomplete],
    queryFn: () =>
      client.catalog.match({ includeIncomplete, maxMissing: includeIncomplete ? 3 : undefined }),
  });
}

export function useInventory() {
  const client = useClient();
  return useQuery({ queryKey: ['inventory'], queryFn: () => client.inventory.list() });
}

export function useShoppingLists() {
  const client = useClient();
  return useQuery({ queryKey: ['lists'], queryFn: () => client.shopping.lists() });
}

export function useShoppingList(id: string) {
  const client = useClient();
  return useQuery({ queryKey: ['list', id], queryFn: () => client.shopping.getList(id) });
}

export function useSyncState() {
  const client = useClient();
  return useQuery({
    queryKey: ['sync-state'],
    queryFn: async () => ({
      serverUrl: await client.getServerUrl(),
      session: await client.api.sessions.load(),
      lastSyncAt: await client.sync.lastSyncAt(),
      pending: await client.outbox.count(),
      outdated: (await client.sync.outdatedRecipeIds()).length,
      notices: await client.sync.notices(10),
    }),
  });
}

/** Runs a local write and refreshes every screen (local queries are cheap). */
export function useMutate() {
  const queryClient = useQueryClient();
  return useCallback(
    async <T>(write: () => Promise<T>): Promise<T> => {
      const result = await write();
      await queryClient.invalidateQueries();
      return result;
    },
    [queryClient],
  );
}
