# VeloLayer

**¿Qué ropa de ciclismo me pongo?** PWA que recomienda ropa y avisa de lluvia, viento y cambios
de sensación térmica **a lo largo de toda la ruta**, no solo en el punto de salida: combina la
previsión meteorológica por hora con el perfil de la ruta (GPX o línea recta), estima a qué hora
pasarás por cada punto y traduce el resultado en prendas concretas con su justificación.

Sin cuentas, sin servidores propios: todo se calcula en el navegador y los datos viven en el
dispositivo.

---

## Índice

- [Requisitos](#requisitos)
- [Instalación y desarrollo](#instalación-y-desarrollo)
- [Scripts disponibles](#scripts-disponibles)
- [Cómo funciona](#cómo-funciona)
- [Instalación en iPhone (PWA)](#instalación-en-iphone-pwa)
- [Despliegue](#despliegue)
- [Fuentes de datos y atribuciones](#fuentes-de-datos-y-atribuciones)
- [Persistencia local](#persistencia-local)
- [Límites conocidos (léelos)](#límites-conocidos-léelos)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Tests](#tests)

---

## Requisitos

- **Node.js ≥ 20** (probado con Node 24 LTS v24.22.1 y npm 11). Si usas [nvm](https://github.com/nvm-sh/nvm):

  ```bash
  nvm install 24
  nvm use 24
  ```

- npm (se distribuye con Node).
- Conexión a internet en tiempo de uso: mapa (teselas OSM) y previsión (Open-Meteo).
- No hace falta API key, backend ni base de datos externa.

## Instalación y desarrollo

```bash
npm install        # instala dependencias
npm run icons      # regenera los iconos PWA (scripts/generate-icons.mjs, sin dependencias)
npm run dev        # servidor de desarrollo en http://localhost:5173
```

Build de producción (incluye comprobación de tipos y genera el service worker):

```bash
npm run build      # → dist/
npm run preview    # sirve dist/ en local para probar la PWA
```

## Scripts disponibles

| Script             | Qué hace                                                     |
| ------------------ | ------------------------------------------------------------ |
| `npm run dev`      | Servidor de desarrollo con HMR (Vite 7)                       |
| `npm run build`    | `tsc -b` (typecheck estricto) + `vite build` → `dist/` + SW   |
| `npm run preview`  | Sirve `dist/` en local (probar la PWA compilada)              |
| `npm test`         | Ejecuta la suite completa de Vitest (una vez)                 |
| `npm run test:watch` | Vitest en modo watch                                        |
| `npm run icons`    | Regenera `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` y `favicon.svg` |

## Cómo funciona

1. **Entrada**: GPX (parseado con `DOMParser`, validando coordenadas, tiempos y elevaciones) o
   lugar de salida/destino (geocodificación de Open-Meteo; línea recta si no hay router ciclista,
   avisándolo claramente).
2. **Muestreo**: se eligen puntos cada ~2–5 km (con tope de peticiones; en rutas muy largas la
   separación puede crecer) incluyendo siempre primero y último, y acortando ante saltos de
   altitud relevantes.
3. **Tiempos de paso**: modelo configurable y orientativo — velocidad en llano + VAM en subidas +
   velocidad de descenso en bajadas; si indicas hora de llegada se reescala y se deriva una
   velocidad media coherente.
4. **Previsión**: una petición multidestino a Open-Meteo (máx. 20 coordenadas por lote) con
   altitud incluida; caché interna en IndexedDB con TTL de 3 h.
5. **Interpolación**: valores horarios interpolados linealmente a la hora estimada de paso (los
   códigos meteorológicos usan el valor más próximo; un hueco de datos no se rellena con cero).
6. **Viento y sensación térmica**: componente de frente/cola según el rumbo de cada tramo y
   sensación estimada en marcha (fórmula de enfriamiento por viento solo dentro de su rango de
   validez; fuera de él, la variable aparente de la API, siempre explicándolo).
7. **Ropa**: motor de reglas versionado en [`src/rules/clothing.json`](src/rules/clothing.json)
   (umbrales por zona corporal, sensibilidad friolero/normal/caluroso, lluvia, viento, UV, noche,
   descensos largos). Cada prenda y aviso incluye **el dato, el tramo y la hora que lo justifican**.
8. **Resultado**: mapa con segmentos coloreados (Leaflet + teselas OSM), cuatro gráficas uPlot
   sincronizadas entre sí y con el mapa, resumen y pestaña de ropa.

## Instalación en iPhone (PWA)

La app es una **PWA instalable** (manifest + service worker). En iOS:

1. Abre la app en **Safari** por HTTPS:
   - **Versión publicada**: <https://pardojavi.github.io/VeloLayer/> (se despliega sola al hacer
     push a `main`; si es la primera vez, revisa que el repo tenga *Settings → Pages → Source:
     GitHub Actions*).
   - En local: `npm run preview` desde una Mac, pero para instalarla en el iPhone hace falta
     HTTPS accesible desde el móvil.
2. iOS solo instala PWAs desde **Safari**.
3. Toca **Compartir → Añadir a pantalla de inicio**.
4. Se abrirá en modo standalone (sin barra de Safari) con el icono de VeloLayer.

Requisitos de iOS 16.4+ para que una PWA pueda instalarse; los service workers de iOS pueden
suspenderse y iOS **puede borrar datos de almacenamiento** de PWAs poco usadas o con poco espacio
(consulta [Límites conocidos](#límites-conocidos-léelos)).

## Despliegue

`npm run build` genera un sitio **estático** completo en `dist/`. Cualquier alojamiento estático
con HTTPS sirve:

- **GitHub Pages (incluido)**: el workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)
  compila, ejecuta tests y publica la app en **<https://pardojavi.github.io/VeloLayer/>** con cada
  push a `main`. Usa `BASE_PATH=/VeloLayer/` (ver `vite.config.ts`) para que los assets, el
  manifest y el scope del service worker apunten al subdirectorio; en el resto de hostings sigue
  valiendo `base: '/'`.
- **GitHub Pages manual / Netlify / Vercel / Cloudflare Pages**: *build command* `npm run build`
  y *publish directory* `dist/`.
- **nginx / cualquier servidor**: sirve `dist/` tal cual (SPA de una sola vista; no se necesitan
  reglas de fallback adicionales).

El service worker (`sw.js`) precachea el armazón de la app (16 entradas, ~540 KiB) y usa caché
en runtime solo para lo visitado: teselas OSM (máx. 300 / 7 días, según la política de uso de
OpenStreetMap) y APIs de Open-Meteo (máx. 60 respuestas / 6 h). **No hay precarga masiva de
teselas.**

## Fuentes de datos y atribuciones

Se muestran también dentro de la app (Ajustes → Fuentes) y en el mapa:

| Fuente                     | Uso                            | Licencia / atribución                                     |
| -------------------------- | ------------------------------ | --------------------------------------------------------- |
| [Open-Meteo](https://open-meteo.com) | Previsión horaria y geocodificación | Datos CC BY 4.0                                          |
| GeoNames                   | Geocodificación (vía Open-Meteo Geocoding) | CC BY 4.0                                        |
| Copernicus DEM 2021 GLO-90 (90 m) | Altitud de los puntos (vía Open-Meteo Elevation) | © Copernicus / ESA, datos vía Open-Meteo |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | Teselas del mapa y calculadora de distancias | © colaboradores de OpenStreetMap (ODbL)          |

## Persistencia local

Todo vive en **IndexedDB** (esquema versionado con migraciones, capa en `src/storage/`):

- **Preferencias** (`settings`): modo de plan, fecha/hora, lugar, velocidades, sensibilidad,
  pestaña/vista activas… se restauran en cada arranque.
- **Tracks GPX** (`tracks`): los archivos y sus datos derivados, con nombre y fecha.
- **Caché de previsión** (`forecastCache`): respuestas meteorológicas con TTL de 3 h para no
  repetir peticiones.

El botón **«Restablecer preferencias» solo borra las preferencias**: los tracks guardados se
gestionan aparte (borrado individual desde la lista de tracks) y **no se eliminan**.

## Límites conocidos (léelos)

- **Solo local, sin sincronización**: no hay cuentas ni backend. Los datos viven en este
  navegador/dispositivo. Borrar datos del navegador (o que iOS evacue el almacenamiento de la
  PWA) borra preferencias, tracks y caché. No se hace ninguna copia de seguridad.
- **No hay modo offline completo**: la app *se abre* sin red gracias al service worker (armazón
  precacheado), pero **el mapa y una previsión nueva necesitan internet**. Solo se sirven desde
  caché datos ya vistos (previsión hasta 3 h en la app / 6 h en el SW; teselas ya cargadas, máx.
  300). Sin red y sin caché verás el track, pero no teselas ni meteorología nueva.
- **Línea recta sin router**: entre lugar de destino no se consulta ningún enrutador ciclista;
  la ruta es una línea recta (o circular) y así se etiqueta en la interfaz.
- **Resolución horaria**: la previsión es por hora; los valores entre horas son interpolaciones
  lineales, no medidas. El marcado de cambios relevantes usa esos valores interpolados.
- **Tiempos orientativos**: el modelo de velocidades (llano/VAM/descenso) estima, no predice;
  no contempla tráfico, paradas, viento real sobre el ritmo ni estados de forma.
- **Sensación térmica estimada**: enfriamiento por viento solo dentro de su rango de validez
  (≈ temperatura ≤ 10 °C y viento > 4,8 km/h); fuera, usa la aparente de la API. No es una
  medición clínica.
- **Muestreo acotado**: como máximo ~40 puntos de previsión por ruta; en tramos muy largos la
  separación puede superar los 5 km para no agotar la cuota de la API.
- **Precisión del track**: las distancias/rumbos se calculan con fórmula del haversine sobre los
  puntos del GPX; no se corrige por cadencia ni trazado real de carretera.

## Estructura del proyecto

```
src/
├── domain/          # Lógica pura (sin React ni red): plan, tiempos, viento,
│   ├── track/       #   térmica, interpolación, análisis, motor de ropa…
│   ├── forecast/
│   ├── timing/ wind/ thermal-comfort/ clothing/
├── rules/
│   └── clothing.json  # Umbrales de ropa versionados (fuera de los componentes)
├── storage/         # IndexedDB: esquema versionado, migraciones, repositorios
├── services/        # HTTP (timeout/reintentos/dedupe) y clientes Open-Meteo
├── hooks/           # useSettings, useAnalysis, useGeolocation, usePlaceSearch
├── features/        # UI: planning (mapa+GPX), map (Leaflet), charts (uPlot),
│                    #   results, clothing, settings
└── tests/setup.ts   # Configuración de Vitest (jsdom, fake-indexeddb)
scripts/
└── generate-icons.mjs  # Generador de iconos PNG/SVG sin dependencias
public/              # Iconos PWA (192/512/maskable/apple-touch/favicon)
```

## Tests

```bash
npm test          # 14 archivos, 102 pruebas (Vitest + jsdom + fake-indexeddb)
npm run test:watch
```

Cubren el dominio: parseo y validación de GPX, geometría y muestreo, tiempos, viento relativo,
confort térmico, interpolación de previsión (incl. huecos de datos), motor de ropa (umbrales,
sensibilidad, lluvia, viento, UV, noche), preferencias/saneado, plan de ruta, análisis, clientes
de API y un **test de humo de la app completa** (arranque con preferencias desde IndexedDB y
navegación entre vistas). El typecheck estricto (`tsc -b`) forma parte de `npm run build`.

---

**VeloLayer 0.1.0** · React 19 + TypeScript + Vite · Leaflet + OpenStreetMap · uPlot ·
Open-Meteo · PWA instalable · sin cuentas ni servidores propios.
