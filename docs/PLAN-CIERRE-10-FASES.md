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

## Fase 2 — cobros, historial y recibos
Selector de obligaciones pendientes derivado de calendarios guardados y saldos confirmados; año configurable y filtro de historial por contrato. El servidor conserva la validación final de saldo. Comprobante PDF A4 descargable para pagos y gastos (registro interno, no factura fiscal); regeneración desde historial. El PDF usa fuentes estándar WinAnsi, sustituye caracteres no soportados. CSV protege celdas de texto contra fórmulas. Se requieren pruebas de navegador y revisión visual del PDF. La URL financiera continúa desactivada; el Worker QA previo no se ha actualizado con fase 2 y conserva acceso cerrado. Las pruebas de integración remota siguen pendientes de un Firebase de QA y administradores autorizados.

## Fase 3 — utilidades y cierre de caja
Base de caja (pagos recibidos menos gastos registrados), sin confundir utilidad de caja con utilidad fiscal. Ahorro y reparto configurables por cierre; división exacta en centavos, redondeo hacia abajo para ahorro y socio A, resto al socio B, pérdidas sin distribución. Cierre mensual inmutable anterior al mes actual; captura los totales en una sentencia SQL y bloquea movimientos nuevos fechados en períodos cerrados. Reintentos de registros ya existentes siguen admitidos. No mueve fondos ni contabiliza distribuciones como gastos; todavía no hay reapertura o ajustes compensatorios. Migración y API requieren QA; no activar en producción.

Panel fase 3: informe anual de los doce meses, ingresos por producto y empresa, gastos por categoría, exportación CSV, previsualización de ahorro y reparto y confirmación explícita de cierre. 20% de ahorro y 50/50 son valores iniciales editables, no órdenes de pago. Pendientes revisión visual, pruebas HTTP/UI con Firebase QA y confirmación de migración remota; no se publica en producción.

Evidencia D1 QA 28/11/2026: migración 0002 aplicada exclusivamente a la base identificada en fase 1. Octubre ficticio: 100001 centavos cobrados, 20000 gastados, política de 2000/5000 puntos base; cierre guardado. D1 rechazó un gasto retroactivo, editar y borrar el cierre. Se conservan exclusivamente marcadores ficticios por inmutabilidad. Además, el cierre exige que los totales aprobados coincidan con las sumas dentro de la escritura SQL; ante concurrencia responde 409. Worker QA permanece con despliegue previo y acceso cerrado; no habilitar la UI hasta validar autenticación y actualizar Worker de QA. Pruebas automatizadas nuevas pendientes de confirmación.
