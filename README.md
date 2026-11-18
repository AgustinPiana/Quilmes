# Agenda del Cervecero

Página para seguir en un solo lugar el fixture, los resultados y las tablas de Quilmes Atlético Club:

| Sección | Fuente | Cómo se lee |
|---|---|---|
| Fútbol · Primera Nacional | AFA (`info.afa.org.ar`) | HTML estático de tabla y fixture |
| Fútbol · Reserva | Promiedos (`promiedos.com.ar`) | JSON que trae cada página (`__NEXT_DATA__`) |
| Fútbol · Primera C femenina | DataFem (`datafem.com.ar`) | HTML de tabla y fixture, una página por fecha |
| Básquet · Superior (Mayores) | FEBAMBA (`febamba.com`) | Fixture por fechas + APIs públicas de fases y grupos |
| Hockey · Caballeros y Damas (Quilmes y Quilmes B) | AHBA (`tournamenttracker.buenosaireshockey.ar`) | Navegador automático (Playwright) que lee la página ya armada |
| Natación · Metropolitano Master | FENABA (`fenaba.org.ar`) | API de resultados + páginas de Hy-Tek de cada jornada (puntaje por equipos y podios de "QAC") |

Costo: **$0**. GitHub Actions junta los datos 6 veces por día y Vercel publica la página.

## Cómo funciona

```
GitHub Actions (09, 13, 17, 20, 22 y 00 h)
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

El escudo está incrustado en `public/index.html` (un `<symbol id="escudo">`) y también como `public/escudo.svg` para el ícono de la pestaña. Viene de Wikimedia Commons, donde figura como dominio público.

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
- **Reserva:** `reserva.equipoId` / `equipoUrl` salen de la URL del equipo en Promiedos (`promiedos.com.ar/team/quilmes-ac-(reserves)/jdeca`) y `ligaId` / `ligaUrl` de la del torneo.
- **Femenino:** `femenino.temporada`, `categoria` (`primera-c`) y `zonaTabla` salen de datafem.com.ar. Si el equipo asciende, cambia `categoria` (ej. `primera-b`).
- **Natación:** `natacion.temporada` (el año) y `natacion.torneo` (texto que identifica las jornadas, hoy `metro.?master`). Las jornadas nuevas aparecen solas.
- **Básquet:** `febamba.competicionId` y `compCatId` salen de la URL del torneo en febamba.com
  (ej. `febamba.com/detalle-torneo/2013/superior-2026` → `competicionId` 2013; `compCatId` es el valor del selector de categoría).
  El grupo del QAC lo encuentra solo.
- **Hockey:** cada torneo tiene su `nombreEquipo` (`QUILMES` o `QUILMES B`) tal como figura en la tabla de AHBA. `ahba.torneos[].codigo` es el pedazo de la URL del torneo en el sitio de AHBA
  (entrá con el club Quilmes elegido, abrí el torneo y copiá lo que está entre la `/` y el `?`).

## Pendiente

- Fútbol femenino e inferiores: AFA no los publica en formato de datos (solo noticias y PDF).
- Playoffs de hockey: son torneos aparte en AHBA; se agregan sumando su código en `config.json`.
