# Bitácora del catálogo — Diseño

**Fecha:** 2026-06-12
**Estado:** aprobado (pendiente de implementar)

## Propósito

Añadir al sitio una **bitácora pública** que registre dos tipos de novedades:

1. **Aves nuevas añadidas** al catálogo.
2. **Mejoras y cambios** del propio sitio (nuevas secciones, criterios de catalogación, hitos del proyecto, etc.).

Está pensada para visitantes recurrentes, no como bitácora personal interna ni como changelog técnico. El tono es breve y cercano, en formato "micropost" —una o dos frases por entrada, sin título.

## Forma de cada entrada

Cada entrada de la bitácora es un fichero MDX en `src/content/bitacora/`. El frontmatter es mínimo:

```yaml
---
fecha: 2026-06-12
especies:                  # opcional, solo si la entrada anuncia aves nuevas
  - lavandera-cascadena
  - mosquitero-comun
---

Añadidas cinco especies del invierno pasado:
[lavandera cascadeña](/aves/lavandera-cascadena/),
[mosquitero común](/aves/mosquitero-comun/)…
todas vistas en el arroyo de la Parrilla.
```

**Reglas:**

- `fecha`: obligatoria, ISO `YYYY-MM-DD`. Zod la convierte a `Date`.
- `especies`: opcional, array de slugs del catálogo de aves **con al menos un elemento si está presente** (validado con `.min(1)`; un array vacío es inválido —si no hay especies, se omite el campo). Su presencia diferencia "entrada de nuevas aves" (alimenta el bloque "Últimas añadidas" de portada) de "entrada de mejora" (solo aparece en la bitácora general). **El tipo no se etiqueta visualmente** en el micropost; las entradas se leen como notas neutras.
- Cuerpo MDX libre. Para enlazar especies se usa Markdown estándar (`[nombre](/aves/<slug>/)`).
- Sin título.

## Colección y schema

En `src/content.config.ts`:

```typescript
const bitacora = defineCollection({
  loader: glob({ base: './src/content/bitacora', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    fecha: z.date(),
    especies: z.array(z.string()).min(1).optional(),
  }),
});

export const collections = { aves, bitacora };
```

**Validación cruzada (no cubierta por Zod):** si una entrada tiene `especies` y alguno de los slugs no existe en la colección `aves`, el build debe romper con un error claro (`bitacora/<id>.mdx: especie "<slug>" no existe en el catálogo`). Esto sigue el patrón del proyecto de validar en build, no en runtime.

## Convenciones de nomenclatura

- **Nombre de archivo:** `YYYY-MM-DD-slug-breve.mdx` (p. ej. `2026-06-12-repaso-completo.mdx`).
- **Orden:** las entradas se ordenan por `fecha` descendente. En caso de empate, por nombre de archivo (slug alfabético) como desempate determinista.
- Las entradas **no tienen URL propia**: la bitácora es una página única, no hay `/bitacora/<slug>/`.

## Página `/bitacora/`

Una sola página estática (`src/pages/bitacora.astro`):

- Lista todas las entradas agrupadas por mes, con cabecera tipo "Junio 2026", "Mayo 2026"…
- Cada entrada muestra:
  - **Fecha breve** en gris (`12 jun 2026`).
  - **Cuerpo MDX** renderizado completo (no trunca; los micropost son cortos por diseño).
  - Si la entrada tiene `especies`: **franja con TODAS las miniaturas** debajo (foto + nombre común, mismo estilo del carrusel pero más compacto, sin descripción). Si la lista es muy larga, la franja hace scroll horizontal —no se trunca, es la vista de archivo completo.
- Sin paginación (con micropost mensuales hay margen para años antes de que la página resulte larga; si llegamos ahí, se replantea).

## Bloques en portada

Se añaden dos secciones en `src/pages/index.astro` **justo debajo del carrusel de destacadas**, manteniendo el orden global:

```
[Hero]
[Carrusel destacadas]
[Últimas añadidas]          ← NUEVO
[Bitácora]                  ← NUEVO
[Stats: especies / km / altitud]
[CTA "Ver el catálogo"]
```

### "Últimas añadidas"

- Toma todas las entradas con `especies` no vacío en orden cronológico inverso.
- Junta los slugs únicos (manteniendo el orden de aparición —primero las de la entrada más reciente).
- Muestra las **4 primeras** como miniaturas en grid (foto + nombre común, sin más texto). Si la entrada más reciente solo añadió una especie, los huecos se rellenan con especies de entradas anteriores.
- Enlace al pie: `→ Ver todas las novedades` → `/bitacora/`.

### "Bitácora"

- Los **3 micropost más recientes** (de cualquier tipo, sin distinción visual entre nuevas-aves y mejoras).
- Cada uno con fecha breve + cuerpo MDX renderizado completo (no trunca).
- En portada, las entradas con `especies` **no muestran las miniaturas** (esas viven en el bloque "Últimas añadidas" justo encima y en la página `/bitacora/`).
- Enlace al pie: `→ Ver toda la bitácora` → `/bitacora/`.

## Navegación

Añadir `"Bitácora"` como quinta entrada en `src/components/Header.astro`, entre "Calendario" y "Sobre":

```typescript
const links = [
  { href: '/', label: 'Inicio' },
  { href: '/aves', label: 'Aves' },
  { href: '/calendario', label: 'Calendario' },
  { href: '/bitacora', label: 'Bitácora' },   // NUEVO
  { href: '/sobre', label: 'Sobre' },
];
```

## Entradas iniciales (seed)

Para inaugurar la bitácora con contenido real, se redactan tres entradas iniciales que documentan el momento y demuestran el formato. Las redacto yo en el tono del micropost validado y el usuario las revisa antes de comitearlas:

1. **2026-06-12** — Repaso de unificación completo (las 101 fichas pasan a tener las 6 secciones canónicas).
2. **2026-06-12** — Nueva categoría "raro" en el calendario, aplicada a 5 especies (águila imperial, jilguero lúgano, piquituerto, buitre negro, acentor alpino).
3. **2026-06-07** — Ampliación del catálogo a 101 especies (correspondiente al commit `11b3f6b`).

Ninguna lleva campo `especies` (son todas entradas de mejora); el bloque "Últimas añadidas" de portada quedará vacío inicialmente hasta que se importe el siguiente lote de especies nuevas.

## Documentación a actualizar

Añadir en `CLAUDE.md` una sección breve sobre la bitácora:

- Existencia de la colección `bitacora` y schema.
- Convención del nombre de archivo (`YYYY-MM-DD-slug-breve.mdx`).
- **Cuándo crear entrada:**
  - Al importar nuevas especies: una entrada con `especies: [...]` listando los slugs.
  - Al hacer mejora transversal (criterio nuevo, secciones nuevas, hitos): una entrada sin `especies`.
- Tono: micropost (una o dos frases, sin título), cercano y breve.

Actualizar también la memoria persistente (`feedback_tono_secciones.md` o crear una memoria de bitácora) recordando el formato.

## Lo que se queda fuera de este diseño (YAGNI)

- **Paginación / archivo histórico** — innecesario con la frecuencia esperada.
- **Etiquetas o categorías visibles** — choca con el tono "diario neutro" deliberado.
- **RSS o feed** — se puede añadir después si hace falta; no es prioritario.
- **Comentarios o reacciones** — fuera del alcance, es un sitio estático.
- **Búsqueda en la bitácora** — la página única ya permite Ctrl+F del navegador.
- **Auto-derivación de "fecha_anadida" desde las fichas** — el usuario eligió explícitamente que la bitácora sea manual.

## Plan de implementación (resumen)

Pendiente de detallar con `writing-plans` después de la revisión. Pasos esperados:

1. Crear `src/content/bitacora/` y extender `src/content.config.ts` con la nueva colección.
2. Redactar las 3 entradas iniciales.
3. Crear `src/pages/bitacora.astro` con la vista completa.
4. Modificar `src/pages/index.astro` para añadir los bloques "Últimas añadidas" y "Bitácora".
5. Modificar `src/components/Header.astro` para añadir la entrada "Bitácora".
6. Añadir validación cruzada de slugs `especies` → catálogo `aves`.
7. Actualizar `CLAUDE.md` y memoria persistente.
8. `npm run build` para validar todo y comprobar visualmente las páginas.
