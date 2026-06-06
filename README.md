# Aves de Los Villares

Catálogo personal de las aves observables en **Los Villares (Jaén)**, en la
sierra sur andaluza. Fichas con identificación, estacionalidad, hábitats
y puntos de avistamiento.

Producción: <https://avesdelosvillares.es>

## Stack

- [Astro](https://astro.build/) + MDX
- [Tailwind CSS 4](https://tailwindcss.com/) (con `@theme` y paleta propia
  *tierra* / *olivo*)
- Imágenes optimizadas con `sharp` (WebP responsive)
- Despliegue estático en [Netlify](https://www.netlify.com/)

## Estructura

```
src/
├── content.config.ts          # Schema Zod de la colección "aves"
├── consts.ts                  # SITE_TITLE, LOCATION
├── content/aves/*.mdx         # Una ficha por especie
├── assets/aves/*.jpg          # Foto principal por especie
├── components/                # Header, Footer, HeatmapEstacional, CarruselDestacadas…
├── pages/                     # Inicio, /aves, /aves/[slug], /calendario, /sobre
├── layouts/Layout.astro
├── scripts/filtros-catalogo.ts
└── utils/                     # filtros, formato, meses

scripts/
├── aves-iniciales.json        # Lista de especies a enriquecer
├── generate-fichas.ts         # Orquestador GBIF + Wikidata + Wikipedia + Commons
├── check-imagen.ts            # Validador del selector de fotos
└── lib/                       # Wrappers de cada API
```

## Comandos

```bash
npm install
npm run dev            # Servidor local en http://localhost:4321
npm run build          # Genera la versión estática en dist/
npm run preview        # Servidor local sobre dist/
npm run fichas:generar # Crea fichas autogeneradas para especies del JSON inicial
```

El script `fichas:generar` consulta GBIF para datos taxonómicos, Wikidata
para metadata estructurada, Wikipedia ES para descripciones cortas y
Wikimedia Commons para fotos (eligiendo automáticamente una imagen
horizontal con licencia permisiva). Las fichas que ya existen se respetan
— solo crea las que faltan.

## Datos y atribución

- Taxonomía: [GBIF Backbone](https://www.gbif.org/)
- Códigos de especie: [eBird](https://ebird.org/)
- Descripciones: [Wikipedia ES](https://es.wikipedia.org/)
- Imágenes: [Wikimedia Commons](https://commons.wikimedia.org/) — autor
  y licencia indicados en el pie de cada foto
- Audios de canto: [xeno-canto](https://xeno-canto.org/)

## Licencia

Código bajo licencia MIT. Las fichas (texto) son CC BY-SA 4.0. Las fotos
mantienen la licencia original del autor en Wikimedia Commons.

---

Proyecto desarrollado y mantenido por **Víctor Rodríguez Lledó** —
[hola@vlledo.es](mailto:hola@vlledo.es).
