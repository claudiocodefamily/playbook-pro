import { cloudinarySignature } from './cloudinary-signature.js';

describe('cloudinarySignature', () => {
  it('coincide con el ejemplo de la documentación de Cloudinary', () => {
    const signature = cloudinarySignature(
      {
        timestamp: 1315060510,
        public_id: 'sample_image',
        eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop',
      },
      'abcd',
    );
    expect(signature).toBe('bfd09f95f331f558cbd1320e67aa8d488770583e');
  });
});
