# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Catálogo personal de las aves observables en **Los Villares (Jaén)**. Sitio estático en español publicado en <https://avesdelosvillares.es>. Contenido y UI son en español — mantener idioma y tono al editar texto, slugs, claves de enums, etc.

## Stack

Astro 6 + MDX, Tailwind 4 (vía `@tailwindcss/vite`, sin `tailwind.config`), `sharp` para imágenes, despliegue estático en Netlify. Node ≥ 22.12 (los scripts `.ts` se ejecutan directamente con `node`, sin transpilador).

## Comandos

```bash
npm run dev              # Astro dev server en http://localhost:4321
npm run build            # Build estático en dist/
npm run preview          # Sirve dist/
npm run fichas:generar   # Enriquece especies de scripts/aves-iniciales.json
npm run og:generar       # Regenera public/og.png a partir de SVG inline
```

No hay test suite ni linter configurado — `astro check`/`tsc --noEmit` son la verificación de tipos disponible si hace falta.

Para probar el selector de fotos sobre una especie concreta sin tocar el catálogo:
```bash
node scripts/check-imagen.ts "Gyps fulvus" "Aquila fasciata"
```

## Arquitectura

**Una colección de contenido, schema rígido.** `src/content.config.ts` define la colección `aves` con un Zod schema estricto: estacionalidad mes a mes (`residente|invernante|estival|paso|raro|ausente`), enums cerrados para `habitats`, `abundancia`, `estado_uicn`. Añadir un valor nuevo (p. ej. un hábitat) requiere extender el enum en `content.config.ts` **y** el `Record` correspondiente en `src/utils/formato.ts` o `src/utils/meses.ts`.

**Cada ave = un MDX en `src/content/aves/<slug>.mdx`** con frontmatter tipado. El `slug` es el `id` de Astro y la URL pública (`/aves/<slug>/`). La foto principal vive en `src/assets/aves/<slug>.<ext>` y se referencia desde el frontmatter como ruta relativa `../../assets/aves/<slug>.jpg` para que Astro la procese con `sharp` (no `public/`).

**Las páginas consumen la colección directamente** vía `getCollection('aves')` y pasan `CollectionEntry<'aves'>[]` a los componentes. No hay capa de datos intermedia. Los utilitarios de `src/utils/filtros.ts` operan sobre entradas crudas.

**Filtrado en cliente sin framework.** El catálogo (`/aves`) y el calendario son HTML estático: cada tarjeta lleva `data-meses`, `data-habitats`, `data-abundancia`, `data-nombre`. El script vanilla en `src/scripts/filtros-catalogo.ts` lee/escribe `aria-pressed` y oculta filas mediante el atributo `hidden`. No usar React/Svelte/Vue — el patrón es deliberado.

**Pipeline de generación de fichas** (`scripts/generate-fichas.ts`): orquesta cuatro APIs públicas — GBIF (taxonomía), Wikidata (P18 + ebird id + wiki es), Wikipedia ES (resumen), Wikimedia Commons (foto). El selector de fotos (`scripts/lib/commons.ts → pickBestPhoto`) puntúa candidatos descartando ilustraciones, esqueletos, huevos, licencias NC/ND/desconocidas y formatos verticales; prefiere ratio ~3:2 horizontal. Los campos que requieren conocimiento local (estacionalidad mes a mes, hábitats, dimensiones reales) se escriben como `TODO autogenerado` — **siempre** hay revisión manual posterior. El script respeta fichas existentes (las salta) y duerme 1.5 s entre especies para no maltratar las APIs.

## Convenciones a respetar

- **Idioma del producto: español.** Slugs, enums, claves de frontmatter, copy y commits — todo en español. Solo el código (identificadores, comentarios técnicos) admite inglés cuando es idiomático.
- **Paleta `tierra` / `olivo`** definida con `@theme` en `src/styles/global.css`. Usar siempre las escalas `tierra-*` / `olivo-*` antes que `stone-*` / `green-*` de Tailwind.
- **Atribución obligatoria** en cada foto: `foto_principal_credito` debe incluir autor + licencia + "Wikimedia Commons" (o equivalente). Las licencias NC/ND no son aceptables.
- **Las fichas con `TODO`** no deben publicarse sin revisar — el campo `tamano_cm: [0, 0]` y `estacionalidad` con todo `ausente` son marcadores explícitos.
- `LOCATION` y `SITE_*` en `src/consts.ts` son la fuente única para nombres del lugar y metadatos del sitio.
