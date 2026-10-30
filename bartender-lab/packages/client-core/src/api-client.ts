import type { ApiAuthResponse, ApiUser } from './api-types';

export const API_PREFIX = '/api/v1';

/** The server could not be reached (no connection, timeout, server down). Local data is untouched. */
export class OfflineError extends Error {
  constructor(message = 'Sin conexión con el servidor') {
    super(message);
    this.name = 'OfflineError';
  }
}

/** No server configured: the app works fully offline with its local catalog. */
export class NotConfiguredError extends Error {
  constructor() {
    super('No hay un servidor configurado');
    this.name = 'NotConfiguredError';
  }
}

/** The session can no longer be renewed; the user must log in again. */
export class SessionExpiredError extends Error {
  constructor() {
    super('La sesión expiró; vuelve a iniciar sesión');
    this.name = 'SessionExpiredError';
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    const message =
      body && typeof body === 'object' && 'message' in body
        ? String(Array.isArray(body.message) ? body.message.join(', ') : body.message)
        : `HTTP ${status}`;
    super(message);
    this.name = 'ApiError';
  }
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: ApiUser;
}

/** Where tokens live. On the phone this is expo-secure-store, never SQLite. */
export interface SessionStore {
  load(): Promise<Session | null>;
  save(session: Session | null): Promise<void>;
}

export interface ApiClientOptions {
  getBaseUrl: () => Promise<string | null>;
  sessions: SessionStore;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

type AuthMode = 'none' | 'optional' | 'required';

export class ApiClient {
  private refreshing: Promise<Session | null> | null = null;

  constructor(private readonly options: ApiClientOptions) {}

  get sessions(): SessionStore {
    return this.options.sessions;
  }

  async isConfigured(): Promise<boolean> {
    return Boolean(await this.options.getBaseUrl());
  }

  async request<T>(
    method: string,
    path: string,
    init: { body?: unknown; auth?: AuthMode } = {},
  ): Promise<T> {
    const auth = init.auth ?? 'none';
    const session = auth === 'none' ? null : await this.options.sessions.load();
    if (auth === 'required' && !session) throw new SessionExpiredError();

    let response = await this.send(method, path, init.body, session?.accessToken);
    if (response.status === 401 && session) {
      const renewed = await this.refresh();
      if (!renewed) {
        if (auth === 'required') throw new SessionExpiredError();
        response = await this.send(method, path, init.body);
      } else {
        response = await this.send(method, path, init.body, renewed.accessToken);
      }
    }
    return this.parse<T>(response);
  }

  async register(email: string, password: string, displayName: string): Promise<Session> {
    return this.startSession(
      await this.parse<ApiAuthResponse>(
        await this.send('POST', '/auth/register', { email, password, displayName }),
      ),
    );
  }

  async login(email: string, password: string): Promise<Session> {
    return this.startSession(
      await this.parse<ApiAuthResponse>(
        await this.send('POST', '/auth/login', { email, password }),
      ),
    );
  }

  /** Revokes the session on the server when reachable; the local session is always cleared. */
  async logout(): Promise<void> {
    const session = await this.options.sessions.load();
    await this.options.sessions.save(null);
    if (!session) return;
    try {
      await this.send('POST', '/auth/logout', { refreshToken: session.refreshToken });
    } catch {
      // Offline: the refresh token simply expires on the server.
    }
  }

  /**
   * Single-flight refresh: the server rotates refresh tokens and treats reuse as theft, so two
   * concurrent refreshes with the same token would end the session (ADR-0004).
   */
  refresh(): Promise<Session | null> {
    this.refreshing ??= this.doRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async doRefresh(): Promise<Session | null> {
    const session = await this.options.sessions.load();
    if (!session) return null;
    const response = await this.send('POST', '/auth/refresh', {
      refreshToken: session.refreshToken,
    });
    if (response.status === 401) {
      await this.options.sessions.save(null);
      return null;
    }
    return this.startSession(await this.parse<ApiAuthResponse>(response));
  }

  private async startSession(auth: ApiAuthResponse): Promise<Session> {
    const session = {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      user: auth.user,
    };
    await this.options.sessions.save(session);
    return session;
  }

  private async send(
    method: string,
    path: string,
    body?: unknown,
    token?: string,
  ): Promise<Response> {
    const base = await this.options.getBaseUrl();
    if (!base) throw new NotConfiguredError();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15_000);
    try {
      return await (this.options.fetchImpl ?? fetch)(
        `${base.replace(/\/+$/, '')}${API_PREFIX}${path}`,
        {
          method,
          headers: {
            Accept: 'application/json',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        },
      );
    } catch {
      throw new OfflineError();
    } finally {
      clearTimeout(timer);
    }
  }

  private async parse<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, body);
    return body as T;
  }
}
