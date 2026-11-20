# nexora-licencias · Worker de Nexora Systems

Este Worker es un **esqueleto seguro** de backend comercial: por ahora no puede activar, revocar ni leer licencias de SIAC. El despliegue inicial tiene únicamente `GET /health` (indicador sin información privada) y responde 503 a **todas** las solicitudes `/api/*`.

- Proyecto: `LotiGest/Nexora-Control` en GitHub (la cuenta GitHub no determina la base de datos Cloudflare).
- Worker: `nexora-licencias` independiente de `lotigest-d`, `lotigest-demo` y `lotigest-qa-20261119`.
- En la cuenta Cloudflare actual de Lotigest se comparten facturación, cuotas y permisos generales de la cuenta. No es aislamiento de cuentas.
- **Sin bindings D1, KV, R2 ni secretos**. No modifica ni comparte datos con las bases de Lotigest.
- La lista comercial de clientes y propuestas continúa en el proyecto Firebase propio de Nexora Control, protegido por reglas de Firestore pendientes de aplicar.
- La fuente de verdad de licencias operativas se mantiene en la D1 de SIAC correspondiente.

## Antes de habilitar activaciones

1. Obtener y verificar la autenticación del administrador Nexora en el servidor (Firebase ID token validado contra el proyecto e identidad autorizados, nunca solo un correo enviado en JSON).
2. Configurar el aislamiento por instalación SIAC, ruta de conexión a SIAC con credenciales de servicio mínimas, almacenamiento de secretos dentro de Workers y control estricto de CORS.
3. Implementar una operación de preparación (sin efectos) y una de aplicación con confirmación explícita, anti-CSRF si hay cookies, IDs idempotentes, condición de versión y bitácora inmutable.
4. Comprobar por API el estado real de SIAC después de aplicar y devolverlo a Nexora Control. No aceptar una marca manual como prueba de sincronización real.
5. Ensayar con datos ficticios en QA (básico/full/off, expiración, concurrencia, roles, errores, reintentos), obtener respaldo y aprobación antes de tocar producción.

## Comprobación local

`node --test worker/nexora-licencias/tests/worker.test.mjs`

No desplegar sobre los Workers de Lotigest, ni conectar la base D1 de Lotigest por comodidad. Cuando se necesite aislamiento contractual/de costes estricto, migrar el Worker a la cuenta Cloudflare propia de Nexora.
