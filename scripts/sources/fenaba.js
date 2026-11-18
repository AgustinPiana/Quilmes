// Natación: FENABA (fenaba.org.ar). La API pública lista los torneos con resultados del año;
// cada torneo es una exportación de Hy-Tek Meet Manager (evtindex.htm + una página por prueba).
// Quilmes Atlético Club figura como "QAC" en las pruebas y con su nombre completo en el puntaje por equipos.
import { limpiar, numero } from '../lib/util.js';

const API = 'https://fenaba.org.ar/api/resultados/get-resultados.php';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** Las páginas de Hy-Tek vienen en latin1. */
async function texto(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
      return new TextDecoder('latin1').decode(await r.arrayBuffer());
    } catch (e) {
      if (i === 2) throw e;
      await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
    }
  }
}
const sinTags = (html) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');

/** Del índice: fecha de la jornada, páginas de pruebas y la del último evento (trae el puntaje por equipos). */
export function parseIndice(html, zona = '-03:00') {
  const t = sinTags(html);
  const f = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const p = (n) => String(n).padStart(2, '0');
  return {
    fecha: f ? `${f[3]}-${p(f[2])}-${p(f[1])}T12:00:00${zona}` : null,
    pruebas: [...new Set([...html.matchAll(/href="(\d+F\d+\.htm)"/gi)].map((m) => m[1]))],
    ultimo: (html.match(/href="([^"]*lastevt\.htm)"/i) || [])[1] || null,
  };
}

/** Puntaje por equipos ("1. Libertador Argentina Master   710   2. …"). Vacío si la jornada no lo publica. */
export function parsePuntajeEquipos(html, esElClub) {
  const t = sinTags(html);
  const i = t.search(/Puntaje .*por Equipos/i);
  if (i < 0) return [];
  const filas = [];
  for (const linea of t.slice(i).split('\n').slice(1)) {
    const pares = [...linea.matchAll(/(\d+)\.\s+(.+?)\s{2,}([\d.]+)(?=\s|$)/g)];
    if (!pares.length) { if (filas.length && linea.trim()) break; continue; }
    for (const m of pares) {
      const equipo = limpiar(m[2]);
      filas.push({ pos: Number(m[1]), equipo, pts: numero(m[3]), esQuilmes: esElClub(equipo) });
    }
  }
  return filas.sort((a, b) => a.pos - b.pos);
}

/** Prueba legible: "Mujeres 20-24 100 CL Metro Estilo de Mariposa FEDERADO" → "Mujeres 20-24 · 100 Mariposa". */
export function nombrePrueba(t) {
  return limpiar(t)
    .replace(/\b(CL|SC|LC)\s+(Metro|Yarda|Yardas)\b/gi, '')
    .replace(/Estilo de |Estilo /gi, '')
    .replace(/\s+(FEDERADOS?|PROMOCIONALES?)$/i, '')
    .replace(/^(Mujeres|Hombres|Mixto)\s+(\d+-\d+|\d+ y más|\d+\+)\s+/i, '$1 $2 · ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Podios y participaciones del club en una página de prueba (pueden venir varias categorías de edad). */
export function parsePrueba(html, sigla) {
  const lineas = sinTags(html).split('\n');
  const podios = [];
  let prueba = null, nadadas = 0;
  for (const l of lineas) {
    const ev = l.match(/^\s*Evento\s+\d+\s+(.+)$/i);
    if (ev) { prueba = nombrePrueba(ev[1]); continue; }
    const m = l.match(/^\s*(\d+|---)\s+(.+?)\s+(\d{2})\s+([A-Za-z]{2,6})\s+(\S+)\s+(\S+)/);
    if (!m || m[4] !== sigla) continue;
    nadadas++;
    const puesto = numero(m[1]);
    if (puesto && puesto <= 3) podios.push({ puesto, nadador: limpiar(m[2]).replace(/,$/, ''), prueba, tiempo: m[6] });
  }
  return { podios, nadadas };
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/** previa: la sección del último quilmes.json, para no volver a bajar jornadas ya leídas. */
export async function leerFenaba(cfg, zona, previa = null) {
  const esElClub = (n) => new RegExp(cfg.nombreClub, 'i').test(n);
  const filtro = new RegExp(cfg.torneo, 'i');
  const lista = (JSON.parse(await texto(`${API}?year=${cfg.temporada}`)).resultados || [])
    .filter((r) => r.isPublished !== false && !r.isDeleted && filtro.test(`${r.nombre} ${r.url}`));
  if (!lista.length) throw new Error(`FENABA: no hay resultados de "${cfg.torneo}" en ${cfg.temporada}`);

  const guardadas = new Map((previa?.jornadas || []).map((j) => [j.url, j]));
  const jornadas = [];
  for (const r of lista) {
    const base = r.url.replace(/^http:/, 'https:').replace(/\/?$/, '/');
    const numJ = numero((`${r.nombre} ${r.url}`.match(/(\d+)\s*°?\s*jornada|jornada\s*(\d+)|-(\d+)\/?$/i) || []).slice(1).find(Boolean));
    if (guardadas.has(base)) { jornadas.push(guardadas.get(base)); continue; }
    const idx = parseIndice(await texto(base + 'evtindex.htm'), zona);
    const equipos = idx.ultimo ? parsePuntajeEquipos(await texto(base + idx.ultimo), esElClub) : [];
    let podios = [], nadadas = 0;
    for (const p of idx.pruebas) {
      const r2 = parsePrueba(await texto(base + p), cfg.sigla);
      podios.push(...r2.podios);
      nadadas += r2.nadadas;
      await pausa(200); // sin apurar al sitio
    }
    const yo = equipos.find((e) => e.esQuilmes);
    jornadas.push({
      url: base,
      numero: numJ,
      nombre: numJ ? `${numJ}ª jornada` : limpiar(r.nombre),
      fecha: idx.fecha,
      puesto: yo?.pos ?? null,
      puntos: yo?.pts ?? null,
      equipos: equipos.length || null,
      tabla: equipos,
      oro: podios.filter((x) => x.puesto === 1).length,
      plata: podios.filter((x) => x.puesto === 2).length,
      bronce: podios.filter((x) => x.puesto === 3).length,
      nadadas,
      podios: podios.sort((a, b) => a.puesto - b.puesto),
    });
  }
  jornadas.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  const conTabla = [...jornadas].reverse().find((j) => j.tabla.length);

  return {
    id: cfg.id,
    deporte: 'natacion',
    deporteNombre: cfg.deporteNombre,
    titulo: cfg.titulo,
    competencia: cfg.competencia,
    descripcion: cfg.descripcion,
    fuente: 'FENABA',
    tabla: conTabla ? { nombre: `${conTabla.nombre} · puntaje por equipos`, columnas: ['pts'], filas: conTabla.tabla } : null,
    jornadas,
    partidos: [],
  };
}
