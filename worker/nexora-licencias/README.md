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

## Validación y despliegue 20/11/2026 (UTC)

Cloudflare aceptó la carga multi-módulo de `src/index.js` y `src/auth.js` del repositorio. El servicio `nexora-licencias` tiene deployment `83be3cbd-38a8-42bf-89f6-c4918dfa0412` con el 100% de la versión `750e08f7-c8ee-4104-94c5-8ad4486950f8`. Se consultó después la configuración real: **0 bindings, 0 secretos, workers.dev y previews desactivados**. Los tres Workers de Lotigest siguen intactos.

La prueba de seguridad de GitHub Actions `44675909969` terminó `success`; aprobaron verificaciones de sintaxis de index/auth/frontend y tests de validación criptográfica de Firebase, permisos, expiración y bloqueo de cambios. No equivale todavía a prueba de conexión con Firebase o SIAC productivos.

## Pendientes de configuración externa

1. **Firebase:** conectar `nexora-control-717c6`, leer las identidades reales autorizadas, revisar reglas existentes, fusionar las reglas de clientes/licencias sin afectar colecciones previas y probar accesos como administradores y tercero denegado.
2. **Cloudflare:** establecer `NEXORA_ADMIN_UIDS` únicamente mediante secreto del Worker, con UIDs reales obtenidos de Firebase; no ponerlos ni escribir tokens en GitHub.
3. **SIAC:** conectar la cuenta Cloudflare que aloja la instalación de la clínica, aplicar las migraciones aprobadas a QA, preparar un endpoint mínimo de cambios autorizados con auditoría/idempotencia y validar cambios ficticios en D1 de pruebas.
4. Revisar el sitio y habilitar un origen de Worker público exclusivamente después de confirmar la verificación de Firebase. Las activaciones continuarán inhabilitadas hasta pasar la aceptación.
