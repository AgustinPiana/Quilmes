# Agenda del Cervecero

Página para seguir en un solo lugar el fixture, los resultados y las tablas de Quilmes Atlético Club:

| Sección | Fuente | Cómo se lee |
|---|---|---|
| Fútbol · Primera Nacional | AFA (`info.afa.org.ar`) | HTML estático de tabla y fixture |
| Básquet · Superior (Mayores) | FEBAMBA (`febamba.com`) | Fixture por fechas + APIs públicas de fases y grupos |
| Hockey · Caballeros A y Damas B | AHBA (`tournamenttracker.buenosaireshockey.ar`) | Navegador automático (Playwright) que lee la página ya armada |

Costo: **$0**. GitHub Actions junta los datos 3 veces por día y Vercel publica la página.

## Cómo funciona

```
GitHub Actions (10:00, 18:00 y 00:30 h)
   └─ npm run update  →  public/data/quilmes.json  →  commit
                                                       └─ Vercel publica de nuevo
Página (public/)  →  lee data/quilmes.json
```

Si una fuente falla, el script conserva los datos anteriores de esa sección y la página muestra un aviso.

## Puesta en marcha (una sola vez)

1. **Subir a GitHub:** creá un repositorio nuevo (puede ser privado) y subí esta carpeta.
2. **Permisos:** en el repo, *Settings → Actions → General → Workflow permissions* → elegí **Read and write permissions** y guardá.
3. **Primera corrida:** pestaña *Actions → Actualizar datos → Run workflow*. Tarda 2–3 minutos.
4. **Vercel:** *Add New → Project*, importá el repo y dale *Deploy* (no hay que tocar nada, `vercel.json` ya tiene la configuración).

A partir de ahí se actualiza sola.

## Escudo

La página muestra un monograma "QAC". Si querés usar una imagen tuya, guardala como `public/escudo.png` (cuadrada, fondo transparente) y aparece sola en la barra.

## Comandos

```bash
npm install
npx playwright install chromium   # solo la primera vez, para hockey
npm run update                     # junta los datos y escribe public/data/quilmes.json
npm test                           # prueba los lectores con fragmentos reales de cada sitio
npx serve public                   # ver la página en http://localhost:3000
```

## Textos de cada categoría

El resumen de cada categoría (qué torneo es y cómo se asciende) está en `config.json`, en el campo `descripcion` de cada sección. La línea con la posición actual se calcula sola.

## Cuando cambie la temporada

Todo lo que cambia año a año está en `config.json`:

- **Fútbol:** `afa.canal` (`nacionalb` = Primera Nacional). Si Quilmes asciende, cambia el canal.
- **Básquet:** `febamba.competicionId` y `compCatId` salen de la URL del torneo en febamba.com
  (ej. `febamba.com/detalle-torneo/2013/superior-2026` → `competicionId` 2013; `compCatId` es el valor del selector de categoría).
  El grupo del QAC lo encuentra solo.
- **Hockey:** `ahba.torneos[].codigo` es el pedazo de la URL del torneo en el sitio de AHBA
  (entrá con el club Quilmes elegido, abrí el torneo y copiá lo que está entre la `/` y el `?`).

## Pendiente

- Fútbol femenino e inferiores: AFA no los publica en formato de datos (solo noticias y PDF).
- Playoffs de hockey: son torneos aparte en AHBA; se agregan sumando su código en `config.json`.
