// Fútbol: páginas estáticas que AFA publica en info.afa.org.ar (DataFactory).
import * as cheerio from 'cheerio';
import { fetchText, limpiar, numero, aISO } from '../lib/util.js';

const BASE = 'https://info.afa.org.ar/deposito/html/v3/htmlCenter/data/deportes/futbol';

/** Devuelve todas las zonas de la tabla de posiciones. */
export function parsePosiciones(html) {
  const $ = cheerio.load(html);
  const grupos = [];
  let actual = null;
  $('table.tabla_fase').first().find('thead, tr.linea').each((_, el) => {
    const $el = $(el);
    if (el.tagName === 'thead') {
      actual = { nombre: limpiar($el.find('th.text-center').first().text()) || 'Tabla', filas: [] };
      grupos.push(actual);
      return;
    }
    if (!actual) {
      actual = { nombre: 'Tabla', filas: [] };
      grupos.push(actual);
    }
    const stats = $el.find('td.d-sm-table-cell').map((__, td) => numero($(td).text())).get();
    const link = $el.find('td.team a');
    actual.filas.push({
      pos: numero($el.find('td.pos').text()),
      equipo: limpiar(link.text()),
      equipoId: numero(link.attr('data-team-id')),
      pts: numero($el.find('td.puntos').text()),
      pj: stats[0], pg: stats[1], pe: stats[2], pp: stats[3], gf: stats[4], gc: stats[5], dif: stats[6],
    });
  });
  return grupos;
}

/** Devuelve los partidos de un equipo (por id) en el fixture. */
export function parseFixture(html, equipoId, zona = '-03:00') {
  const $ = cheerio.load(html);
  const partidos = [];
  $('.mc-matchContainer').each((_, el) => {
    const $m = $(el);
    let equipos;
    try {
      equipos = JSON.parse($m.attr('data-teams') || '{}');
    } catch {
      return;
    }
    if (equipos.home !== equipoId && equipos.away !== equipoId) return;
    const nombre = (lado) =>
      limpiar($m.find(`.${lado} .escudo img`).attr('alt')) || limpiar($m.find(`.${lado} .equipo`).text());
    const goles = (lado) => numero($m.find(`.${lado} .resultado .badge`).first().text());
    const clase = $m.attr('class') || '';
    const estado = limpiar($m.find('.estado').text());
    const jugado = /status-finished/.test(clase) || /finalizado/i.test(estado);
    partidos.push({
      fecha: aISO($m.attr('data-originaldate'), $m.attr('data-stadiumgmt') || zona),
      ronda: limpiar($m.closest('.fecha').find('.subHeader').first().text()) || null,
      local: nombre('local'),
      visitante: nombre('visitante'),
      esLocal: equipos.home === equipoId,
      gl: goles('local'),
      gv: goles('visitante'),
      jugado,
      estado: estado || (jugado ? 'Finalizado' : 'Programado'),
    });
  });
  return partidos.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
}

export async function leerAfa(cfg, zona) {
  const [posHtml, fixHtml] = await Promise.all([
    fetchText(`${BASE}/${cfg.canal}/pages/es/posiciones.html`),
    fetchText(`${BASE}/${cfg.canal}/pages/es/fixture.html`),
  ]);
  const grupos = parsePosiciones(posHtml);
  const grupo = grupos.find((g) => g.filas.some((f) => f.equipoId === cfg.equipoId));
  if (!grupo) throw new Error('AFA: no encontré a Quilmes en la tabla de posiciones');
  const partidos = parseFixture(fixHtml, cfg.equipoId, zona);
  if (partidos.length === 0) throw new Error('AFA: no encontré partidos de Quilmes en el fixture');
  return {
    id: cfg.id,
    deporte: 'futbol',
    titulo: cfg.titulo,
    competencia: cfg.competencia,
    fuente: 'AFA',
    tabla: {
      nombre: grupo.nombre,
      columnas: ['pts', 'pj', 'pg', 'pe', 'pp', 'gf', 'gc', 'dif'],
      filas: grupo.filas.map((f) => ({ ...f, esQuilmes: f.equipoId === cfg.equipoId })),
    },
    partidos,
  };
}
