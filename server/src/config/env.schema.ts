import { z } from 'zod';

/**
 * Variables de entorno de la API. Se validan al arrancar: si falta alguna o tiene
 * un valor incorrecto, la API no arranca y el error dice cuál es.
 */
export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    WEB_ORIGIN: z.url().default('http://localhost:5173'),
    MONGODB_URI: z
      .string({ error: 'falta la URI de MongoDB' })
      .regex(/^mongodb(\+srv)?:\/\//, 'debe empezar por mongodb:// o mongodb+srv://'),
    // Nombre de la base de datos. Va aparte de la URI para que nunca se use por descuido
    // la base "test", que es la que elige Mongo cuando la URI no trae nombre.
    MONGODB_DB_NAME: z.string().min(1).default('playbookpro'),
    // Opcional. Servidores DNS separados por comas (p. ej. "1.1.1.1,8.8.8.8"). Solo hace falta si
    // Node no logra resolver la dirección mongodb+srv de Atlas (error "querySrv ECONNREFUSED").
    DNS_SERVERS: z
      .string()
      .transform((value) => value.split(',').map((server) => server.trim()))
      .pipe(z.array(z.union([z.ipv4(), z.ipv6()])).min(1))
      .optional(),
    // Firma los access tokens. Quien lo conozca puede entrar como cualquier coach.
    JWT_ACCESS_SECRET: z
      .string({ error: 'falta el secreto para firmar los tokens' })
      .min(32, 'debe tener al menos 32 caracteres aleatorios'),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    // Opcionales: las tres juntas activan la subida de fotos a Cloudinary (panel de
    // Cloudinary → Settings → API Keys). Sin ellas, las fotos se ponen pegando su URL.
    CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
    CLOUDINARY_API_KEY: z.string().min(1).optional(),
    CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  })
  .refine(
    (env) => {
      const set = [env.CLOUDINARY_CLOUD_NAME, env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET];
      return set.every((value) => value === undefined) || set.every((value) => value !== undefined);
    },
    {
      message: 'Cloudinary necesita las tres variables juntas: CLOUD_NAME, API_KEY y API_SECRET',
      path: ['CLOUDINARY_API_SECRET'],
    },
  );

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
