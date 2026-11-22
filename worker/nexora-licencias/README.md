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

## Validación de propuestas sin escritura (20/11/2026)

Nueva ruta `POST /api/licenses/preview`, disponible solamente cuando el Worker tenga un secreto `NEXORA_ADMIN_UIDS` y el Firebase ID token firmado corresponda a un administrador admitido. El servidor valida el ID de instalación, nivel, fecha e identificador de solicitud, devuelve el SHA-256 de la propuesta y el estado explícito `validated_not_applied`; **no conecta con Firebase Firestore, SIAC ni D1 y no aplica licencias reales**. Límite de cuerpo JSON: 4 KiB. Otras rutas de licencia responden 503. CORS restringido al origen de GitHub Pages, sin secretos para navegador.

## Verificación del estado real SIAC (sin escrituras)

La ruta protegida GET /api/licenses/status?ownerKey=... verifica el token Firebase del administrador, comprueba que la clínica solicitada coincide exactamente con NEXORA_SIAC_OWNER (configurado en el servidor) y llama a la ruta firmada GET /api/internal/nexora-license del SIAC. Esta ruta SOLO consulta y nunca activa, desactiva ni elimina licencias.

Requiere variables de entorno secretas: NEXORA_SIAC_OWNER, NEXORA_SIAC_STATUS_URL (HTTPS con ruta exacta), NEXORA_SIAC_SHARED_KEY (Base64URL 32 bytes), además de NEXORA_ADMIN_UIDS. No se han configurado en Cloudflare, por lo que esta API permanecerá inoperativa hasta probar los dos servicios con datos ficticios. El endpoint SIAC está actualmente en una rama de auditoría; todavía NO está publicado.


**Ambiente verificado explícitamente (20/11/2026):** la ruta de consulta de SIAC debe devolver `environment: 'qa'|'production'`. Nexora solo etiqueta un resultado como `siac_live` si el servidor informa `production`; las respuestas QA se identifican como `siac_qa` y el panel muestra que NO se verificó una licencia comercial real. Respuestas sin ambiente identificado se rechazan con HTTP 502. La configuración de los secretos sigue pendiente de autorización.

## Contrato SIAC firmado v1 — corrección del cliente (22/11/2026)

El servidor SIAC actual (PR #46/#47, `app/server/nexora-license-auth.ts`) requiere
**ECDSA P-256 / SHA-256**, clave pública autorizada y una firma vinculada al destino,
no el payload HMAC histórico descrito arriba. Esta rama de Nexora **no despliega ningún
Worker** ni cambia el frontend productivo.

El Worker de Nexora, sin exponer claves al navegador, firma exactamente estos siete campos,
unidos con `\n` y **sin salto final**:

```text
siac-license-v1
GET
https://<origen-del-SIAC-de-destino>
/api/internal/nexora-license
<identificador-de-clave>
<timestamp-Unix-en-segundos>
<nonce-UUID-v4>
```

Los encabezados son `x-nexora-key-id`, `x-nexora-timestamp`,
`x-nexora-nonce` y `x-nexora-signature` (hexadecimal minúsculo de 64 bytes crudos).
La clave privada solo permanece como secreto `NEXORA_SIAC_PRIVATE_JWK` del Worker Nexora.
Su ID se establece por separado como `NEXORA_SIAC_KEY_ID` (1–48 caracteres
ASCII alfanuméricos, guion o guion bajo).

En el Worker SIAC de QA se necesitan `SIAC_NEXORA_LICENSE_ORIGIN` (origen HTTPS
exacto), `SIAC_NEXORA_KEY_ID` (el mismo ID) y `SIAC_NEXORA_PUBLIC_JWK` (solo clave
pública). En el Worker Nexora deben configurarse `NEXORA_SIAC_OWNER`,
`NEXORA_SIAC_STATUS_URL`, `NEXORA_SIAC_PRIVATE_JWK`, `NEXORA_SIAC_KEY_ID`
y `NEXORA_SIAC_EXPECTED_ENVIRONMENT=qa`. El valor por defecto del entorno
esperado es `qa`; una respuesta `production` se rechaza en ese modo.
No configurar credenciales con texto en archivos públicos ni con GitHub Actions.

SIAC devuelve `owner`, `license`, `environment` y `readOnly`. **No devuelve
`readAt`**: Nexora asigna a `verifiedAt` el instante local de observación, no lo
hace pasar por una fecha firmada por SIAC. Las respuestas QA se muestran
como `siac_qa` y nunca confirman una activación comercial.

**Requisitos antes de una prueba real:** asegurar que la URL destino permita
peticiones servidor-a-servidor firmadas sin eludir Cloudflare Access, disponer
de claves y key ID de QA válidos, verificar las cuentas Firebase de
administradores, y comprobar el resultado remoto con categorías de error
sanitizadas. El Worker de Nexora sigue sin rutas de escritura de licencias.
La migración `0027_vendor_license_nonces.sql` ya fue aplicada y comprobada en
la D1 `siac-pr41-qa`; no volver a aplicarla sin revisar el historial. Ninguno de
estos pasos autoriza producción o cambios de licencias reales.

### Cloudflare Access en Staging

El destino `siac-staging.nexorasystems.workers.dev` exige `qa` y ambos secretos del Worker Nexora: `NEXORA_SIAC_ACCESS_CLIENT_ID` y `NEXORA_SIAC_ACCESS_CLIENT_SECRET`. Corresponden a un token de servicio de QA admitido por una política **Service Auth** del destino autorizado. El Worker usa los encabezados oficiales `CF-Access-Client-Id` y `CF-Access-Client-Secret`, además de la firma ECDSA, y rechaza cualquier redirección. El cliente Firebase y GitHub Pages no reciben esos encabezados. Mantener el token limitado a la ruta de consulta, con vigencia acotada y revocación independiente de la clave ECDSA.

Para la comprobación local completa: `node --test tests/licenses.test.mjs worker/nexora-licencias/tests/*.test.mjs`. La suite HTTP externa `tests/siac-live-qa.test.mjs` comprueba el Worker histórico `siac-license-qa` sin autenticar. La aceptación del canal actual requiere una prueba firmada con destino al Worker Staging protegido y una identidad Firebase de QA permitida por UID del servidor.

### Estado de esta ronda

- El contrato se comprobó con el cliente Nexora y el Worker SIAC compilado en Miniflare. El recorrido aislado devolvió HTTP 200 con `siac_qa`. Reintentos con la misma firma, claves incorrectas o retiradas y solicitudes vencidas devolvieron HTTP 401. La fila de licencia se conservó.
- En Cloudflare, `siac-staging` continúa en `05135b5`, protegido por Access. La D1 dedicada contiene la tabla y el índice de la migración 0027. La ruta de licencias no tiene claves de firma habilitadas en ese Worker.
- Queda pendiente conectar la cuenta de Cloudflare que aloja `nexora-licencias` y disponer de un Worker Nexora aislado, un token de servicio QA autorizado para la ruta de estado, claves ECDSA de QA y un UID administrativo de prueba comprobado en Firebase. La configuración pública del panel sigue vacía. No se abrió acceso a los Workers ni se modificaron Firebase, Firestore, Lotigest o producción.
