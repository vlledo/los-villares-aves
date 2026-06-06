import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const W = 1200;
const H = 630;

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#556627"/>
      <stop offset="100%" stop-color="#2d3717"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- decoración: tres pájaros estilizados arriba a la derecha -->
  <g stroke="#d0db98" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.55">
    <path d="M 920 110 C 950 90, 980 102, 1000 118 C 1020 102, 1050 90, 1080 110"/>
    <path d="M 850 175 C 875 158, 900 168, 916 180 C 932 168, 957 158, 982 175"/>
    <path d="M 970 235 C 994 220, 1018 228, 1032 240 C 1046 228, 1070 220, 1094 235"/>
  </g>

  <!-- título -->
  <text x="80" y="320" font-family="Georgia, 'Times New Roman', serif" font-size="96" font-weight="bold" fill="#faf7f1">
    Aves de Los Villares
  </text>

  <!-- subtítulo -->
  <text x="80" y="395" font-family="Georgia, serif" font-size="40" fill="#e7edcb">
    Catálogo personal de la avifauna del sur de Jaén
  </text>

  <!-- línea divisoria -->
  <line x1="80" y1="455" x2="380" y2="455" stroke="#b3c466" stroke-width="3"/>

  <!-- URL -->
  <text x="80" y="540" font-family="Georgia, serif" font-size="32" fill="#d0db98">
    avesdelosvillares.es
  </text>

  <!-- pie -->
  <text x="80" y="585" font-family="Georgia, serif" font-size="22" fill="#8fa343" letter-spacing="1.5">
    SIERRA DE LA PANDERA · LOS VILLARES (JAÉN)
  </text>
</svg>
`;

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'public');
await mkdir(outDir, { recursive: true });
const outFile = path.join(outDir, 'og.png');

await sharp(Buffer.from(svg)).png({ quality: 90 }).toFile(outFile);
console.log(`✓ generada ${outFile}`);
