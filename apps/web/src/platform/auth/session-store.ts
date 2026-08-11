import { authSessionSchema, type AuthSession } from "./auth-schemas";

export const SESSION_STORAGE_KEY = "defterx.live.session";

export interface SessionPersistence {
  load(): AuthSession | null;
  save(session: AuthSession): void;
  clear(): void;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export class SessionStore implements SessionPersistence {
  readonly #storage: StorageLike | null;

  constructor(storage: StorageLike | null = browserStorage()) {
    this.#storage = storage;
  }

  load(): AuthSession | null {
    if (!this.#storage) return null;

    try {
      const serialized = this.#storage.getItem(SESSION_STORAGE_KEY);
      if (!serialized) return null;

      const parsed = authSessionSchema.safeParse(JSON.parse(serialized) as unknown);
      if (parsed.success) return parsed.data;

      this.clear();
      return null;
    } catch {
      return null;
    }
  }

  save(session: AuthSession): void {
    this.#storage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  clear(): void {
    this.#storage?.removeItem(SESSION_STORAGE_KEY);
  }
}
