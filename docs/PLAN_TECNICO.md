# Nexora Control — Plan técnico inicial

Aplicación web progresiva (PWA) privada para Gerardo Torres y Dani López. Productos iniciales: SIAC, SINDEX, Dvolada y Lotigest.

## Módulos
1. Inicio: indicadores, próximos cobros y avisos.
2. Productos: nombre, versión, estado, enlaces a repositorio y despliegue.
3. Cuentas: inventario de Google, GitHub, Cloudflare y paneles administrativos por producto; nunca registrar secretos en el código.
4. Clientes: datos de contacto, producto contratado y contrato.
5. Planes/licencias: precios pactados, periodicidad, fechas de inicio y condiciones.
6. Cobros: vencimientos, abonos, recibos, historial y estados.
7. Auditoría: cambios críticos y accesos a registros sensibles, sin registrar contraseñas.

## Arquitectura prevista
- Frontend PWA estático en GitHub Pages (el sitio publicado NO es privado por estar en un repositorio privado).
- Autenticación independiente para los dos administradores; invitación cerrada, MFA y políticas de autorización por registro.
- Base de datos sincronizada en un proveedor con plan gratuito, por configurar.
- La bóveda de secretos requiere diseño y revisión de seguridad separados: cifrado del lado cliente, claves nunca almacenadas en el repositorio, recuperación y respaldos cifrados. No activar almacenamiento de contraseñas reales hasta verificar la implementación.
- Service worker: almacenar solamente archivos estáticos; no cachear secretos ni respuestas autenticadas.
- Sincronización de cambios y controles para conflictos entre usuarios.
- No incluir llaves de servicio, contraseñas ni datos reales de clientes en GitHub o GitHub Actions.

## Etapas
1. Interfaz y estructura de datos con ejemplos ficticios.
2. Autenticación, autorización y auditoría.
3. Productos, clientes, planes, cobros y reportes.
4. Bóveda cifrada, pruebas de seguridad y recuperación.
5. Pruebas de PWA en dos dispositivos y publicación.

## Requisitos de aceptación
- Gerardo y Dani entran con cuentas independientes.
- Una cuenta no autorizada no puede leer datos aunque conozca la URL.
- Datos y cambios se sincronizan entre ambos usuarios.
- No se envían contraseñas sin cifrar al servidor.
- Copias de seguridad y restauración comprobadas.
- Cobros y fechas se calculan conforme al contrato individual.
- No hay despliegue automático ni gasto de Actions innecesario hasta aprobarlo.
