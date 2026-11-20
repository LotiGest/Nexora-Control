# Nexora Control ↔ SIAC: informe QA de seguridad

Fecha de comprobación: 20/11/2026. Este informe documenta observaciones de Cloudflare y GitHub Actions, **no certifica una activación de licencias en producción**.

## Confirmado en Cloudflare

- Cuenta **GjTorres**: los Workers `siac`, `siac-staging` y `siac-license-qa` están separados.
- `siac-license-qa` tiene solamente `DB` -> D1 `siac-test-isolated` y un secreto `SIAC_NEXORA_LICENSE_KEY`. Su acceso workers.dev está habilitado, las vistas previas están deshabilitadas y no tiene funciones para escribir licencias. La consulta privada exige HMAC.
- D1 `siac-test-isolated`: existen las tablas `siac_clinic_module_licenses` y `siac_clinic_module_license_events`. Se insertó únicamente un registro sintético, se ensayó el cambio Básico -> Full y un evento de auditoría, y se eliminaron ambos. Revisión final: **0 licencias y 0 eventos** en las tablas.
- D1 **siac-db producción**: no contiene esas dos tablas, y el Worker `siac` conservaba su última publicación del 17/11/2026. No se modificó.
- Cuenta **Lotigest/Nexora**: `nexora-licencias` está desplegado, con workers.dev **desactivado**. Conserva las variables privadas `NEXORA_SIAC_OWNER` y `NEXORA_SIAC_STATUS_URL` (no se leyeron ni publicaron sus valores). **No** tiene aún `NEXORA_ADMIN_UIDS` ni `NEXORA_SIAC_SHARED_KEY` configurados.
- Por seguridad, una solicitud del panel de Nexora a la API de licencias continúa cerrada. La interfaz muestra la consulta de SIAC deshabilitada hasta que esté aprobado el canal.

## Pruebas y correcciones

- La prueba externa de GitHub Actions `44779859102` terminó **success**:
  - `GET /health` de SIAC QA funciona sin exponer datos clínicos.
  - Las consultas privadas sin credenciales son rechazadas.
  - El método POST devuelve 405 y las rutas desconocidas devuelven 404.
- El parser de respuesta distingue `environment=qa` de `environment=production`; una respuesta de QA **nunca** figura como activación comercial comprobada.
- Se corrigió la incompatibilidad en Cloudflare de `redirect:'error'` a `redirect:'manual'` con rechazo explícito de códigos 3xx. Las pruebas de seguridad de Nexora para esa corrección terminaron **success** en GitHub Actions `44779222712`.
- La nueva versión `nexora-licencias` fue subida a Cloudflare conservando sus bindings de tipo `secret_text`, sin tocar los Workers de Lotigest.

## Bloqueos actuales

1. El secreto HMAC generado o guardado en **GjTorres / siac-license-qa** no se puede leer de nuevo desde Cloudflare. La transferencia automatizada de ese secreto entre las dos cuentas fue bloqueada por los controles de seguridad. **No se debe copiar desde ChatGPT ni colocar en GitHub**. Para enlazar las cuentas, el operador debe generar una nueva clave de 32 bytes Base64URL, y configurar el mismo valor directamente en Cloudflare: `SIAC_NEXORA_LICENSE_KEY` en `siac-license-qa` (reemplazando el actual) y `NEXORA_SIAC_SHARED_KEY` en `nexora-licencias`.
2. Firebase `nexora-control-717c6`: todavía falta auditar/publicar las reglas existentes y determinar los UID reales de los dos administradores. Configurar `NEXORA_ADMIN_UIDS` únicamente en los secretos del Worker, luego de verificarlos con Firebase. **Nunca** aceptar UIDs/roles propuestos por el navegador.
3. Probar el HMAC firmado extremo a extremo desde Nexora hacia SIAC QA con ambos secretos instalados y el Worker de Nexora autenticado. Sin eso no declarar la integración completa.
4. El código de ruta privada en el SIAC integrado permanece en la rama `audit/clinic-readiness-2026-11-16`; los workflows de compilación de SIAC fallaron antes de ejecutar pasos (runner no asignado), por lo que no se puede publicar en producción hasta validarlos.
5. La activación automática de licencias reales no está desarrollada. Requiere API exclusiva de escritura autenticada, idempotencia, validación de versión, auditoría atómica, respaldo y QA antes del despliegue.

## Checklist de cierre

- [x] DB de QA aislada con tablas comerciales.
- [x] Escritura y auditoría con registros sintéticos, posterior limpieza.
- [x] Worker de QA desplegado y accesos no autenticados rechazados mediante prueba HTTP externa.
- [x] Worker Nexora actualizado con bloqueo de redirecciones, respuestas QA identificadas, sin rutas de activación.
- [x] Base clínica de producción y sus Workers intactos.
- [ ] Secreto HMAC compartido entre cuentas, configurado por el operador en Cloudflare.
- [ ] Firebase: reglas publicadas y UIDs verificados.
- [ ] Consulta autenticada y firmada desde Nexora hacia QA.
- [ ] Compilación y pruebas de SIAC integrado.
- [ ] Activación automática QA y luego publicación controlada de producción.

## Actualización del 20/11/2026: canal asimétrico entre cuentas

Para no transferir una contraseña entre dos conexiones Cloudflare, se sustituyó el protocolo HMAC de QA por **ECDSA P-256 / SHA-256**:

- Se generó el par de claves en la cuenta Cloudflare de Nexora; la privada se guardó directamente como secreto `NEXORA_SIAC_PRIVATE_JWK` de `nexora-licencias`. Nunca se mostró ni transfirió su valor.
- Solo la clave **pública** se configuró como `SIAC_NEXORA_PUBLIC_JWK` en `siac-license-qa` (cuenta GjTorres).
- El QA Worker se actualizó para verificar firmas P-256 y continuar con su único binding D1 `siac-test-isolated`.
- Se eliminó la clave HMAC anterior del Worker QA. El endpoint integrado de SIAC, aún **solo en la rama de auditoría**, también quedó adaptado a P-256.
- Las pruebas unitarias de Nexora para firma ECDSA, redirecciones, validación de respuestas y separación QA/producción pasaron en GitHub Actions (`44781473062`).
- Se abrió brevemente un diagnóstico que solo devolvía si la consulta QA verificó. **El acceso público del Worker Nexora volvió a deshabilitarse y su código normal se restauró.** Se borró el workflow temporal.
- El diagnóstico desde GitHub Actions verificó que el Worker de Nexora puede consultar el `GET /health` de SIAC QA (HTTP 200). La petición **firmada de licencia devolvió HTTP 503**. La consulta SQL directa a la D1 aislada funciona, pero todavía no está identificado el motivo del 503 en la ruta Worker. **No afirmar que la comunicación firmada quedó validada**.
- No se ha configurado `NEXORA_ADMIN_UIDS`; no se han desplegado reglas Firestore; no hay operaciones de activación y SIAC producción permanece inalterado.

**Pendiente inmediato:** investigar el 503 mediante observabilidad de Cloudflare y pruebas autorizadas con respuestas de error sanitizadas, confirmar E2E firmado en QA, publicar/verificar las reglas de Firebase con el conector administrativo, y solo entonces decidir la implementación de activación real con auditoría e idempotencia. No crear ni habilitar un acceso público de administración de licencias para solucionar el error.
