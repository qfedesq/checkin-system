## Resumen

<!-- ¿Qué cambia y por qué? -->

## Checklist de release (obligatorio)

- [ ] Versión bumpeada (+0.01) → `pnpm version:bump`
- [ ] Entrada nueva en `src/content/changelog.mdx`
- [ ] `CHANGELOG.md` regenerado → `pnpm sync:changelog`
- [ ] Sección correspondiente del manual actualizada en `src/content/manual/*.mdx` si cambia el comportamiento
- [ ] `README.md` o `docs/*.md` actualizados si cambió setup, variables de entorno o arquitectura
- [ ] Tests pasan → `pnpm test`
- [ ] `pnpm build` compila limpio localmente o en preview Vercel

## Notas para QA

<!-- Cómo probar, qué mirar, etc. -->
