# Plan de cierre comercial de Nexora Control

Mantener PR #2 abierto; no fusionar, publicar ni modificar datos reales. Cada fase exige commits y evidencia de pruebas; no confundir desarrollo con validación en infraestructura.

1. Infraestructura financiera: D1 aislada, autenticación, idempotencia y transacciones.
2. Cobros y mensualidades: saldos, vencimientos, abonos e historial, comprobante PDF.
3. Gastos y utilidades: cierres, ingresos por producto, ahorro y reparto configurable.
4. Gestión comercial: empresas, contratos, pruebas, renovaciones y condiciones negociadas.
5. Licencias: activación, renovación, suspensión, gracia y módulos.

**Auditoría 1:** fases 1–5, seguridad, permisos, exactitud, regresiones, UX. Corregir y repetir las pruebas antes de pasar a fase 6.

6. Vinculación de instalaciones existentes sin cambiar datos reales.
7. Aprovisionamiento automático aislado por producto.
8. Entrega segura de acceso y configuración por empresa ficticia.
9. Monitoreo, respaldos, alertas y recuperación.
10. Integración y preparación comercial en QA.

**Auditoría 2:** fases 1–10, flujo completo con empresas ficticias, aislamiento, permisos, respaldo/restauración, regresiones, revisión de dispositivos. Producción solo con autorización explícita.

Fase 1 iniciada: reintentos idempotentes de pagos/gastos con UUID por operación y comparación del contenido y autor. El identificador se conserva en memoria mientras los datos del formulario no cambien; no garantiza deduplicación tras cerrar o recargar la página. Pendiente persistencia segura del intento, conexión a D1 QA y pruebas de extremo a extremo con autenticación. El endpoint permanece deshabilitado en UI hasta validar QA. No se registran movimientos reales.

## Fase 1 — evidencia D1 física y reintento persistente
D1 exclusiva QA `nexora-finanzas-qa-20261128`, UUID `640fe8ee-d6a2-4c4c-b859-ac8f5b3d1416`. Migración 0001 aplicada y verificada: tres tablas y cinco disparadores. Partió con cero registros. Abono ficticio de 400 centavos a obligación de 1000: primer registro aceptado, reintento idéntico 0 cambios, sobreabono 700 rechazado, edición y eliminación rechazadas, saldo abonado final 400 y un solo pago. Se conserva el marcador ficticio como evidencia por inmutabilidad. No vincular a producción. UUID de operación guardado por huella SHA-256 en sessionStorage (mismo usuario, pestaña, endpoint y contenido); se borra tras confirmar recibo. No conserva campos ni tokens. No deduplica operaciones nuevas con otros datos o desde otra pestaña/dispositivo. Revisar historial si se desconoce el resultado antes de volver a registrar.

Worker `nexora-finanzas-qa-20261128` creado desde código del commit `1f3af3f`; módulos originales con rutas de importación aplanadas únicamente para multipart. Cloudflare confirmó carga, binding exclusivo NEXORA_FINANCE_DB al UUID de arriba, workers.dev y previews deshabilitados. No se configuraron administradores ni rutas públicas; no se habilitó finance-api-config.js. No conectar a calendarios reales: auth.js y calendarFor usan el proyecto Firebase existente. Pendiente QA de Firebase aislado con dos administradores autorizados, calendario ficticio, validación JWT real y flujo HTTP/UI completo antes de habilitar URL. No declarar fase 1 completamente aprobada hasta resolver esos requisitos. La D1 contiene exclusivamente el marcador de prueba mencionado.
