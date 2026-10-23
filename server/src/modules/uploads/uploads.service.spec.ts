import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { cloudinarySignature } from './cloudinary-signature.js';
import { UploadsService } from './uploads.service.js';

function service(env: Partial<Env>): UploadsService {
  const config = { get: (key: keyof Env) => env[key] } as unknown as ConfigService<Env, true>;
  return new UploadsService(config);
}

describe('UploadsService', () => {
  const teamId = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

  it('firma la subida en la carpeta del equipo', () => {
    const uploads = service({
      CLOUDINARY_CLOUD_NAME: 'demo',
      CLOUDINARY_API_KEY: '123',
      CLOUDINARY_API_SECRET: 'secreto',
    });
    const signed = uploads.signRosterPhoto(teamId, new Date('2026-10-23T12:00:00Z'));
    expect(signed).toEqual({
      uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
      apiKey: '123',
      timestamp: 1792756800,
      folder: `playbook-pro/teams/${teamId}/roster`,
      signature: cloudinarySignature({ folder: signed.folder, timestamp: 1792756800 }, 'secreto'),
    });
  });

  it('sin Cloudinary configurado responde 503', () => {
    expect(() => service({}).signRosterPhoto(teamId)).toThrow(ServiceUnavailableException);
  });
});
