# Nexora Control — Clientes y licencias de SIAC

Estado del código: sección integrada en `index.html`, estilos `licenses.css`, controlador `licenses.js` y validador `license-core.js`. Interfaz protegida por el login Google existente; registros sincronizados en Firestore **solo cuando sus reglas estén correctamente publicadas**.

## Qué permite hoy

1. Abrí [Nexora Control](https://lotigest.github.io/Nexora-Control/) e ingresá con una de las dos cuentas de administración ya autorizadas.
2. En el menú, abrí **Clientes y licencias**; registrá una clínica con nombre comercial e identificador de instalación SIAC. Para la instalación de pruebas actual el ID técnico conocido es `siac-clinic-default`.
3. Elegí Laboratorio **Desactivado**, **Básico** o **Full**, fecha de vencimiento opcional y una referencia interna de contrato. Guardá la **propuesta**: se sincroniza con el otro administrador desde Firestore.
4. **Copiar SQL para revisión** prepara una transacción con auditoría para el D1 de SIAC. **No ejecuta nada ni desbloquea Premium**. La migración `0011_clinic_module_licenses.sql` de SIAC debe existir primero en la instancia específica.
5. Solo después de comprobar de forma independiente la aplicación real en la D1 correcta, introducí una referencia verificable y marcá **Aplicación confirmada manualmente**. Es una declaración auditada, no una verificación automática del sistema.

**Importante:** todavía no existe una API privilegiada desplegada para conectar GitHub Pages con la D1 de las clínicas. No se almacena ningún token Cloudflare en el frontend. Activación automática real desde el panel queda como segunda fase: servicio Nexora autenticado, autorización del operador, conector aislado por instalación, confirmación y auditoría en D1. La instancia SIAC actual sigue utilizando un owner fijo y NO permite manejar muchas clínicas desde un solo despliegue.

## Firestore — paso obligatorio antes de usar datos reales

El frontend está en un repositorio público, por lo tanto **ocultar la aplicación tras login no es protección suficiente**. El administrador de Firebase debe fusionar `docs/firestore-licenses-snippet.rules` dentro de las reglas ya existentes de `nexora-control-717c6` y publicar las reglas en la consola de Firebase. Es un **fragmento** de reglas, NO un archivo sustituto. No sobrescribas las reglas actuales de `supportReports` ni `vaultReferences`.

Las nuevas colecciones son `nexoraClients`, `nexoraLicenses` y `nexoraLicenseEvents`. Todas las lecturas y escrituras deben requerir Google Firebase Auth con correo verificado y una identidad Nexora autorizada; el servidor Firestore valida tipo de plan, formato e ID de instalación. Los eventos son solo append (sin ediciones ni borrados). También es recomendable fortalecer más adelante el acceso mediante una lista de UID en la infraestructura del servidor, no por una lista de correos distribuida en una web pública.

**Pruebas manuales obligatorias de reglas:** (a) consulta y creación desde ambas cuentas autorizadas; (b) rechazo en usuario Google tercero; (c) rechazo sin sesión; (d) impedir borrado de eventos y alterar otro documento; (e) comprobar que las colecciones anteriores continúan protegidas; (f) confirmar que al cerrar sesión se limpian datos del DOM. Evitá registrar contactos, datos médicos, contraseñas, tokens, cuentas bancarias o credenciales de clientes.

Si Firestore devuelve `permission-denied`, no lo resuelvas poniendo las reglas en modo público; revisá el fragmento y las pruebas en un entorno de desarrollo.

## Pruebas de software

La lógica independiente se puede verificar con `node --test tests/licenses.test.mjs`. Requiere revisión real en navegador, prueba de ambos usuarios, Google popup/redirect, Firestore y modo móvil. Ningún resultado que diga **«Aplicación confirmada manualmente»** debe confundirse con consulta en tiempo real al SIAC; solo Cloudflare D1 es la fuente de verdad de la licencia.

**No se activaron planes Full ni se modificaron servidores SIAC o bases de producción mediante esta implementación.**
