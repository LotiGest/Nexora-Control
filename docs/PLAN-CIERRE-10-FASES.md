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
