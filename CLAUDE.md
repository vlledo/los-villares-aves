# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Catálogo personal de las aves observables en **Los Villares (Jaén)**. Sitio estático en español publicado en <https://avesdelosvillares.es>. Contenido y UI son en español — mantener idioma y tono al editar texto, slugs, claves de enums, etc.

## Stack

Astro 6 + MDX, Tailwind 4 (vía `@tailwindcss/vite`, sin `tailwind.config`), `sharp` para imágenes, despliegue estático en Netlify. Node ≥ 22.12 (los scripts `.ts` se ejecutan directamente con `node`, sin transpilador). Cloudflare Web Analytics (sin cookies) en producción.

## Comandos

```bash
npm run dev               # Astro dev server en http://localhost:4321
npm run build             # Build estático en dist/
npm run preview           # Sirve dist/
npm run fichas:generar    # Crea fichas autogeneradas (foto + frontmatter base con TODOs)
npm run cantos:generar    # Embebe audio de xeno-canto para fichas que no lo tengan
npm run fichas:enriquecer # Rellena tamano/envergadura/peso (Wikipedia) + estacionalidad (eBird)
npm run og:generar        # Regenera public/og.png a partir de SVG inline
```

No hay test suite ni linter — `astro check` / `tsc --noEmit` son la verificación de tipos disponible. La verificación funcional real es `npm run build` (Zod valida cada `.mdx` durante el build).

Para probar el selector de fotos sobre una especie concreta sin tocar el catálogo:
```bash
node scripts/check-imagen.ts "Gyps fulvus" "Aquila fasciata"
```

## Variables de entorno (`.env`, gitignorado)

- `XENO_CANTO_API_KEY` — para descubrir grabaciones (`cantos:generar`). No se necesita en runtime: los `.mp3` son públicos por ID.
- `EBIRD_API_KEY` — para listar especies en hotspots cercanos y muestrear presencia mensual (`fichas:enriquecer`).
- El token de Cloudflare Web Analytics está hardcodeado en `BaseHead.astro` — es público por diseño, no es secreto.

## Arquitectura

**Una colección de contenido, schema rígido.** `src/content.config.ts` define la colección `aves` con un Zod schema estricto: estacionalidad mes a mes (`residente|invernante|estival|paso|raro|ausente`), enums cerrados para `habitats`, `abundancia`, `estado_uicn`. Añadir un valor nuevo (p. ej. un hábitat) requiere extender el enum en `content.config.ts` **y** el `Record` correspondiente en `src/utils/formato.ts` o `src/utils/meses.ts`.

**Cada ave = un MDX en `src/content/aves/<slug>.mdx`** con frontmatter tipado. El `slug` es el `id` de Astro y la URL pública (`/aves/<slug>/`). La foto principal vive en `src/assets/aves/<slug>.<ext>` y se referencia desde el frontmatter como ruta relativa `../../assets/aves/<slug>.jpg` para que Astro la procese con `sharp` (no `public/`). El audio se embebe vía `<audio src="https://xeno-canto.org/{xeno_canto_id}/download">` — `xeno_canto_id` vive en `fuentes`.

**Las páginas consumen la colección directamente** vía `getCollection('aves')` y pasan `CollectionEntry<'aves'>[]` a los componentes. No hay capa de datos intermedia. Los utilitarios de `src/utils/filtros.ts` operan sobre entradas crudas.

**Filtrado en cliente sin framework.** El catálogo (`/aves`) y el calendario son HTML estático: cada tarjeta lleva `data-meses`, `data-habitats`, `data-abundancia`, `data-nombre`. El script vanilla en `src/scripts/filtros-catalogo.ts` lee/escribe `aria-pressed` y oculta filas mediante el atributo `hidden`. No usar React/Svelte/Vue — el patrón es deliberado.

## Flujo para añadir o sincronizar especies

El catálogo se amplía en lotes. El objetivo aproximado son las **~156 especies registradas en eBird en un radio de 10 km** del pueblo. El flujo idempotente es:

**1. Descubrir candidatos faltantes** (consulta a eBird, sin script empaquetado todavía — se hace ad hoc):
- `GET /v2/ref/hotspot/geo?lat=37.78&lng=-3.83&dist=10` → hotspots dentro del radio
- Para cada hotspot: `GET /v2/product/spplist/{locId}` → especies
- Unir, cruzar con `ebird_code` de cada `.mdx` y `nombre_cientifico`
- Ordenar las faltantes por presencia en hotspots (proxy de frecuencia local)

**2. Añadir entradas al seed** (`scripts/aves-iniciales.json`):
```json
{ "slug": "paloma-bravia", "nombre_comun": "Paloma bravía", "nombre_cientifico": "Columba livia" }
```
Solo `nombre_cientifico` es vinculante. El resto se obtiene de APIs.

**3. `npm run fichas:generar`** — orquesta GBIF (taxonomía), Wikidata (P18 + ebird_id + wiki es), Wikipedia ES (resumen), Wikimedia Commons (foto). El selector de fotos (`scripts/lib/commons.ts → pickBestPhoto`) descarta ilustraciones, esqueletos, licencias NC/ND/desconocidas y formatos verticales; prefiere ratio ~3:2. Idempotente: salta fichas existentes. Duerme 1.5 s entre especies. Los campos que requieren conocimiento local quedan como `TODO autogenerado`.

**4. `npm run cantos:generar`** — busca grabación en xeno-canto v3 por nombre científico, con fallback en cascada (`cnt:Spain q:A type:song len:5-30` → afloja país → afloja calidad → afloja tipo). Guarda `xeno_canto_id` en `fuentes` y `canto_audio_credito` en el frontmatter. Idempotente. Las licencias CC-NC-ND son aceptables porque embebemos sin modificar y el sitio es no comercial.

**5. `npm run fichas:enriquecer`** — corre **dos fases** sobre las fichas con marcadores `TODO autogenerado`. Idempotente: solo toca campos que aún tengan placeholder. Tras correrlo, audita los valores sospechosos (ver más abajo).

  **Fase A — dimensiones y estacionalidad:**
  - `tamano_cm`, `envergadura_cm`, `peso_g` desde el wikitext del artículo de Wikipedia ES (regex sobre patrones tipo "mide 50-65 cm", "envergadura de 81-98 cm", maneja `&nbsp;` y comas decimales). Emite siempre `[min, max]` aunque min===max, porque `peso_g`/`envergadura_cm` exigen `tuple` en el schema.
  - `estacionalidad` mes a mes muestreando eBird `/historic` en `ES-AN-JA` (4 días × 12 meses del año configurado). Clasifica a `residente|estival|invernante|paso|raro|ausente` con una heurística por proporción de meses en bloques invierno/verano/migración.

  **Fase B — hábitats, abundancia y limpieza:**
  - `habitats` desde keywords del wikitext (olivar, pinar, encinar, río, embalse, cortado, matorral, jardín, casco urbano…) mapeadas al enum de `content.config.ts`.
  - `abundancia` desde la frecuencia en hotspots (`muy_comun` si en 11-14 hotspots, `comun` 6-10, `escaso` 3-5, `raro` 1-2). Requiere haber regenerado el `presence.json` con los hotspots locales.
  - Elimina el stub `> Ficha autogenerada el YYYY-MM-DD. Revisar los campos marcados con TODO antes de publicar.` del cuerpo MDX.
  - Si `descripcion_corta` acaba en "Descripción pendiente", reintenta el fetch o lo marca como ficha incompleta en el resumen final.

**6. Revisión manual** — siempre hay residuos. Lo que NO se automatiza bien y queda para repaso humano: `comportamiento`, `canto_descripcion`, `puntos_buenos_avistamiento`, `altitud_m`, cuerpo MDX completo (sección "Identificación en campo", "Calendario en Los Villares"). Además, audita los valores sospechosos que pueda haber emitido la Fase A:
  - tamaños muy desviados (a veces el regex pilla la envergadura como tamaño)
  - estacionalidad de migrantes (la heurística cuela en "residente" si hay alguna observación residual fuera de su época normal)

**7. `npm run build`** — valida frontmatter contra Zod. Si una ficha queda inconsistente (p. ej. enum desconocido en `habitats`, escalar donde se espera tuple), el build rompe con el error exacto y el path del `.mdx`. **Antes de publicar/commitear** una expansión, verifica explícitamente que ya no quede ningún placeholder:
```bash
grep -l "tamano_cm: \[0, 0\]\|TODO autogenerado\|Ficha autogenerada el\|Descripción pendiente" src/content/aves/*.mdx
```
Salida vacía = catálogo limpio.

## Lecciones taxonómicas conocidas

Cuando un script falla con "sin resultados" para una especie común, casi siempre es **reclasificación taxonómica entre fuentes**. Las APIs no están sincronizadas:

| Especie | GBIF / Wikipedia ES | eBird | xeno-canto |
|---|---|---|---|
| Curruca cabecinegra | `Sylvia melanocephala` | `Curruca melanocephala` | `Curruca melanocephala` |
| Curruca capirotada | `Sylvia atricapilla` | `Sylvia atricapilla` | `Sylvia atricapilla` |
| Golondrina dáurica | `Cecropis daurica` (clásico) | `Cecropis rufula` (split) | `Cecropis daurica` |
| Alcaudón real | `Lanius meridionalis` | `Lanius meridionalis` | varía |

Cuando esto pase, busca a mano con el género alternativo y rellena el campo manualmente. No "corrijas" automáticamente el `nombre_cientifico` del `.mdx` sin pensar — el género usado en Wikipedia ES es el que prefieren los lectores hispanohablantes.

## Convenciones a respetar

- **Idioma del producto: español.** Slugs, enums, claves de frontmatter, copy y commits — todo en español. Solo el código (identificadores, comentarios técnicos) admite inglés cuando es idiomático.
- **Paleta `tierra` / `olivo`** definida con `@theme` en `src/styles/global.css`. Usar siempre las escalas `tierra-*` / `olivo-*` antes que `stone-*` / `green-*` de Tailwind.
- **Atribución obligatoria** en cada foto y audio: `foto_principal_credito` y `canto_audio_credito` deben incluir autor + licencia + fuente. Para fotos rechazamos NC/ND; para audios xeno-canto aceptamos NC-NC-SA-ND porque el embed no modifica.
- **Las fichas con `TODO`** no deben publicarse sin revisar — `tamano_cm: [0, 0]`, `estacionalidad` con todo `ausente` y `habitats: [olivar]` por defecto son marcadores explícitos.
- `LOCATION` y `SITE_*` en `src/consts.ts` son la fuente única para nombres del lugar y metadatos del sitio.
