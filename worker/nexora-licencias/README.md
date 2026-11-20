# Nexora Licencias · Worker

Worker independiente llamado `nexora-licencias`, en la cuenta Cloudflare donde también está Lotigest, pero **sin compartir D1 ni permisos de datos clínicos**. GitHub Pages permanece como frontend y Firestore almacena los borradores comerciales.

## Estado seguro actual

- `GET /health` permite comprobar estado sin revelar información de clientes.
- `GET /api/session` verifica token Firebase de `nexora-control-717c6` y acceso a un UID autorizado **solo después** de configurar `NEXORA_ADMIN_UIDS` como secreto Cloudflare.
- Se validan firma RS256 con claves públicas Google, expiración, emisión, `aud`, `iss`, `sub`, inicio con Google, email verificado y dos correos previamente autorizados. `NEXORA_ADMIN_UIDS` añade una lista explícita de UID permitidos que no se configura en GitHub. Cualquier ausencia de configuración deniega por defecto.
- CORS permite solo `https://lotigest.github.io`, sin cookies. HTTP de licencia `/api/*` es **solo lectura de sesión**, sin operaciones de cambio; todas las rutas desconocidas devuelven HTTP 503.
- Sin D1, KV, secretos SIAC o almacenamiento de resultados médicos. La publicación `workers.dev` sigue desactivada hasta que se prueben Firebase/UID y las políticas correspondientes.

## Validación

`node --test worker/nexora-licencias/tests/*.test.mjs` desde la raíz del repositorio.

Antes de habilitar activación, necesitamos acceso autorizado al proyecto Firebase para confirmar UID de los dos administradores y publicar/revisar reglas Firestore; también acceso al Cloudflare de SIAC o despliegue del nuevo endpoint allí, credenciales mínimas seguras, idempotencia y auditoría. No inventar UIDs ni acceder a una base externa mediante tokens en un sitio público.

## Despliegue

Sincronizar `src/index.js` y `src/auth.js` mediante carga multi-módulo con `main_module: index.js`. Confirmar que el Worker no tenga bindings D1 y subdominio público permanezca desactivado. No sobrescribir ningún Worker de Lotigest.

El script recibe su primera carga directamente en Cloudflare; no existe un pipeline automático que dé acceso privilegiado a acciones de licencia.
