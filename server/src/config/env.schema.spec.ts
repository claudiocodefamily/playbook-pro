import { validateEnv } from './env.schema.js';

const MONGODB_URI = 'mongodb://localhost:27017/?replicaSet=rs0';
const JWT_ACCESS_SECRET = 'secreto-de-prueba-con-mas-de-32-caracteres';
const required = { MONGODB_URI, JWT_ACCESS_SECRET };

describe('validateEnv', () => {
  it('aplica los valores por defecto', () => {
    expect(validateEnv(required)).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      WEB_ORIGIN: 'http://localhost:5173',
      MONGODB_URI,
      MONGODB_DB_NAME: 'playbookpro',
      JWT_ACCESS_SECRET,
      JWT_ACCESS_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_DAYS: 30,
    });
  });

  it('Cloudinary es opcional, pero sus tres variables van juntas', () => {
    const cloudinary = {
      CLOUDINARY_CLOUD_NAME: 'demo',
      CLOUDINARY_API_KEY: '123',
      CLOUDINARY_API_SECRET: 'abc',
    };
    expect(validateEnv({ ...required, ...cloudinary }).CLOUDINARY_CLOUD_NAME).toBe('demo');
    expect(() => validateEnv({ ...required, CLOUDINARY_CLOUD_NAME: 'demo' })).toThrow(
      /CLOUDINARY_API_SECRET/,
    );
  });

  it('convierte PORT a número', () => {
    expect(validateEnv({ ...required, PORT: '4000' }).PORT).toBe(4000);
  });

  it('falla con un valor inválido y nombra la variable', () => {
    expect(() => validateEnv({ ...required, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('falla si falta MONGODB_URI', () => {
    expect(() => validateEnv({ JWT_ACCESS_SECRET })).toThrow(/MONGODB_URI/);
  });

  it('falla si el secreto JWT falta o es demasiado corto', () => {
    expect(() => validateEnv({ MONGODB_URI })).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => validateEnv({ MONGODB_URI, JWT_ACCESS_SECRET: '123' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('convierte DNS_SERVERS en una lista y rechaza lo que no sea una IP', () => {
    expect(validateEnv({ ...required, DNS_SERVERS: '1.1.1.1, 8.8.8.8' }).DNS_SERVERS).toEqual([
      '1.1.1.1',
      '8.8.8.8',
    ]);
    expect(() => validateEnv({ ...required, DNS_SERVERS: 'mi-router' })).toThrow(/DNS_SERVERS/);
  });

  it('acepta una URI de Atlas y rechaza una que no es de MongoDB', () => {
    const atlas = 'mongodb+srv://user:pass@cluster0.example.mongodb.net/';
    expect(validateEnv({ ...required, MONGODB_URI: atlas }).MONGODB_URI).toBe(atlas);
    expect(() => validateEnv({ ...required, MONGODB_URI: 'http://localhost:27017' })).toThrow(
      /MONGODB_URI/,
    );
  });
});
