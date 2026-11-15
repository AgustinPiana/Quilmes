// Básquet: FEBAMBA (www.febamba.com). Fixture por rango de fechas y tabla por fase/grupo.
import * as cheerio from 'cheerio';
import { fetchText, fetchJson, limpiar, numero, aISO, diaRelativo } from '../lib/util.js';

const BASE = 'https://www.febamba.com';

const urlSubPagina = (cfg, { seccion, fechaIni = '', fechaFin = '', faseId = 0, grupoId = 0 }) =>
  `${BASE}/detalle-torneo?handler=CargarSubPagina&competicionId=${cfg.competicionId}` +
  `&compCatId=${cfg.compCatId}&fechaIni=${fechaIni}&fechaFin=${fechaFin}` +
  `&faseId=${faseId}&grupoId=${grupoId}&seccion=${seccion}`;

const absoluta = (src) => (src ? new URL(src, BASE).href : null);

export function parseFixture(html, nombreEquipo, zona = '-03:00') {
  const $ = cheerio.load(html);
  const partidos = [];
  $('tr.fila-tabla-calendarios').each((_, el) => {
    const $r = $(el);
    const nombres = $r.find('.nombre-equipo').map((__, n) => limpiar($(n).text())).get();
    if (nombres.length < 2 || !nombres.includes(nombreEquipo)) return;
    const [gl, gv] = $r.find('td.resultados').map((__, td) => numero($(td).text())).get();
    const escudos = $r.find('.celda-escudo img').map((__, i) => absoluta($(i).attr('src'))).get();
    const jugado = gl != null && gv != null && !(gl === 0 && gv === 0);
    partidos.push({
      fecha: aISO($r.find('.fecha-campo strong').text(), zona),
      ronda: null,
      local: nombres[0],
      visitante: nombres[1],
      esLocal: nombres[0] === nombreEquipo,
      gl: jugado ? gl : null,
      gv: jugado ? gv : null,
      jugado,
      estado: jugado ? 'Finalizado' : 'Programado',
      lugar: limpiar($r.find('.fecha-campo small').text()) || null,
      escudoLocal: escudos[0] || null,
      escudoVisitante: escudos[1] || null,
    });
  });
  return partidos.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
}

export function parseTabla(html, nombreEquipo) {
  const $ = cheerio.load(html);
  const filas = [];
  $('tr.datos-estadisticos').each((_, el) => {
    const tds = $(el).find('td');
    if (tds.length < 9) return;
    const img = $(tds[1]).find('img');
    const equipo = limpiar(img.attr('title')) || limpiar($(tds[1]).text());
    const v = (i) => numero($(tds[i]).text());
    filas.push({
      pos: v(0), equipo, pj: v(2), pg: v(3), pp: v(4), pf: v(5), pc: v(6), pts: v(7), pct: v(8),
      escudo: absoluta(img.attr('src')),
      esQuilmes: equipo === nombreEquipo,
    });
  });
  return filas;
}

/** Recorre fases (de la más reciente a la más vieja) y devuelve el primer grupo donde está el equipo. */
async function buscarTabla(cfg) {
  const fases = await fetchJson(`${BASE}/api/clasificacion/${cfg.compCatId}/fases`);
  for (const fase of fases || []) {
    const grupos = await fetchJson(`${BASE}/api/clasificacion/${fase.idFase}/grupos`);
    for (const grupo of grupos || []) {
      const html = await fetchText(urlSubPagina(cfg, { seccion: 'tabla-posiciones', faseId: fase.idFase, grupoId: grupo.idGrupo }));
      if (!html.includes(cfg.nombreEquipo)) continue;
      return { nombre: `${limpiar(fase.nombre)} · ${limpiar(grupo.nombre)}`, filas: parseTabla(html, cfg.nombreEquipo) };
    }
  }
  return null;
}

export async function leerFebamba(cfg, zona) {
  const fixHtml = await fetchText(
    urlSubPagina(cfg, { seccion: 'fixture', fechaIni: diaRelativo(-cfg.diasAtras), fechaFin: diaRelativo(cfg.diasAdelante) }),
  );
  const partidos = parseFixture(fixHtml, cfg.nombreEquipo, zona);
  const tabla = await buscarTabla(cfg);
  if (!tabla && partidos.length === 0) throw new Error('FEBAMBA: no encontré datos del QAC');
  return {
    id: cfg.id,
    deporte: 'basquet',
    titulo: cfg.titulo,
    competencia: cfg.competencia,
    fuente: 'FEBAMBA',
    tabla: tabla && { nombre: tabla.nombre, columnas: ['pts', 'pj', 'pg', 'pp', 'pf', 'pc'], filas: tabla.filas },
    partidos,
  };
}
