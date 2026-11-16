// Fútbol · Reserva: Promiedos (promiedos.com.ar). Las páginas traen los datos
// completos en el JSON de Next.js (<script id="__NEXT_DATA__">), así que no hace falta navegador.
import { fetchText, limpiar, numero, aISO } from '../lib/util.js';

const BASE = 'https://www.promiedos.com.ar';

/** Extrae pageProps.data del HTML de una página de Promiedos. */
export function datosDePagina(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('Promiedos: la página no trae __NEXT_DATA__');
  const data = JSON.parse(m[1])?.props?.pageProps?.data;
  if (!data) throw new Error('Promiedos: __NEXT_DATA__ sin datos');
  return data;
}

/** "Quilmes AC (Reserva)" → "Quilmes"; "Lanús (Reserva)" → "Lanús". */
export function nombreEquipo(n) {
  const t = limpiar(n).replace(/\s*\((reserva|reserves|res\.)\)\s*$/i, '');
  return /^quilmes( ac| a\.c\.| atl[eé]tico club)?$/i.test(t) ? 'Quilmes' : t;
}

/** "19-05-2026 15:00" → ISO. */
const fechaISO = (t, zona) => aISO(limpiar(t).replace(/^(\d{2})-(\d{2})-(\d{4})/, '$1/$2/$3'), zona);

/** Partidos del equipo (los últimos jugados y los próximos), solo del torneo en curso. */
export function parsePartidosEquipo(data, equipoId, zona = '-03:00') {
  const filas = [...(data.games?.last?.rows || []), ...(data.games?.next?.rows || [])];
  const todos = filas
    .map((r) => r.game)
    .filter(Boolean)
    .map((g) => {
      const [loc, vis] = g.teams || [];
      const jugado = g.status?.enum === 3;
      return {
        fecha: fechaISO(g.start_time, zona),
        ronda: limpiar(g.stage_round_name) || null,
        local: nombreEquipo(loc?.name),
        visitante: nombreEquipo(vis?.name),
        esLocal: loc?.id === equipoId,
        gl: jugado ? numero(String(g.scores?.[0] ?? '')) : null,
        gv: jugado ? numero(String(g.scores?.[1] ?? '')) : null,
        jugado,
        estado: limpiar(g.status?.name) || (jugado ? 'Finalizado' : 'Programado'),
      };
    })
    .filter((p) => p.fecha)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  // La página mezcla el final del torneo anterior: me quedo desde la última "Fecha 1".
  const nro = (p) => numero((p.ronda || '').replace(/\D+/g, ''));
  let desde = 0;
  todos.forEach((p, i) => { if (i > 0 && nro(p) != null && nro(todos[i - 1]) != null && nro(p) < nro(todos[i - 1])) desde = i; });
  return todos.slice(desde);
}

/** Tabla del torneo en curso (primer grupo de tablas) donde está el equipo. */
export function parseTablaLiga(data, equipoId) {
  for (const grupo of data.tables_groups || []) {
    for (const t of grupo.tables || []) {
      const rows = t.table?.rows || [];
      if (!rows.some((r) => r.entity?.object?.id === equipoId)) continue;
      const filas = rows.map((r) => {
        const v = Object.fromEntries((r.values || []).map((x) => [x.key, x.value]));
        const [gf, gc] = String(v.Goals || '').split(':').map((x) => numero(x));
        return {
          pos: r.num,
          equipo: nombreEquipo(r.entity?.object?.name),
          equipoId: r.entity?.object?.id ?? null,
          pts: numero(v.Points), pj: numero(v.GamePlayed),
          pg: numero(v.GamesWon), pe: numero(v.GamesEven), pp: numero(v.GamesLost),
          gf: gf ?? null, gc: gc ?? null, dif: numero(v.Ratio),
          esQuilmes: r.entity?.object?.id === equipoId,
        };
      });
      const nombre = [limpiar(grupo.name), limpiar(t.name)].filter(Boolean).join(' · ') || 'Tabla';
      return { nombre, filas };
    }
  }
  return null;
}

export async function leerPromiedos(cfg, zona) {
  const [equipoHtml, ligaHtml] = await Promise.all([
    fetchText(`${BASE}/team/${cfg.equipoUrl}/${cfg.equipoId}`),
    fetchText(`${BASE}/league/${cfg.ligaUrl}/${cfg.ligaId}`),
  ]);
  const partidos = parsePartidosEquipo(datosDePagina(equipoHtml), cfg.equipoId, zona);
  if (!partidos.length) throw new Error('Promiedos: no encontré partidos de la reserva');
  const tabla = parseTablaLiga(datosDePagina(ligaHtml), cfg.equipoId);
  if (!tabla) throw new Error('Promiedos: no encontré a Quilmes en la tabla de la reserva');
  return {
    id: cfg.id,
    deporte: 'futbol',
    deporteNombre: cfg.deporteNombre,
    titulo: cfg.titulo,
    competencia: cfg.competencia,
    descripcion: cfg.descripcion,
    fuente: 'Promiedos',
    tabla: { nombre: tabla.nombre, columnas: ['pts', 'pj', 'pg', 'pe', 'pp', 'gf', 'gc', 'dif'], filas: tabla.filas },
    partidos,
  };
}
