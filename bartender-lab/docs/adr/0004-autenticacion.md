# ADR-0004: JWT de acceso corto + refresh tokens opacos rotados

**Estado:** aceptada · **Fase:** 3

## Decisión

- **Access token:** JWT HS256 de 15 minutos (`JWT_ACCESS_TTL_SECONDS`) con `sub` y `role`, más
  `iss`/`aud` fijos, que se verifican. El secreto debe tener ≥ 32 caracteres; en producción se
  rechaza el valor de ejemplo.
- **Refresh token:** valor opaco de 256 bits. Solo se guarda su SHA-256 (`refresh_tokens.token_hash`).
  Dura 30 días (`REFRESH_TOKEN_TTL_DAYS`) y es de **un solo uso**: cada `POST /auth/refresh` lo
  revoca con una actualización condicional atómica y emite otro de la misma familia.
- **Detección de reutilización:** presentar un refresh token ya revocado revoca **toda su familia**.
  Si un atacante roba un token y lo usa después que el usuario legítimo, o al revés, ambos pierden
  la sesión.
- **Logout:** revoca la familia.
- **Rol:** el guard global relee de la base el usuario y su rol en cada petición autenticada. Una
  degradación de rol o un usuario borrado surten efecto de inmediato, sin esperar a que caduque el
  JWT.
- **Rutas públicas:** el contenido es `@Public()`. Si llega un token inválido o caducado a una ruta
  pública, se ignora (una app offline puede tener tokens viejos); en una ruta privada responde 401.

## Consecuencias

- La app móvil debe **serializar** las llamadas a `/auth/refresh` (una sola en vuelo). Dos
  refrescos simultáneos con el mismo token se interpretan como reutilización y cierran la sesión.
  Es una regla explícita para la Fase 8.
- Los tokens se guardarán en `expo-secure-store`, nunca en SQLite.
- Una consulta extra por petición autenticada (búsqueda por clave primaria) a cambio de una
  autorización siempre actualizada.
