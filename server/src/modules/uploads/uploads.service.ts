import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { cloudinarySignature } from './cloudinary-signature.js';
import type { UploadSignatureResponseDto } from './dto/upload-signature-response.dto.js';

@Injectable()
export class UploadsService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  /** Firma para subir una foto del roster a la carpeta del equipo en Cloudinary. */
  signRosterPhoto(teamId: string, now = new Date()): UploadSignatureResponseDto {
    const cloudName = this.config.get('CLOUDINARY_CLOUD_NAME', { infer: true });
    const apiKey = this.config.get('CLOUDINARY_API_KEY', { infer: true });
    const apiSecret = this.config.get('CLOUDINARY_API_SECRET', { infer: true });
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'La subida de fotos no está configurada: pega la URL de la foto',
      );
    }
    const timestamp = Math.floor(now.getTime() / 1000);
    // Cada equipo sube a su carpeta: la firma no sirve para otra.
    const folder = `playbook-pro/teams/${teamId}/roster`;
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      apiKey,
      timestamp,
      folder,
      signature: cloudinarySignature({ folder, timestamp }, apiSecret),
    };
  }
}
