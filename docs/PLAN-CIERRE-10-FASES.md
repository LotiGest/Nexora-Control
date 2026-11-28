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

Continuación fase 3: el informe de movimientos y saldos usa un batch de lecturas consistente en D1; se actualiza el panel de cierres después de guardar y después de conflictos. Se añadió prueba de integración de rutas HTTP con SQLite transaccional, dos administradores ficticios e inyección de autenticación/calendario; no equivale a autenticación real ni HTTP remoto. No se cambia producción.

## Fase 4 — gestión comercial
Se conserva el catálogo, fichas empresariales y contratos versionados existentes. Se agrega comparación de descuentos únicamente frente a la misma versión de tarifa y periodicidad; aviso de calendario congelado y propuesta de renovación versionada, con retirada explícita, fecha futura, revisión de contrato y calendario y reglas de acceso. No renueva automáticamente ni cambia obligaciones anteriores: aplicación efectiva de nuevos términos requiere un modelo de calendario por vigencia y validación de licencias. Reglas solo en archivo de propuesta y emulador, no desplegadas a Firebase real.

Directorio empresarial con búsqueda por nombre comercial/legal, RTN, contacto e ID, filtros por producto y preparación. La lectura de renovación no bloquea catálogo ni edición de contratos anteriores cuando sus permisos no están habilitados; las renovaciones sí exigen confirmación de todas sus fuentes. Nuevas pruebas de reglas para acceso, retiro, revisiones y protección del calendario. Pendiente CI y pruebas de navegador.

Continuación fase 4: historial de tarifas, contratos y propuestas de renovación consultado exclusivamente desde servidor, paginado de 20 revisiones, con comparación de conceptos y autor/fecha. Lecturas descartadas al cambiar sesión; no hay edición ni eliminación de revisiones. Pruebas del commit ea7739f aprobadas; nuevas pruebas pendientes.

Vista previa de renovación: compara doce meses desde fecha propuesta, calendario anterior contra condiciones nuevas, sin repetir automáticamente instalación inicial; supone inicio de nuevos ciclos en fecha propuesta únicamente para simulación. No emite identificadores ni reemplaza obligaciones. La activación de una renovación sigue bloqueada hasta diseñar coordinación transaccional con D1 (incluyendo anticipos, obligaciones ya materializadas y cambio de vigencia) y licencias. No se toca producción.

## Fase 5 — licencias comerciales
Nuevo modelo versionado separado de las licencias operativas SIAC existentes. Emisión desde acuerdo y calendario coincidentes, vigencia civil inclusiva, gracia 0–30 días, suspensión, reactivación y extensión de vencimiento sin sustituir módulos. Las condiciones se congelan; cambios de tarifa requieren revisar acuerdo y calendario. Todas las acciones requieren motivo y revisión inmutable. No es un token de acceso ni modifica instalaciones: aplicación remota sigue pendiente de adaptadores específicos de SIAC, SINDEX y LotiGest y QA de autenticación. Las reglas son propuestas para emulador, no desplegadas.

Panel de contratos: emisión, renovación de vigencia, suspensión/reactivación, estado por fechas, módulos comerciales y acceso al historial. Escrituras transaccionales con revisión de contrato/calendario y versión; suscripción independiente, sin bloquear catálogo si no está disponible. Pruebas unitarias y emulador de permisos añadidas. No aplica licencias operativas.

Refuerzo fase 5: licencia suspendida y vencida puede extender vigencia sin quitar suspensión; reactivar sigue siendo un paso separado, exige vigencia/gracia y acuerdo coincidente. Comparación de líneas normalizadas evita falsos conflictos por orden de propiedades en Firestore. Pruebas nuevas pendientes.

## Auditoría 1 — inicio
Baseline 8771733: workflow 46138607294 completado, 103/103 pruebas comerciales y 4/4 de emulador, cero fallos, omitidos o cancelados. Hallazgo: reglas relacionadas verificaban estado anterior de documentos, no el estado final de una escritura atómica; se cambió a getAfter en acuerdos/calendarios y se refuerza vínculo revisión/cabecera. Reanudar/renovar licencia exige ahora coincidencia de identidad, versión y conceptos en ambas fuentes. Pruebas añadidas, pendientes de confirmación. Sin publicación real.

Auditoría financiera: cuerpo JSON limitado a 4096 bytes mediante lectura por streaming y validación de tipo; se rechazan fechas futuras en movimientos de caja conforme al día civil hondureño. No limita fechas de vencimiento ni anticipos recibidos hoy. Pruebas HTTP de rechazo añadidas. Worker QA requiere nueva carga (incluye módulo proposal.js) tras validar el commit. No se activa acceso público.

Auditoría de integridad: el Worker rechaza calendarios con identidad/producto inconsistente, conceptos repetidos, líneas incompatibles o fechas invertidas. La escritura de un abono exige que la obligación materializada coincida en producto, vencimiento, tipo e importe con el calendario; en discrepancia devuelve 409 sin registrar el abono. Se añadió regresión SQL/HTTP. QA remoto continúa bloqueado por autenticación y calendario ficticio aislado.

Auditoría de aislamiento: Finanzas exige NEXORA_ENVIRONMENT=qa y NEXORA_FIREBASE_PROJECT_ID independiente del Firebase productivo. El proyecto validado en el JWT debe coincidir exactamente con el usado para consultar calendarios. No existe fallback a producción en Finanzas; el Worker original de licencias conserva su modo anterior. Configuración QA deliberadamente incompleta hasta disponer de proyecto Firebase real y UID de administradores. Pruebas de tokens firmados simulados y rechazo de configuración productiva añadidas; no equivale a autenticación Google real. No se publica ni se cambia Grupo H.

## Preparación fase 8 (sin superar puertas de auditoría ni fases 6/7)
Generador QA puro de paquete de entrega LotiGest: verifica identidad ficticia, D1 no protegida, origen autorizado, versión, evidencia del producto completo, marca, aislamiento, invitación de un solo uso, licencia vigente y aprobación de auditoría. El resultado es revisión manual, no activación. Excluye credenciales y tokens; la invitación se entrega por canal separado. Evidencias son entradas del adaptador de servidor futuro, no autorizaciones confiables suministradas por navegador. Fases 6 y 7 y auditoría 1 permanecen pendientes de aceptación; no se crean instalaciones ni se entrega acceso.

## Preparación fase 9 — monitoreo y mantenimiento
Motor de alertas comerciales (licencias, pruebas y renovaciones), evaluación de evidencias de respaldo/restauración y umbral de consumo 75% sobre métricas y límites suministrados por servidor. Sonda HTTP de solo lectura para registros QA autorizados, identidad, alcance y versión; distingue harness de autenticación del producto completo. Sin redirecciones, timeout y máximo 4 KiB. No utiliza credenciales ni registra contenido de respuestas. No se ha conectado a un registro real ni a métricas Cloudflare; no programa respaldos ni alertas en segundo plano. Fases 6/7 y auditoría todavía abiertas.

Panel de Proyectos: alertas administrativas en vivo desde cinco colecciones comerciales, solo si todas las fuentes están confirmadas por servidor. Desconexión y cierre de sesión limpian suscripciones/datos. El estado de infraestructura, consumo y respaldos se muestra explícitamente sin verificar hasta conectar adaptadores autorizados; no se presenta un estado verde ficticio. No se modifica infraestructura ni se publica.
