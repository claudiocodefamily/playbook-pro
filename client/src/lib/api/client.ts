/** Error de la API con el código HTTP y un mensaje listo para enseñar al coach. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type TokenListener = (token: string | null) => void;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** false en login/registro/refresh: no tiene sentido renovar la sesión si fallan. */
  retryOnUnauthorized?: boolean;
}

/**
 * Cliente HTTP de la API. El access token vive solo en memoria (nunca en localStorage,
 * para que un script inyectado no pueda robarlo); el refresh token va en una cookie
 * httpOnly que el navegador envía solo a /api/auth.
 *
 * Si una petición responde 401 porque el access token caducó, renueva la sesión una vez
 * y repite la petición. Varias peticiones a la vez comparten la misma renovación.
 */
export class ApiClient {
  private accessToken: string | null = null;
  private refreshing: Promise<boolean> | null = null;
  private readonly listeners = new Set<TokenListener>();

  constructor(
    private readonly baseUrl = '/api',
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  setAccessToken(token: string | null): void {
    this.accessToken = token;
    for (const listener of this.listeners) listener(token);
  }

  /** Avisa cuando cambia el token (por ejemplo, cuando la sesión caduca del todo). */
  onTokenChange(listener: TokenListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { retryOnUnauthorized = true } = options;
    const response = await this.send(path, options);

    if (response.status === 401 && retryOnUnauthorized && (await this.refreshSession())) {
      return this.parse<T>(await this.send(path, options));
    }
    return this.parse<T>(response);
  }

  /** Renueva el access token con la cookie. Devuelve false si la sesión ya no es válida. */
  refreshSession(): Promise<boolean> {
    this.refreshing ??= this.doRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async doRefresh(): Promise<boolean> {
    try {
      const { accessToken } = await this.request<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
        retryOnUnauthorized: false,
      });
      this.setAccessToken(accessToken);
      return true;
    } catch {
      this.setAccessToken(null);
      return false;
    }
  }

  private send(path: string, { method = 'GET', body }: RequestOptions): Promise<Response> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;

    return this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
    });
  }

  private async parse<T>(response: Response): Promise<T> {
    if (response.ok) {
      // 204 No Content (borrados, logout) no trae cuerpo.
      return (response.status === 204 ? undefined : await response.json()) as T;
    }
    throw new ApiError(response.status, await errorMessage(response));
  }
}

/** NestJS responde { message: string | string[] }; se junta en un texto legible. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (Array.isArray(body.message)) return body.message.map(String).join('. ');
    if (typeof body.message === 'string') return body.message;
  } catch {
    // La respuesta no era JSON (por ejemplo, la API está caída y responde el proxy).
  }
  return response.status >= 500
    ? 'El servidor tuvo un problema. Inténtalo de nuevo en unos segundos.'
    : `Error ${response.status}`;
}

export const api = new ApiClient();
