import { describe, expect, it, vi } from 'vitest';
import { uploadToCloudinary } from './endpoints';

const signature = {
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
  apiKey: '123',
  timestamp: 1792756800,
  folder: 'playbook-pro/teams/t/roster',
  signature: 'firma',
};

describe('uploadToCloudinary', () => {
  it('envía la foto con la firma y devuelve la URL https', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ secure_url: 'https://res.cloudinary.com/demo/image/upload/foto.jpg' }),
    );
    const file = new File(['foto'], 'foto.jpg', { type: 'image/jpeg' });

    const url = await uploadToCloudinary(file, signature, fetchImpl);

    expect(url).toBe('https://res.cloudinary.com/demo/image/upload/foto.jpg');
    const [target, init] = fetchImpl.mock.calls[0] ?? [];
    expect(target).toBe(signature.uploadUrl);
    const body = init?.body;
    if (!(body instanceof FormData)) throw new Error('debería enviar un FormData');
    expect(body.get('signature')).toBe('firma');
    expect(body.get('folder')).toBe(signature.folder);
    expect(body.get('timestamp')).toBe('1792756800');
  });

  it('falla con un mensaje claro si Cloudinary rechaza la foto', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ error: { message: 'Invalid image file' } }, { status: 400 }),
    );
    const file = new File(['x'], 'x.txt');
    await expect(uploadToCloudinary(file, signature, fetchImpl)).rejects.toThrow(/subir la foto/);
  });
});
