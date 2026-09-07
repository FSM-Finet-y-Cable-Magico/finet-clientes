# Contribuir a finet-clientes

Este documento describe cómo se trabaja con git en este repo — es una convención **observada en la práctica** (reconstruida del historial de commits y ramas), no un proceso escrito de antemano. Si algo aquí no refleja cómo el equipo quiere trabajar, actualizar este archivo.

## Ramas

- **`main`** — rama de producción/release.
- **`dev`** — rama de integración. El trabajo terminado se acumula acá antes de pasar a `main`.
- **`review/<tema>`** o rama de feature — trabajo en curso. Se cierra mergeándola a `dev` (o abriendo PR hacia `dev`) cuando el trabajo está listo, y luego se borra (local + remota).
- **`incremento-N/<bloque>`** — trabajo de un incremento completo (ver [`docs/CASOS-DE-USO.md`](docs/CASOS-DE-USO.md)), una rama por "Bloque" funcional del incremento (ej. `incremento-2/deuda`, `incremento-2/smartolt`). Mismo ciclo de vida que una rama de feature: se cierra hacia `dev` cuando el bloque está listo. No hay que esperar a que todos los bloques de un incremento terminen para ir integrando los que sí están listos.

### Regla: nunca commitear directo en `dev`

`dev` es solo destino de merge, no lugar de trabajo. Cada dev trabaja exclusivamente en la rama del bloque que le tocó (`incremento-2/<bloque>`) y la actualiza con sus commits ahí:

```bash
git checkout incremento-2/<bloque>
# ... trabajar, commitear, pushear a esa rama ...
git push origin incremento-2/<bloque>
```

Si mientras tanto `dev` avanzó (porque otro bloque ya se cerró), traer esos cambios a la rama propia con merge, no rebase (evita reescribir commits que ya se pushearon y que otros puedan tener):

```bash
git checkout incremento-2/<bloque>
git merge dev
```

Cerrar el bloque hacia `dev` es el único momento en que se toca `dev` — y en general vía PR (`gh pr create --base dev --head incremento-2/<bloque>`), no merge directo, para que alguien revise antes de integrar. El fast-forward directo (ver más abajo) queda para casos simples sin necesidad de revisión, no como default en un equipo de 6 personas trabajando en paralelo.

`main` y `dev` pueden divergir (cada una con commits propios que la otra no tiene) — **no asumas que una es ancestro de la otra sin comprobarlo**:

```bash
git log dev..main --oneline    # commits en main que dev no tiene
git log main..dev --oneline    # commits en dev que main no tiene
```

Antes de cerrar una rama de feature, confirmá cuál es su verdadera base comparando conteos de commits contra cada candidata (`dev`, `main`) — la que tenga **0 commits propios que la rama de feature no tenga** es la base real, aunque `git branch --show-current`/`@{upstream}` no lo diga directamente.

### Integrar `dev` → `main`

Se hace vía Pull Request (`gh pr create --base main --head dev`), no merge directo — permite revisión antes del release.

### Cerrar una rama de feature/review hacia `dev`

Con varias personas trabajando en paralelo, el default es PR (`gh pr create --base dev --head <rama>`) — así alguien más revisa antes de integrar, aunque el merge sea técnicamente fast-forward.

El merge directo sin PR queda solo para trabajo propio, de una sola persona, sin necesidad real de revisión (por ejemplo, un ajuste de documentación):

```bash
git checkout dev
git merge <rama> --ff-only
git push origin dev
git branch -d <rama>
git push origin --delete <rama>
```

## Commits — contextual commits

El subject sigue [Conventional Commits](https://www.conventionalcommits.org/) tal cual (`feat(scope): ...`, `fix(scope): ...`, `refactor(scope): ...`). El body además puede llevar **action lines** tipadas que capturan el *por qué*, no el *qué* (eso ya lo muestra el diff):

```
feat(deuda): detalle del plan, botón de pago y excepciones CU-41

intent(deuda): mostrar el plan contratado y un botón de pago en la consulta pública y el portal
decision(deuda-pago): botón "Pagar ahora" sin acción por ahora — la pasarela de pago es CU-42+
constraint(deuda-cu41): no se modela el "ciclo de facturación activo" — se siguen devolviendo todas las facturas
learned(deuda-tests): los mocks de DeudaLookupForm.test estaban desactualizados
```

Tipos disponibles: `intent`, `decision`, `rejected`, `constraint`, `learned`. El más valioso es `rejected` — evita que alguien vuelva a proponer algo que ya se descartó, siempre con la razón.

No es obligatorio en cada commit — un fix trivial no necesita action lines, el subject alcanza. La guía completa está en [`.claude/skills/contextual-commit/SKILL.md`](.claude/skills/contextual-commit/SKILL.md).

Para reconstruir contexto rápido al retomar trabajo o cambiar de rama, usar el historial con estas action lines (`git log <base>..HEAD --format="%H%n%s%n%b"`) — es la fuente más confiable de decisiones y restricciones del proyecto, más que cualquier doc estático.

## Casos de uso (CU-XX / RF-XX)

Los commits y la documentación de API referencian números de caso de uso (`CU-41`) y requisito funcional (`RF-09`). El glosario reconstruido de qué es cada uno está en [`docs/CASOS-DE-USO.md`](docs/CASOS-DE-USO.md) — actualizarlo cuando se implemente un CU nuevo o se identifique uno de los que faltan.

## Antes de mergear a `main`

- `pnpm -r lint` y `pnpm -r build` sin errores (mínimo).
- `pnpm -r test` — y si se agrega una página/componente sin tests, agregarlos antes de pedir review, no después.
- Revisar que no haya commits "WIP" o auto-generados por herramientas del editor coladas en la rama — pasó al menos una vez (ver historial de `main`) y no se detecta con `git status`, solo comparando `git log <rama> -1` contra lo que realmente se quiso commitear.
