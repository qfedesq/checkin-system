# 03 — Improvement Plan

14 workstreams agrupados por solapamiento de archivos/área, ordenados en 3 olas. AUTO_FIX=false → requiere GO. Cada fix: diff mínimo, seguir patrones existentes, agregar/actualizar test, correr `pnpm test`+`pnpm build` antes de reportar.

## Olas
- **Ola 1 (BLOCKER + CRITICAL)**: WS-1a, WS-2, WS-3a, WS-4a.
- **Ola 2 (MAJOR)**: WS-1b, WS-3b, WS-5, WS-6, WS-7, WS-8, WS-9, WS-10, WS-11a.
- **Ola 3 (MINOR + COSMETIC)**: WS-4b, WS-11b, WS-12, WS-13, WS-14.

---

## OLA 1

### WS-1a — Sesión/estado enforcement (QA-001 BLOCKER, QA-003 CRITICAL)
- Archivos: `src/lib/auth.ts`, `src/middleware.ts`, `src/lib/admin-guard.ts`, `src/app/api/attendance/checkin|checkout/route.ts`, `/api/profile*`, endpoints sensibles.
- Aceptación: (a) una cuenta puesta DISABLED (manual o cron) no puede fichar ni llamar endpoints sensibles ni pasar el middleware, sin esperar expiración del JWT; (b) cambio de rol se refleja en la próxima request; (c) un usuario con `mustChangePassword` es rechazado por los endpoints `/api/**` sensibles, no solo redirigido en páginas.
- Enfoque: helper `getEnforcedSession()` que revalida `status/role/mustChangePassword` contra DB (o `deviceApprovedAt`) en middleware + rutas sensibles; alternativamente bajar `session.maxAge` y revalidar en server actions. Tests de guard.
- Riesgo: +1 query por request sensible. Efort: M. **Sin dependencias.**

### WS-2 — PII en Blob privado (QA-002 CRITICAL)
- Archivos: `src/lib/blob.ts`, `/api/*/uploads`, `/api/uploads/signature`, `/api/documents/upload`, `/api/admin/deliveries/upload`, `/api/deliveries/[id]/open`, y todo lugar que muestre esas imágenes (`EmployeeDetailClient`, `ProfileForm`, `DocsVencimientos`, inbox).
- Aceptación: los blobs de DNI/licencia/libreta/firma/recibos dejan de ser accesibles sin sesión; se sirven vía URL firmada corta o proxy autenticado con verificación de ownership/rol.
- Enfoque: `uploadBlob` con `access:"private"` (o token) + endpoint proxy `/api/files/[...]` que valida sesión y devuelve el binario/redirect firmado. Migrar los `<img src=blobUrl>` a ese endpoint.
- Riesgo: L (toca muchas superficies + assets ya subidos como públicos). Efort: L. **Sin dependencias; coordinar con WS-13 (ImageSlot).**

### WS-3a — Cupo de vacaciones al aprobar (QA-004 CRITICAL)
- Archivos: `src/app/api/admin/leaves/[id]/approve/route.ts`, `src/lib/leaves.ts`.
- Aceptación: aprobar una VACATION revalida, dentro de una transacción, cupo 1 chofer+1 ayudante/semana y saldo anual; si no cumple, 409 sin mutar.
- Enfoque: extraer la validación de `leaves` route a una función reusable y llamarla en approve. Test unitario de la regla.
- Riesgo: bajo. Efort: S/M. **Sin dependencias.**

### WS-4a — Guarda de WebAuthn en check-in (QA-005 CRITICAL)
- Archivos: `src/app/(app)/checkin/CheckinClient.tsx` (y login si aplica).
- Aceptación: si `browserSupportsWebAuthn()` es false (ej. in-app WhatsApp), no se intenta fichar; se muestra un aviso claro con acción "abrir en Safari/Chrome".
- Riesgo: bajo. Efort: S. **Sin dependencias.**

---

## OLA 2 (MAJOR) — resumen
- **WS-1b** Login segundo factor real o quitar la promesa de "solo un dispositivo inicia sesión" del copy (QA-006); rate limiting en login/password/webauthn (QA-022). Depende de WS-1a.
- **WS-3b** Guard de estado PENDING en approve/reject de leaves y documentos (QA-007); atomicidad de creación de licencias (QA-008); reparar doble jornada abierta + UI admin para cerrar huérfana (QA-009→MAJOR). Archivos: rutas de leaves/documents/attendance. Depende de WS-3a (mismos archivos).
- **WS-5** Timezone: dashboard "hoy" y export Excel en America/Argentina (QA-010, QA-011). Archivos: `admin/page.tsx`, `api/attendance/export`. Independiente.
- **WS-6** Resiliencia API: wrapper `try/catch`+logging para los 38 handlers y `res.ok` en `AdminDocuments` (QA-012, QA-013, QA-053). Toca muchos archivos → hacer como pase único con helper `withErrorHandling`. Coordinar orden con otras WS que tocan rutas.
- **WS-7** Calidad/CI: arreglar `tests/leaves.test.ts` (getUTCDay) (QA-014); configurar ESLint (QA-044); resolver lockfiles (QA-045); subir deps con vulns high y agregar `pnpm audit`/test en CI (QA-015); ampliar cobertura de tests de reglas y guards (QA-017). Independiente.
- **WS-8** Migraciones versionadas Prisma (QA-016): baseline `prisma migrate` desde el estado actual. Independiente (coordinar deploy).
- **WS-9** Accesibilidad: alternativa de firma no táctil / subir imagen como fallback (QA-023); subir contraste de tokens en modo claro (QA-024); `htmlFor/id` en formularios (QA-025); componente `Modal` accesible con foco/Escape (QA-026, también QA-046); batch aria (QA-052). Archivos: SignaturePad, globals.css, forms, nuevo Modal.
- **WS-10** UX admin segura: confirmaciones en acciones irreversibles + `disabled` on busy + fix cancelar-prompt-igual-rechaza (QA-027); confirmación positiva post-acción (QA-028); ocultar/mask clave temporal (QA-030); copy de error consistente + quitar "pwd temp" (QA-029). Archivos: UsersTable, AdminDocuments, ProfileChangesClient, AdminLeavesTable.
- **WS-11a** Performance MAJOR: `maxDuration`+batching en cron expiry (QA-018); resize/optimización de imágenes o `next/image` + thumbnails (QA-019); paginar listas admin (QA-020). Archivos: crons, blob/display, admin pages.

## OLA 3 (MINOR + COSMETIC) — resumen
- **WS-4b** Push standalone iOS (QA-048), targets 44px (QA-049), manifest 192/maskable (QA-051), canvas resize (QA-050).
- **WS-11b** Índices Prisma (QA-032), counts duplicados admin (QA-033).
- **WS-12** Seguridad menor: CRON_SECRET fail-closed+timing-safe (QA-021→ subir a Ola 2 si se prioriza), magic-bytes de archivos (QA-034), sanitizar filename (QA-035), mitigar enumeración webauthn (QA-036), headers/CSP (QA-037), audit log de export (QA-038).
- **WS-13** Dedup: `ImageSlot` compartido, `Modal` compartido, unificar lógica de aprobación de perfil (QA-046, QA-047); smells (QA-058).
- **WS-14** Funcional menor: lock optimista ProfileChangeRequest (QA-039), manejo de colisión de unicidad → 409 (QA-040), impedir auto-deshabilitar/último admin (QA-041), loop reset-password (QA-042), idempotencia apertura recibo (QA-043), estados loading/error (QA-031), limpiar código muerto PENDING_APPROVAL (QA-054), cosméticos (QA-055/56/57).

## Dependencias y paralelismo
- Ola 1: WS-1a, WS-2, WS-3a, WS-4a son **paralelizables** (archivos disjuntos), salvo WS-2↔WS-13 (ImageSlot) → hacer WS-2 antes de dedup.
- Ola 2: WS-5, WS-7, WS-8, WS-9 son independientes entre sí. WS-6 (pase global de rutas) conviene **secuencial al final de la ola** para no chocar con WS-1b/WS-3b/WS-5 que editan rutas. WS-10 y WS-9 comparten modales → WS-9 crea el `Modal`, WS-10 lo consume.
- Elevar a Ola 2 recomendado: **QA-021 (CRON_SECRET fail-open)** por severidad security real.

## Nota de contexto
`QA-003` (clave fija Emmalva01) fue decisión de producto de Federico; el plan ataca lo accionable (enforcement de mustChangePassword) sin revertir la decisión salvo indicación. Emails hoy en stub (falta GMAIL_APP_PASSWORD) — QA-018 se vuelve relevante recién con SMTP real.
