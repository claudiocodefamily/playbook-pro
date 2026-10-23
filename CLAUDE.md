# PlayBook Pro: reglas del proyecto

Plataforma para que coaches de fútbol americano diseñen, animen y enseñen jugadas.
El plan vigente de la Fase 1 está en `docs/plan-fase1.md`.

## Comunicación

- Responde siempre en español.
- El dueño del proyecto es jugador, no desarrollador experto: explica cada decisión técnica en pocas frases y con el porqué.
- Usa la terminología de fútbol americano en inglés (LOS, snap, Cover 2, slant...) y explícala en español la primera vez.
- Si algo pedido no es buena idea, dilo y propón una alternativa.
- Trabajamos por fases y bloques. Antes de programar algo grande, propone un plan corto y espera el OK.
- Al generar archivos, indica la ruta exacta dentro del monorepo.

## Stack

- Monorepo npm workspaces + Turborepo: `server` (NestJS 12, ESM), `client` (React 19 + Vite + Tailwind 4), `shared` (`@playbook/shared`).
- Las dependencias se gestionan con npm (no pnpm ni yarn). Para añadir una a un paquete: `npm install <paquete> -w server` (o `client`, `shared`).
- MongoDB con Mongoose (`@nestjs/mongoose`). Atlas en la nube; `mongo:7` como replica set `rs0` en local (`docker-compose.yml`).
- Tests con Vitest en todos los paquetes (+ mongodb-memory-server con `MongoMemoryReplSet` para la API).
- Lint con oxlint, formato con Prettier.

## Reglas de código

- Nada de `any` (oxlint lo marca como error). TypeScript estricto.
- La API es ESM: los imports relativos llevan extensión `.js`.
- Un módulo NestJS = una responsabilidad: `module`, `controller`, `service`, `schemas/`, `dto/` y tests en `server/src/modules/<nombre>/`.
- Cada endpoint tiene DTO validado (class-validator) y está documentado en Swagger.
- **Aislamiento por equipo:** rutas anidadas `/api/teams/:teamId/...`, protegidas por `JwtAuthGuard` → `TeamAccessGuard`. Todos los services reciben `teamId` y filtran por él. `teamId` va primero en los índices compuestos.
- **Roles:** `COACH` y `PLAYER`. Un equipo puede tener varios coaches, todos con los mismos permisos. Los jugadores entran con una invitación del coach y solo leen: `TeamAccessGuard` les da 403 salvo en las rutas marcadas con `@AllowPlayers()`, y esas rutas filtran por `visibleToPlayers` con `@Membership()`. Una ruta nueva nace cerrada a jugadores.
- **Ids:** todos son UUIDv7 guardados como string (`_id`, referencias e ids internos del diagram). Se generan con `newId()` de `@playbook/shared` y se validan con `UuidSchema`. Nunca uses un UUID como secreto: los tokens se generan con `crypto.randomBytes` y se guardan como hash.
- Nunca guardes credenciales en el código. Las variables de entorno se validan con Zod en `server/src/config/env.schema.ts`.
- En Mongo nunca se guardan imágenes ni binarios (las fotos van a Cloudinary; solo se guarda la URL).
- `timestamps: true` en todos los schemas; borrado lógico (`deletedAt`) en plays y playbooks.

## Diagram de la jugada

- Esquema único en `shared/src/diagram/diagram.schema.ts` (Zod). Mongoose lo guarda como objeto libre; no lo dupliques con `@Prop`.
- Coordenadas en yardas: `y = 0` es la LOS (negativo hacia el backfield ofensivo); `x` desde el centro del campo (±26.67). Tiempo en segundos con el snap en `t = 0`.
- Si cambia el esquema: sube `DIAGRAM_SCHEMA_VERSION`, añade la migración en `migrations.ts` y su test. Usa la skill `cambio-de-esquema-diagram`.

## Antes de dar algo por terminado

```bash
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
```
