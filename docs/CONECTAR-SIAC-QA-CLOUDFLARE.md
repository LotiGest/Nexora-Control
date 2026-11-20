# Configurar el canal privado Nexora <-> SIAC QA
**Fecha:** 20 de noviembre de 2026 · **Estado:** pendiente de provisión segura de secretos y Firebase

## Qué se verificó

- Cloudflare GjTorres: Worker `siac-license-qa` aislado, vinculado **solo** a D1 `siac-test-isolated` (no a `siac-db` de producción); `workers.dev` desactivado.
- Cloudflare de Lotigest/Nexora: Worker `nexora-licencias` con `NEXORA_SIAC_OWNER=siac-clinic-default` y `NEXORA_SIAC_STATUS_URL=https://siac-license-qa.nexorasystems.workers.dev/api/internal/nexora-license` ya configurados como secretos.
- No se configuró el secreto HMAC compartido; un intento automatizado de transferirlo entre cuentas fue bloqueado por controles de seguridad. La configuración parcial en SIAC QA fue eliminada.
- D1 de QA: tablas `siac_clinic_module_licenses` y `siac_clinic_module_license_events` verificadas, prueba con registro ficticio de plan Full vencido + auditoría superada y registros de prueba eliminados.
- Las consultas de QA devuelven `environment: qa`; Nexora las identifica como `siac_qa` y **nunca** como estado comercial verificado en producción.
- Firebase y accesos reales no están validados; la activación de licencias sigue bloqueada.

## Acción manual segura: clave de servicio compartida

Esta es una tarea para ejecutar **en el equipo del administrador**, jamás en ChatGPT ni en un repositorio público.

1. En PowerShell de Windows, generar 32 bytes aleatorios:
```powershell
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$key = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
Set-Clipboard -Value $key
Write-Host 'Clave aleatoria copiada al portapapeles. NO la compartas por chat.'
```
2. Entrar en Cloudflare **GjTorres** → Workers & Pages → `siac-license-qa` → Settings → Variables and Secrets; crear el secreto (Encrypt) `SIAC_NEXORA_LICENSE_KEY` con el valor del portapapeles.
3. Entrar en Cloudflare **Lotigest** → Workers & Pages → `nexora-licencias` → Settings → Variables and Secrets; crear el secreto (Encrypt) `NEXORA_SIAC_SHARED_KEY` **con el mismo valor**.
4. Comprobar que ambos secretos aparecen en la lista **solo por nombre**. La clave no debe volver a mostrarse ni registrarse.
5. Cuando se vayan a hacer pruebas autenticadas, habilitar temporalmente `workers.dev` para `siac-license-qa` (sin Preview URLs). Su ruta privada se protege con HMAC, pero una URL pública sin políticas adicionales no equivale a una VPN.
6. En el Worker de Nexora aún falta configurar `NEXORA_ADMIN_UIDS` con los UIDs reales, separados por comas, obtenidos del proyecto Firebase `nexora-control-717c6`. Confirmar que corresponden a las dos cuentas administradoras y que ambos emails están verificados. No enviar tokens de sesión al chat.
7. Probar los estados: ausencia de token 401/503; token ajeno 403; firma incorrecta 401; firma correcta solo lectura; expiración, UI QA marcada explícitamente y ningún cambio de D1 provocado por consultar.
8. **No** activar `siac-license-qa` como origen de producción, no desplegar migraciones en `siac-db` ni habilitar operaciones de escritura.

## Después de probar QA

Para producción hay que integrar el endpoint protegido en el Worker real `siac`, aplicar una migración auditada **sobre la D1 correcta**, obtener respaldo, probar la autorización en QA y desarrollar una operación de escritura diferente con permisos mínimos, confirmación, idempotencia, control de versión, auditoría atómica y rollback. Una ruta de consulta no concede licencias Full por sí sola.

La URL pública del Worker Nexora sigue deshabilitada. GitHub Pages puede ser el frontend, pero no debe tratarse la interfaz de login como sustituto de reglas Firestore o políticas de Cloudflare.
