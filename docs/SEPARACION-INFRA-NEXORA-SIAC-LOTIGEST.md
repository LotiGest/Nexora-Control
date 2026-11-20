# Separación de infraestructura · Nexora Control / SIAC / Lotigest

**Estado:** plan técnico auditado, no una habilitación de producción.

## Identidades y almacenamiento

- **Nexora Control — interfaz:** el sitio estático puede continuar en GitHub Pages de `LotiGest/Nexora-Control`. La propiedad de un repositorio GitHub no determina qué base utiliza la aplicación.
- **Nexora Control — identidad y datos comerciales:** Firebase Auth + Firestore de `nexora-control-717c6`. Datos: nombres comerciales de clínicas, IDs técnicos, propuestas de licencias, estados y auditoría comercial. Nunca expedientes médicos, contraseñas, claves Cloudflare ni tokens D1.
- **SIAC — datos clínicos:** Worker y D1 propios de la instalación SIAC. El catálogo, las órdenes, resultados y vigencia efectiva de licencias solo residen en los recursos asignados a SIAC.
- **Lotigest:** Workers/D1 de Lotigest independientes. **Prohibido instalar el backend de licencias Nexora o su tabla de clientes comerciales dentro de las bases de Lotigest.**

## Backend Nexora independiente (pendiente de autorización)

1. Conectar una cuenta Cloudflare propia de Nexora Systems con permisos específicos de Workers y Access. La conexión Cloudflare disponible durante la auditoría corresponde a Lotigest, por lo que **NO se creó ningún Worker Nexora**.
2. Crear un Worker privado `nexora-licencias` en esa cuenta y aplicar Cloudflare Access + verificación de identidad Firebase; dos operadores autorizados y MFA. La autorización debe comprobarse en el servidor, no en JavaScript del navegador.
3. El Worker autentica y autoriza la solicitud de cambios, valida contrato/owner/plan/vencimiento, recibe una confirmación de acción explícita y genera auditoría con identificador de solicitud y versión para evitar reintentos duplicados.
4. Para aplicar una licencia a una cuenta Cloudflare diferente, usar una **API privilegiada específica en SIAC** con autenticación mutua, permisos mínimos, versión y auditoría de cambios. No se puede usar un binding D1 de otra cuenta como si fuera una base local. Nunca enviar un token global de Cloudflare a GitHub Pages, Firebase o al navegador.
5. SIAC responderá con el estado real confirmado, versión y marca temporal; Nexora Control lo mostrará como `Aplicada y verificada` únicamente cuando la respuesta validada provenga del servicio. El estado `Confirmada manualmente` del flujo actual **no significa una lectura real de SIAC**.
6. Para múltiples clínicas, identificar explícitamente la instalación y sus credenciales de servicio aisladas. No asumir multitenencia en el SIAC actual, que todavía utiliza un propietario predeterminado.

## Proceso de guardado actual

- Seleccionar clínica, plan y fecha solo cambia el formulario.
- Pulsar `Guardar propuesta` muestra revisión anterior/nueva y un checkbox obligatorio.
- Para activar Full, desactivar o cambiar una licencia anterior, la pantalla requiere escribir `CONFIRMAR`.
- Se compara la versión documental mediante transacción de Firestore antes de guardar; conflictos cancelan, no sobrescriben la decisión del otro administrador.
- Cancelar, cerrar el diálogo o cerrar sesión **no guarda** la operación.
- Guardar en Firestore no modifica D1; exportar SQL tampoco. Solo una activación privilegiada, verificada y auditada cambia la licencia real.

## Pasos de aceptación antes del uso

- Publicar y probar reglas de Firestore para clientes, licencias y auditoría; no reemplazar las reglas de soporte/credenciales preexistentes.
- Validar las dos identidades autorizadas, acceso rechazado a terceros, MFA y limpieza de datos al cerrar sesión.
- Probar plan Básico / Full / desactivado, fecha de vencimiento, historial clínico solo lectura, reintento, conflictos concurrentes, cancelación y verificación con una instalación SIAC de QA.
- Configurar respaldos y reversión; solo entonces permitir aplicación sobre producción.

**Consumo:** interfaz estática en GitHub Pages no consume Workers por visitar. Firestore sí consume lecturas/escrituras; el futuro Worker consumirá solicitudes y cualquier acceso D1 consumirá operaciones. Nunca prometer consumo cero.
