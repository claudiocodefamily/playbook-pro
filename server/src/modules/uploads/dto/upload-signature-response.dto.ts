import { ApiProperty } from '@nestjs/swagger';

/** Lo que necesita el navegador para subir una foto directamente a Cloudinary. */
export class UploadSignatureResponseDto {
  @ApiProperty({ example: 'https://api.cloudinary.com/v1_1/demo/image/upload' })
  uploadUrl!: string;

  @ApiProperty({ example: '123456789012345' })
  apiKey!: string;

  @ApiProperty({ example: 1792756800, description: 'Segundos Unix; la firma caduca en 1 hora' })
  timestamp!: number;

  @ApiProperty({ example: 'playbook-pro/teams/0199.../roster' })
  folder!: string;

  @ApiProperty({ example: 'bfd09f95f331f558cbd1320e67aa8d488770583e' })
  signature!: string;
}
