# PlayBook Pro

Plataforma web para que un coach de fútbol americano diseñe, anime y enseñe sus jugadas.

## Estructura

| Carpeta  | Qué contiene                                                      |
| -------- | ----------------------------------------------------------------- |
| `server` | Backend NestJS (MongoDB con Mongoose)                             |
| `client` | Frontend React + Vite + Tailwind                                  |
| `shared` | Código común: esquema Zod del diagram, enums, ids UUIDv7, medidas |

## Requisitos

- Node 22 o superior (`.nvmrc`)
- npm (viene incluido con Node)
- Docker, para MongoDB en local

## Arrancar en local

```bash
npm install
cp server/.env.example server/.env
docker compose up -d mongo   # MongoDB 7 como replica set
npm run dev                     # api en :3000 y web en :5173
```

Abre http://localhost:5173, crea tu cuenta y tu equipo, y empieza a armar playbooks.

## Comandos

| Comando             | Qué hace                              |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Levanta api y web en modo desarrollo  |
| `npm run build`     | Compila todo                          |
| `npm test`          | Tests unitarios de todos los paquetes |
| `npm run lint`      | Lint (oxlint; prohíbe `any`)          |
| `npm run typecheck` | Comprobación de tipos                 |
| `npm run format`    | Formatea con Prettier                 |

## Probar la API

Con `npm run dev` en marcha, abre http://localhost:3000/api/docs (Swagger). Desde ahí puedes
registrarte (`POST /api/auth/register`), copiar el `accessToken` de la respuesta, pulsar
**Authorize** y llamar a `GET /api/auth/me`.
