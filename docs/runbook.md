# Runbook operativo

## Resetear password de un empleado

1. Entrá a `/admin/users`.
2. Click en el icono de llave en la fila del empleado.
3. El sistema genera una contraseña temporal de 12 caracteres, la copia al portapapeles y la muestra en un toast. Pasásela por un canal seguro.
4. El empleado ingresa con esa password → el middleware lo redirige a `/reset-password` → elige su nueva.

## Resetear dispositivo

El empleado perdió el teléfono o cambió de laptop.

1. `/admin/users` → icono de celular.
2. Se borran `WebAuthnCredential` y `User.deviceId`.
3. La próxima vez que entre, el sistema le pide registrar un nuevo dispositivo.

## Revivir el cron de vencimientos

```
curl -H "Authorization: Bearer $CRON_SECRET" https://checkin-system.vercel.app/api/cron/expiry-check
```

Verificar logs en Vercel. Si los emails no salen, revisá `RESEND_API_KEY` y dominio verificado en Resend.

## Restaurar DB

Neon ofrece branches y point-in-time restore. Desde el dashboard de Neon, crear branch desde timestamp deseado y actualizar `DATABASE_URL` en Vercel.

## Bumpear versión y publicar

1. `pnpm version:bump` → sube la versión en `package.json`.
2. Editar `src/content/changelog.mdx` con la nueva entrada.
3. `pnpm sync:changelog` → regenera `CHANGELOG.md`.
4. Actualizar `src/content/manual/*.mdx` si cambió el comportamiento.
5. PR → merge → Vercel deploy automático.
