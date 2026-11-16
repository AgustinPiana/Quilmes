import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datosDePagina, nombreEquipo, parsePartidosEquipo, parseTablaLiga } from '../scripts/sources/promiedos.js';

// Fragmentos con la misma forma que el __NEXT_DATA__ real de Promiedos (noviembre 2026).
const pagina = (data) => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { data } } })}</script></html>`;
const Q = { name: 'Quilmes AC (Reserva)', id: 'jdeca' };
const juego = (fecha, ronda, loc, vis, scores, fin) => ({
  game: { stage_round_name: ronda, teams: [loc, vis], scores, start_time: fecha, status: fin ? { enum: 3, name: 'Finalizado' } : { enum: 1, name: 'Prog.' } },
});

const equipo = {
  games: {
    last: { rows: [
      juego('18-06-2026 15:00', 'Fecha 18', Q, { name: 'Banfield (Reserva)', id: 'b' }, [6, 1], true),
      juego('13-07-2026 15:00', 'Fecha 1', Q, { name: 'Lanús (Reserva)', id: 'l' }, [1, 0], true),
      juego('04-11-2026 15:00', 'Fecha 2', { name: 'Deportivo Riestra (Reserva)', id: 'r' }, Q, [2, 4], true),
    ] },
    next: { rows: [juego('17-11-2026 17:00', 'Fecha 3', { name: 'San Martín SJ (Reserva)', id: 's' }, Q, [], false)] },
  },
};

const liga = {
  tables_groups: [{
    name: 'Clausura',
    tables: [
      { name: 'Grupo A', table: { rows: [{ num: 1, values: [], entity: { object: { name: 'Otro', id: 'x' } } }] } },
      { name: 'Grupo B', table: { rows: [
        { num: 1, values: [{ key: 'Points', value: '38' }, { key: 'GamePlayed', value: '17' }, { key: 'Goals', value: '37:14' }, { key: 'Ratio', value: '23' }, { key: 'GamesWon', value: '11' }, { key: 'GamesEven', value: '5' }, { key: 'GamesLost', value: '1' }], entity: { object: { name: 'Independiente (Reserva)', id: 'i' } } },
        { num: 12, values: [{ key: 'Points', value: '20' }, { key: 'GamePlayed', value: '17' }, { key: 'Goals', value: '16:21' }, { key: 'Ratio', value: '-5' }, { key: 'GamesWon', value: '5' }, { key: 'GamesEven', value: '5' }, { key: 'GamesLost', value: '7' }], entity: { object: Q } },
      ] } },
    ],
  }],
};

test('promiedos: limpia los nombres de reserva', () => {
  assert.equal(nombreEquipo('Quilmes AC (Reserva)'), 'Quilmes');
  assert.equal(nombreEquipo('Lanús (Reserva)'), 'Lanús');
});

test('promiedos: partidos del torneo en curso, con local y goles bien puestos', () => {
  const p = parsePartidosEquipo(datosDePagina(pagina(equipo)), 'jdeca');
  assert.equal(p.length, 3, 'descarta la Fecha 18 del torneo anterior');
  assert.deepEqual(
    { fecha: p[1].fecha, local: p[1].local, visitante: p[1].visitante, esLocal: p[1].esLocal, gl: p[1].gl, gv: p[1].gv, jugado: p[1].jugado },
    { fecha: '2026-11-04T15:00:00-03:00', local: 'Deportivo Riestra', visitante: 'Quilmes', esLocal: false, gl: 2, gv: 4, jugado: true },
  );
  assert.equal(p[2].jugado, false);
  assert.equal(p[2].gl, null);
});

test('promiedos: tabla del grupo donde está Quilmes', () => {
  const t = parseTablaLiga(datosDePagina(pagina(liga)), 'jdeca');
  assert.equal(t.nombre, 'Clausura · Grupo B');
  const q = t.filas.find((f) => f.esQuilmes);
  assert.deepEqual({ pos: q.pos, equipo: q.equipo, pts: q.pts, pj: q.pj, gf: q.gf, gc: q.gc, dif: q.dif }, { pos: 12, equipo: 'Quilmes', pts: 20, pj: 17, gf: 16, gc: 21, dif: -5 });
});
