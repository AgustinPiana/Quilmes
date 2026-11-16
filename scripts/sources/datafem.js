// Fútbol femenino: DataFem (datafem.com.ar). La página trae tabla y fixture ya armados en el HTML;
// el fixture se pide de a una fecha (…&seccion=fixture&torneo=zona-a&fecha=N).
import * as cheerio from 'cheerio';
import { fetchText, limpiar, numero } from '../lib/util.js';

const BASE = 'https://datafem.com.ar';
const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const FECHA_TITULO = /^(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo),\s+(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})$/i;

/** "Sábado, 14 de noviembre de 2026" + "15:00" → ISO. */
export function fechaISO(titulo, hora, zona = '-03:00') {
  const m = limpiar(titulo).match(FECHA_TITULO);
  if (!m) return null;
  const mes = MESES[m[3].toLowerCase()];
  if (!mes) return null;
  const h = (limpiar(hora).match(/^(\d{1,2}):(\d{2})$/) || [null, '00', '00']);
  const p = (n) => String(n).padStart(2, '0');
  return `${m[4]}-${p(mes)}-${p(m[2])}T${p(h[1])}:${h[2]}:00${zona}`;
}

/** Tabla de una zona (por el título que la encabeza, ej. "Zona A"). */
export function parseTabla(html, nombreZona, slugEquipo) {
  const $ = cheerio.load(html);
  let tabla = null;
  $('table').each((_, t) => {
    if (tabla) return;
    const $t = $(t);
    const titulo = $t.parents().slice(0, 4).map((__, p) => limpiar($(p).find('h1,h2,h3').first().text())).get().find(Boolean);
    if (limpiar(titulo).toLowerCase() !== nombreZona.toLowerCase()) return;
    const cols = $t.find('thead th').map((__, th) => limpiar($(th).text()).toLowerCase().replace(/\./g, '')).get();
    const idx = (k) => cols.indexOf(k);
    const filas = $t.find('tbody tr').map((__, tr) => {
      const td = $(tr).find('td').map((___, c) => limpiar($(c).text())).get();
      const link = $(tr).find('a[href^="/equipos/"]').attr('href') || '';
      return {
        pos: numero(td[idx('pos')]),
        equipo: td[idx('equipo')],
        equipoId: link.replace('/equipos/', '') || null,
        pts: numero(td[idx('pts')]), pj: numero(td[idx('pj')]),
        pg: numero(td[idx('pg')]), pe: numero(td[idx('pe')]), pp: numero(td[idx('pp')]),
        dif: numero((td[idx('dg')] || '').replace('+', '')),
        esQuilmes: link === `/equipos/${slugEquipo}`,
      };
    }).get();
    tabla = { nombre: limpiar(titulo), filas };
  });
  return tabla;
}

/** Números de fecha que ofrece el selector de un torneo (zona-a, final…). */
export function fechasDeTorneo(html, torneo) {
  const nums = new Set();
  const re = new RegExp(`torneo=${torneo}(?:&amp;|&)fecha=(\\d+)`, 'g');
  for (const m of html.matchAll(re)) nums.add(Number(m[1]));
  return [...nums].sort((a, b) => a - b);
}

/**
 * Partidos de una página de fixture donde juega el equipo.
 * Cada partido: [cancha] [hora + estado] [local · goles v goles · visitante], bajo un título con el día.
 * La página repite cada partido (versión celular y escritorio): se descartan los duplicados.
 */
export function parsePartidos(html, slugEquipo, { ronda = null, zona = '-03:00' } = {}) {
  const $ = cheerio.load(html);
  $('script,style,svg,img').remove();
  const partidos = new Map();
  let dia = null;
  $('body *').each((_, el) => {
    const $el = $(el);
    if ($el.children().length === 0 && FECHA_TITULO.test(limpiar($el.text()))) { dia = limpiar($el.text()); return; }
    const equipos = $el.children('a[href^="/equipos/"]');
    if (equipos.length !== 2) return;
    const [loc, vis] = equipos.map((__, a) => ({ slug: ($(a).attr('href') || '').replace('/equipos/', ''), nombre: limpiar($(a).text()) })).get();
    if (loc.slug !== slugEquipo && vis.slug !== slugEquipo) return;
    const goles = $el.children('div').first().find('span').map((__, s) => limpiar($(s).text())).get().filter((t) => t !== 'v');
    const info = $el.prev().find('span').map((__, s) => limpiar($(s).text())).get();
    const hora = info.find((t) => /^\d{1,2}:\d{2}$/.test(t)) || '';
    const estado = info.find((t) => !/^\d{1,2}:\d{2}$/.test(t)) || '';
    const jugado = /finalizado/i.test(estado);
    const fecha = fechaISO(dia, hora, zona);
    const clave = `${fecha}|${loc.slug}|${vis.slug}`;
    if (partidos.has(clave)) return;
    partidos.set(clave, {
      fecha,
      ronda,
      local: loc.nombre,
      visitante: vis.nombre,
      esLocal: loc.slug === slugEquipo,
      gl: jugado ? numero(goles[0]) : null,
      gv: jugado ? numero(goles[1]) : null,
      jugado,
      estado: estado || (jugado ? 'Finalizado' : 'Programado'),
      // Sin programar, la página pone "A confirmar" donde va la cancha.
      lugar: (() => { const l = limpiar($el.parent().children().first().text()); return !l || /confirmar|programado/i.test(l) ? null : l; })(),
    });
  });
  return [...partidos.values()];
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

export async function leerDatafem(cfg, zona) {
  const url = (q) => `${BASE}/${cfg.categoria}?temporada=${cfg.temporada}&${q}`;
  const tabla = parseTabla(await fetchText(url('seccion=tabla')), cfg.zonaTabla, cfg.equipo);
  if (!tabla || !tabla.filas.some((f) => f.esQuilmes)) throw new Error(`DataFem: no encontré a Quilmes en la ${cfg.zonaTabla}`);

  const partidos = [];
  for (const t of cfg.torneos) {
    const base = await fetchText(url(`seccion=fixture&torneo=${t.id}`));
    const fechas = fechasDeTorneo(base, t.id);
    for (const n of fechas.length ? fechas : [null]) {
      const html = n == null ? base : await fetchText(url(`seccion=fixture&torneo=${t.id}&fecha=${n}`));
      // "Fecha 7" en la fase regular; en la final, "Final · Ida" / "Final · Vuelta" (t.etiquetas)
      const ronda = n == null ? t.nombre : t.etiquetas?.[n - 1] ? `${t.nombre} · ${t.etiquetas[n - 1]}` : `${t.nombre} ${n}`;
      partidos.push(...parsePartidos(html, cfg.equipo, { ronda, zona }));
      await pausa(300); // sin apurar al sitio
    }
  }
  if (!partidos.length) throw new Error('DataFem: no encontré partidos de Quilmes');
  partidos.sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999')); // sin fecha, al final

  return {
    id: cfg.id,
    deporte: 'futbol',
    deporteNombre: cfg.deporteNombre,
    titulo: cfg.titulo,
    competencia: cfg.competencia,
    descripcion: cfg.descripcion,
    fuente: 'DataFem',
    tabla: { nombre: tabla.nombre, columnas: ['pts', 'pj', 'pg', 'pe', 'pp', 'dif'], filas: tabla.filas },
    partidos,
  };
}
