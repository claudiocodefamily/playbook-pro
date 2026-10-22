import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from './client';

type Handler = (url: string, init: RequestInit) => Response;

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createClient(handler: Handler) {
  const fetchMock = vi.fn<typeof fetch>((input, init) =>
    Promise.resolve(handler(String(input), init ?? {})),
  );
  return { client: new ApiClient('/api', fetchMock), fetchMock };
}

const authHeader = (init: RequestInit) =>
  (init.headers as Record<string, string> | undefined)?.Authorization;

describe('ApiClient', () => {
  it('envía el access token y el cuerpo en JSON', async () => {
    const { client, fetchMock } = createClient(() => jsonResponse(200, { ok: true }));
    client.setAccessToken('token-1');

    await expect(
      client.request('/teams', { method: 'POST', body: { name: 'Lobos' } }),
    ).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/teams');
    expect(init).toMatchObject({
      method: 'POST',
      body: '{"name":"Lobos"}',
      credentials: 'include',
    });
    expect(authHeader(init ?? {})).toBe('Bearer token-1');
  });

  it('si el token caducó, renueva la sesión una vez y repite la petición', async () => {
    const { client, fetchMock } = createClient((url, init) => {
      if (url === '/api/auth/refresh') return jsonResponse(200, { accessToken: 'nuevo' });
      return authHeader(init) === 'Bearer nuevo'
        ? jsonResponse(200, ['equipo'])
        : jsonResponse(401);
    });
    client.setAccessToken('caducado');

    await expect(client.request('/teams')).resolves.toEqual(['equipo']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('las peticiones simultáneas comparten una sola renovación', async () => {
    const { client, fetchMock } = createClient((url, init) => {
      if (url === '/api/auth/refresh') return jsonResponse(200, { accessToken: 'nuevo' });
      return authHeader(init) === 'Bearer nuevo' ? jsonResponse(200, []) : jsonResponse(401);
    });

    await Promise.all([client.request('/a'), client.request('/b'), client.request('/c')]);

    const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/auth/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it('si la renovación falla, borra el token y avisa', async () => {
    const { client } = createClient(() => jsonResponse(401, { message: 'La sesión no es válida' }));
    const listener = vi.fn<(token: string | null) => void>();
    client.setAccessToken('caducado');
    client.onTokenChange(listener);

    await expect(client.request('/teams')).rejects.toMatchObject({ status: 401 });
    expect(listener).toHaveBeenCalledWith(null);
  });

  it('convierte los errores de validación de NestJS en un texto legible', async () => {
    const { client } = createClient(() =>
      jsonResponse(400, { message: ['El nombre es obligatorio', 'La unidad no es válida'] }),
    );

    const error = await client.request('/teams').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('El nombre es obligatorio. La unidad no es válida');
  });

  it('devuelve undefined en las respuestas 204', async () => {
    const { client } = createClient(() => new Response(null, { status: 204 }));
    await expect(client.request('/teams/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});
