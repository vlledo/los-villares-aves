# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Catálogo personal de las aves observables en **Los Villares (Jaén)**. Sitio estático en español publicado en <https://avesdelosvillares.es>. Contenido y UI son en español — mantener idioma y tono al editar texto, slugs, claves de enums, etc.

## Stack

Astro 6 + MDX, Tailwind 4 (vía `@tailwindcss/vite`, sin `tailwind.config`), `sharp` para imágenes, despliegue estático en Netlify. Node ≥ 22.12 (los scripts `.ts` se ejecutan directamente con `node`, sin transpilador). Cloudflare Web Analytics (sin cookies) en producción.

## Comandos

```bash
npm run dev                # Astro dev server en http://localhost:4321
npm run build              # Build estático en dist/
npm run preview            # Sirve dist/
npm run faltantes:listar   # Lista especies en hotspots eBird ≤10 km que aún no tenemos
npm run fichas:generar     # Crea fichas autogeneradas (foto + frontmatter base con TODOs)
npm run cantos:generar     # Embebe audio de xeno-canto para fichas que no lo tengan
npm run fichas:enriquecer  # Rellena tamano/envergadura/peso (Wikipedia) + estacionalidad (eBird) + hábitats + abundancia
npm run og:generar         # Regenera public/og.png a partir de SVG inline
```

`faltantes:listar` admite `--top N` (default 30) y `--json` (output pegable en `scripts/aves-iniciales.json`). Ejemplo de flujo: `npm run faltantes:listar -- --top 20 --json`.

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

## Estructura y tono de una ficha

Una ficha "completa" tiene **6 secciones** que se reparten entre el frontmatter y el cuerpo MDX. El template `src/pages/aves/[...slug].astro` renderiza unas u otras según haya contenido. Las dos fichas modelo de referencia son **`abejaruco-europeo.mdx`** y **`aguila-perdicera.mdx`**.

**Del frontmatter (campos opcionales pero esperados):**

1. `comportamiento: >` — 3-5 líneas. Cría, dieta, vuelo característico, sociabilidad, comportamiento estacional notable.
2. `canto_descripcion: >` — 2-4 líneas. Onomatopeya del reclamo/canto entre comillas, contexto (rama alta, en vuelo, época), comparación con otras especies si ayuda.
3. `puntos_buenos_avistamiento: [...]` — 3 puntos concretos del entorno de Los Villares (Sierra de la Pandera, embalse del Quiebrajano, olivares al sur, taludes del arroyo de la Parrilla, etc.). Específicos, no genéricos.
4. (opcional) `amenazas_locales: [...]` — 2-3 amenazas concretas mencionables en la sección Conservación del body. Se suele incluir cuando hay material relevante.

**Del cuerpo MDX (encabezados `##`):**

5. `## Identificación en campo` — Lista de bullets con rasgos diagnósticos en negrita (cabeza, pecho, alas, cola, juveniles vs adultos). Cerrar con confusiones posibles con otras especies de la zona.
6. `## Calendario en Los Villares` — 2 párrafos. Empezar con categoría en negrita (**residente** / **estival** / **invernante** / **paso** / **raro**) y rango de meses para cría o paso. Segundo párrafo opcional sobre comportamiento estacional, bandos invernales, etc.
7. `## Conservación` — 1 párrafo. Tres escalas: estado UICN global → situación en España (datos SACRE/PECBMS/SEO/BirdLife) → amenaza o medida local concreta. Cerrar siempre con una medida accionable cuando sea posible (cajas nido, conservar muros tradicionales, evitar limpieza excesiva, sustituir tendidos peligrosos, etc.).

**Tono general:**

- Prosa fluida en español, párrafos cortos (1-2 párrafos por sección).
- Negrita Markdown (`**...**`) **solo en el cuerpo MDX** (las secciones `##`). En los campos del frontmatter (`descripcion_corta`, `comportamiento`, `canto_descripcion`) el template `[...slug].astro` los interpola como texto plano con `{d.campo}` — los `**` saldrían literales en la página. Esos campos deben ser prosa limpia sin marcado.
- Mencionar siempre la geografía local concreta (Sierra Sur de Jaén, Sierra de la Pandera, embalse del Quiebrajano, olivar jiennense, casco urbano del pueblo) en vez de descripciones genéricas.
- Citar fuentes secundarias por nombre cuando aplique (SEO/BirdLife, programa SACRE, PECBMS, SEPRONA) sin enlaces inline — los enlaces oficiales están en `fuentes` del frontmatter.

**Fuentes de información para redactar cada sección:**

Las fichas se redactan a partir del conocimiento general ornitológico combinado con organismos y programas de referencia:

| Sección | Fuente principal | Notas |
|---|---|---|
| `descripcion_corta`, `## Identificación en campo` | Guías de campo de paseriformes ibéricas (SEO/BirdLife, Lynx Edicions, Collins) y conocimiento general. **No copiar prosa de Wikipedia** — debe ser síntesis con tono propio. |
| `comportamiento` | Conocimiento general de la especie + adaptaciones locales (paisaje mediterráneo, olivar, cortados jiennenses). |
| `canto_descripcion` | Caracterización fonética de la grabación xeno-canto referenciada en `fuentes.xeno_canto_id` + onomatopeyas españolas estándar. |
| `puntos_buenos_avistamiento` | Geografía local concreta del término de Los Villares y entorno (Sierra de la Pandera, embalse del Quiebrajano, arroyo de la Parrilla, casco urbano). 3 puntos específicos, no genéricos. |
| `amenazas_locales` | Combinación de amenazas estructurales (mismo set: electrocución, cebos envenenados, rodenticidas, intensificación, rehabilitaciones) ajustadas a cada especie según su ecología. |
| `## Calendario en Los Villares` | Estacionalidad del propio frontmatter (`estacionalidad: ene…dic`) traducida a prosa. Categorías estandarizadas: **residente / estival / invernante / paso / raro** según el patrón mensual (ver tabla más abajo). Añadir ciclo reproductor y comportamientos estacionales relevantes (cortejo, dormideros, paso). |
| `## Conservación` | **Tres escalas obligatorias**: estado UICN global (referenciar el `estado_uicn` del frontmatter: LC, NT, VU, EN, CR, DD, EX) → tendencia España (SACRE de SEO/BirdLife, PECBMS para Europa) → contexto local (Sierra Sur, conflictos concretos, programas LIFE relevantes). Cerrar con medida accionable cuando sea posible. |

**Definición operativa de las categorías de `estacionalidad` mensual:**

El enum `presenciaMes` (en `content.config.ts`) admite seis valores. Cada uno tiene una semántica concreta —no son intercambiables y el color con que se pintan en el calendario (`src/utils/meses.ts → PRESENCIA_COLOR`) está pensado para distinguirlos visualmente:

| Valor | Color en calendario | Significa | Ejemplo |
|---|---|---|---|
| `residente` | Verde olivo | Presente todo el año en territorios estables y predecibles | Mirlo, paloma torcaz, perdiz roja |
| `estival` | Ámbar | Presente solo en verano, cría en la zona, migra a África en invierno | Abejaruco, oropéndola, vencejo común |
| `invernante` | Azul cielo | Presente solo en invierno, llega del N. de Europa, parte en primavera | Zorzal común, mosquitero común, milano real |
| `paso` | Verde claro | Solo en migración, no cría ni inverna en la zona, presencia predecible en pasos | Abejero europeo, papamoscas cerrojillo, avión zapador |
| `raro` | Rosa | **Aparición esporádica e impredecible**: divagantes, irrupciones según cosechas, recolonización lenta, observaciones puntuales. NO sustituye a `paso` (que tiene patrón estacional) ni a `invernante`/`estival` (predecibles) | Águila imperial (divagante), jilguero lúgano (irrupción según año), piquituerto (nómada), buitre negro (recolonización), acentor alpino (irrupción invernal irregular) |
| `ausente` | Gris claro | No presente en ese mes | (uso obvio) |

**Regla práctica para distinguir `raro` de las demás:**
- Si la especie viene **cada año más o menos en las mismas fechas** → usar la categoría predecible (`residente`/`estival`/`invernante`/`paso`).
- Si la especie viene **algunos años sí y otros no**, depende de cosechas/sequías/movimientos divagantes, o es una recolonización en curso → usar `raro`.
- Los marcadores narrativos en el cuerpo MDX (frases tipo "presencia irregular", "nómada", "divagante", "irrupción") son señales de que la estacionalidad debería usar `raro` en lugar de la categoría predecible.

**Programas y referencias citables por nombre:**

- **UICN** (Unión Internacional para la Conservación de la Naturaleza) — fuente del estado global.
- **CEEA** (Catálogo Español de Especies Amenazadas) — categorías nacionales (Vulnerable, En Peligro, etc.).
- **SACRE** (Seguimiento de Aves Comunes Reproductoras, SEO/BirdLife) — tendencias en España.
- **PECBMS** (Pan-European Common Bird Monitoring Scheme) — tendencias europeas.
- **Noctua** (SEO/BirdLife) — programa específico para rapaces nocturnas.
- **SEPRONA** (Guardia Civil) — para amenazas relacionadas con caza ilegal o envenenamiento.
- **Programas LIFE específicos**: LIFE PRIMILLA (cernícalo primilla), LIFE Eurokite (milano real), proyecto Antídoto (envenenamientos), proyectos de reintroducción andaluces.

**Lo que NO se documenta automáticamente y siempre requiere revisión humana antes de publicar:**

- Dimensiones inverosímiles emitidas por el regex de `fichas:enriquecer` (a veces toma envergadura como tamaño, o ediciones ridículas tipo `peso_g: [130, 130]` para una especie de 3kg). Auditar siempre `tamano_cm`, `envergadura_cm`, `peso_g` antes de cerrar la ficha.
- Patrones de `estacionalidad` mal asignados a migrantes (la heurística cuela "residente" si hay observaciones residuales fuera de época normal).
- `habitats` heurísticamente asignados que no encajen con la ecología real (un ave esteparia como `bordes_de_camino` cuando debería ser `campos_cultivo`).
- Texto duplicado entre `descripcion_corta` y `## Identificación en campo` —debe ser prosa diferente, no copia.

Las fichas incompletas son válidas en build (todos esos campos son opcionales en `content.config.ts`), pero el objetivo de unificación es que las 101 tengan las 6 secciones canónicas. El estado de cobertura se puede auditar en cualquier momento con:

```bash
for f in src/content/aves/*.mdx; do
  name=$(basename "$f" .mdx)
  comp=$(grep -E "^comportamiento: " "$f" > /dev/null && echo "S" || echo "-")
  canto=$(grep -E "^canto_descripcion: " "$f" > /dev/null && echo "S" || echo "-")
  pba=$(awk '/^puntos_buenos_avistamiento:/{flag=1; next} /^[a-z_]+:/{flag=0} flag && /^  - /{c++} END{print (c>0)?"S":"-"}' "$f")
  ident=$(grep -F "## Identificación en campo" "$f" > /dev/null && echo "S" || echo "-")
  cal=$(grep -F "## Calendario en Los Villares" "$f" > /dev/null && echo "S" || echo "-")
  cons=$(grep -F "## Conservación" "$f" > /dev/null && echo "S" || echo "-")
  printf "%-40s %s%s%s %s%s%s\n" "$name" "$comp" "$canto" "$pba" "$ident" "$cal" "$cons"
done
```

## Estado del catálogo y próximo lote

**Última actualización: 2026-08-26**. El catálogo tiene **158 fichas** publicadas, **todas al 6/6** (las 6 secciones canónicas completas, ver sección "Estructura y tono de una ficha"). **La importación por lotes está terminada**: eBird registra 158 especies en hotspots a ≤10 km y `faltantes:listar` devuelve solo 2, ambas excluidas por decisión editorial (ver más abajo). A partir de aquí el catálogo se amplía por goteo, cuando eBird registre especies nuevas en la zona.

**Las dos especies excluidas a propósito** (si reaparecen en `faltantes:listar`, no son un error ni un mismatch taxonómico):

| Especie | Motivo |
|---|---|
| Estornino rosado (*Pastor roseus*) | Divagante estepario con una sola cita; material local prácticamente nulo |
| Pato criollo (*Cairina moschata*) | Pato doméstico neotropical; una cita en embalse es casi seguro un ejemplar suelto, no población asilvestrada |

Criterio aplicado: sí se admiten exóticas **asilvestradas con población establecida o en expansión** (inseparable de Namibia, cotorra argentina, estrilda común), y no se admiten domésticos sueltos ni divagantes de cita única.

**Lote 2026-06-26 (20 especies, → 141 fichas).** Importadas con el pipeline completo (`faltantes:listar` → seed → `fichas:generar` → `cantos:generar` → `fichas:enriquecer`) y redactadas a 6/6 con subagentes en paralelo (una ficha por agente, con el frontmatter ya auditado en el prompt). Especies: inseparable de Namibia (exótica asilvestrada), morito común, mosquitero musical, pato colorado, picogordo común, porrón europeo, reyezuelo sencillo, ánade friso, ánade rabudo, andarríos chico, ánsar común, avefría europea, calandria común, cetia ruiseñor, chotacabras europeo, collalba rubia occidental y las cuatro currucas carrasqueña/mirlona/rabilarga/tomillera. Correcciones manuales destacables: (1) **dimensiones del regex** muy flojas este lote — en limícolas/anátidas/chotacabras metía la longitud corporal en `envergadura_cm` dejando `tamano_cm:[0,0]` (andarríos, ánsar, cetia, chotacabras), y muchas fichas sin ninguna dimensión; se rellenaron todas a mano. (2) **Estacionalidades** mal clasificadas por la heurística (porrón/friso/avefría/reyezuelo/pato colorado "residente o ausente"→invernante, andarríos "residente"→invernante+paso, chotacabras "paso"→estival, collalba y currucas estivales "todo ausente"→estival, calandria→residente escaso marginal, morito/rabudo/ánsar→raro). (3) **UICN** corregido a mano: porrón europeo→VU, avefría→NT, curruca rabilarga→NT (el enriquecedor las dejó LC). (4) **Foto de museo**: el selector coló una bandeja de huevos disecados para la curruca mirlona (crédito "Museum Wiesbaden"); sustituida a mano por el P18 de Wikidata (Ron Knight, CC BY 2.0). (5) **Mismatch taxonómico de las currucas**: se sembraron con género `Sylvia` (convención del catálogo, lo prefiere Wikipedia ES) y así resolvieron GBIF/Wikipedia, pero **xeno-canto solo las indexa como `Curruca`** → los cantos se buscaron a mano con `gen:Curruca`. GBIF dio key=1 (raíz) para *Sylvia iberiae*: corregido a 10700636 (*Curruca iberiae*). Artículos Wikipedia ES: `Sylvia_hortensis/undata/conspicillata` existen; la carrasqueña va por nombre común (`Curruca_carrasqueña`).

**Lote 2026-08-26 (17 especies, → 158 fichas). Último lote de la importación por lotes.** Pipeline completo y redacción a 6/6 sin subagentes. `faltantes:listar` devolvió 19 candidatas: se importaron 17 y se excluyeron 2 por criterio editorial (ver tabla de exclusiones arriba). Especies: curruca zarcera, estrilda común, garcilla cangrejera, garza imperial, gaviota patiamarilla, gorrión moruno, grulla común, lavandera boyera, martín pescador común, martinete común, mirlo capiblanco, mosquitero papialbo, porrón pardo, somormujo lavanco, tarabilla norteña, zampullín cuellinegro y zarcero bereber. Correcciones manuales destacables:

1. **El enriquecedor rindió peor que nunca**: 1 tamaño de 17 (16 fichas con `tamano_cm:[0,0]`), 10 fichas sin hábitats detectables y 5 "envergaduras" que eran en realidad la longitud corporal (garza imperial 70-94→120-150, grulla 100-130→180-240, garcilla cangrejera 44-47→80-92, curruca zarcera 14→18-23). **Se reescribieron las 17 a mano.** Conclusión práctica: en anátidas, ardeidas, limícolas y grandes zancudas, dar por inservible la fase A y rellenar dimensiones a mano desde el principio.
2. **Estacionalidad: 16 de 17 mal.** La heurística dejó la grulla con los doce meses en `ausente` (eBird no la muestreó) y puso `residente` todo el año a martinete, lavandera boyera, porrón pardo, gorrión moruno y somormujo. Correcciones: martinete y mosquitero papialbo→estival, lavandera boyera→estival+paso, grulla→paso oct-nov/feb-mar, tarabilla norteña y curruca zarcera→paso, mirlo capiblanco y zampullín cuellinegro→invernante, porrón pardo y gaviota patiamarilla→raro.
3. **UICN**: porrón pardo `LC`→**`NT`** (el enriquecedor deja todo en LC por defecto; es la especie con peor estado del catálogo, En Peligro en España).
4. **Fotos, dos sustituidas tras revisar las 17 a ojo.** El selector eligió para el martinete un archivo llamado literalmente `Young night heron.jpg` (juvenil en cautividad, retrato de cabeza, sin el patrón adulto diagnóstico) y para la tarabilla norteña una foto donde el ave ocupa ~3% del encuadre. **Lección: revisar visualmente las fotos de cada lote, no solo el crédito y la licencia** — `pickBestPhoto` puntúa por ratio y licencia, y no sabe si el ave es adulta, si está en un zoo o si es un punto lejano. También hubo que limpiar el crédito de la garcilla cangrejera, que traía incrustadas las coordenadas de geolocalización de Commons ("Camera location 43° 15′…").
5. **Mismatch `Sylvia`/`Curruca` otra vez**, ahora con la curruca zarcera: sembrada como `Sylvia communis` (Wikipedia ES canoniza ahí y `Curruca_communis` redirige), pero xeno-canto solo la indexa como `Curruca` → canto buscado a mano con `gen:Curruca` (XC915721, el único registro español). Además `fichas:generar` la dejó **sin `ebird_code` ni `wikipedia_url`**, y sin `ebird_code` una especie reaparece como faltante en el siguiente `faltantes:listar`: rellenados a mano. Conviene comprobar siempre que las 3 fuentes estén presentes tras generar.

**Repaso de unificación completado (2026-06-12).** Las 101 fichas existentes pasaron de un estado heterogéneo (con muchas a 0-4/6) a estar todas al 6/6 mediante 19 lotes de 5 fichas con revisión humana entre lotes. Aprovechando el rework se corrigieron también varios bugs estructurales: dimensiones inverosímiles en frontmatter (peso=130g del águila imperial, envergadura=38cm del alcaraván, envergadura=14cm del trepador-azul) y estacionalidades absurdas en estivales (saltos may→ausente→jun en vencejo-real, oct/sep=estival en papamoscas-gris). Cualquier ficha que se importe a partir de ahora debe cumplir el estándar 6/6 desde el principio.

**Para comprobar si eBird ha registrado especies nuevas**, lanza:
```bash
npm run faltantes:listar -- --top 20
```
Te lista las especies presentes en hotspots locales que aún no están en el catálogo. Añade `--json` para sacar entries pegables directamente en `scripts/aves-iniciales.json`. Antes de pegar: descarta las dos exclusiones editoriales de la tabla anterior y filtra los falsos positivos por mismatch taxonómico (a 2026-06-07 la cabecera era *Curruca cabecinegra*, que se cubre como `Sylvia melanocephala`; ahora ya tiene `ebird_code: sarwar1` y no debería reaparecer).

**Convención de tamaño de lote: ~20 especies por iteración**, no más. Importar en bloque mayor amplifica errores de regex/heurística y dificulta la revisión humana posterior. El usuario espera ver un resumen del enriquecimiento entre lotes antes de continuar.

Mantén actualizada esta cifra cuando hagas otro commit grande. El recuento exacto vive en:
- `ls src/content/aves/*.mdx | wc -l` (fichas en el catálogo)
- `npm run faltantes:listar` (cuenta de cobertura vs unión de hotspots)

Si la memoria de Claude Code (en `~/.claude/projects/.../memory/`) está intacta, los mismos hechos están en archivos `project_catalog_state.md`, `feedback_batch_size.md`, etc., como caché secundaria. La fuente de verdad es este `CLAUDE.md` porque está versionado.

## Bitácora

Colección `bitacora` (definida en `src/content.config.ts`) con entradas en `src/content/bitacora/*.mdx`. Cada entrada es un **micropost**: fecha + 1-2 frases sobre una novedad del sitio. Tono cercano y breve, sin título.

**Frontmatter:**
```yaml
fecha: 2026-06-12              # obligatoria, ISO
especies:                      # opcional, solo si la entrada anuncia aves nuevas
  - lavandera-cascadena
```

- `fecha` es obligatoria; Zod la convierte a `Date`.
- `especies` es opcional; si está presente debe tener al menos un slug y todos deben existir en la colección `aves` (validado en build por `src/utils/bitacora.ts → obtenerEntradasBitacora`, que rompe con error claro si encuentra un slug inválido).
- Cuerpo MDX libre. Para enlazar especies: `[nombre común](/aves/<slug>/)`.

**Convención de nombre:** `YYYY-MM-DD-slug-breve.mdx`.

**Cuándo crear entrada:**
- Al importar nuevas especies → entrada con `especies: [...]` listando los slugs.
- Al hacer una mejora transversal (criterio nuevo, secciones nuevas, hitos como llegar a 150 fichas) → entrada sin `especies`.

**Dónde se ve:**
- Página `/bitacora/` lista todas las entradas agrupadas por mes.
- Portada (`src/pages/index.astro`) muestra dos bloques al final, debajo del CTA: "Últimas añadidas" (4 fotos de las últimas especies aparecidas en entradas con `especies`) y "Bitácora" (3 últimos micropost de cualquier tipo).
- Entrada "Bitácora" en `src/components/Header.astro`, entre "Calendario" y "Sobre".

**"Últimas añadidas" se alimenta solo de la bitácora**, vía `ultimasEspeciesUnicas(entradas, 4)`. Toma **las 4 primeras del array `especies`** de la entrada más reciente, no una selección por calidad: al escribir una entrada de importación, poner delante las especies más vistosas y con mejor foto, porque son las que acaban en portada.

## Destacadas de portada (carrusel)

El carrusel superior de la portada se alimenta de las fichas con `destacada: true` en el frontmatter, **ordenadas por el array `ORDEN_DESTACADAS` hardcodeado en `src/pages/index.astro`**. Son dos sitios que hay que tocar a la vez: si se marca una ficha como destacada y no se añade su slug al array, `indexOf` devuelve -1 y queda descolocada al principio.

**Es una selección de temporada y hay que revisarla al cambiar de estación**, porque si no la portada acaba anunciando estivales en pleno invierno. Criterio: mezclar una o dos especies de reclamo (espectaculares, aunque sean escasas) con especies realmente abundantes en esos meses, para que quien venga al sitio pueda ver de verdad algo de lo que se le enseña.

| Temporada | Selección |
|---|---|
| Hasta 2026-08 (verano) | abejaruco europeo, águila perdicera, oropéndola, buitre leonado, abubilla |
| Desde 2026-08-26 (otoño-invierno) | grulla común, milano real, zorzal común, curruca capirotada, mirlo capiblanco |

**Spec original:** [`docs/superpowers/specs/2026-06-12-bitacora-design.md`](docs/superpowers/specs/2026-06-12-bitacora-design.md).
**Plan de implementación:** [`docs/superpowers/plans/2026-06-12-bitacora.md`](docs/superpowers/plans/2026-06-12-bitacora.md).

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
