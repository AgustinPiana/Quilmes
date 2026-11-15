import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as afa from '../scripts/sources/afa.js';
import * as febamba from '../scripts/sources/febamba.js';
import { normalizarHockey } from '../scripts/sources/ahba.js';
import { fechaCortaAISO } from '../scripts/lib/util.js';

const fx = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');

test('AFA: tabla separa zonas y encuentra a Quilmes en la Zona B', () => {
  const grupos = afa.parsePosiciones(fx('afa-posiciones.html'));
  assert.deepEqual(grupos.map((g) => g.nombre), ['Zona A', 'Zona B']);
  const q = grupos[1].filas.find((f) => f.equipoId === 15);
  assert.deepEqual(q, { pos: 13, equipo: 'Quilmes', equipoId: 15, pts: 45, pj: 36, pg: 12, pe: 9, pp: 15, gf: 33, gc: 30, dif: 3 });
  assert.equal(grupos[1].filas[0].dif, -8);
});

test('AFA: fixture devuelve solo partidos de Quilmes, con ronda, resultado y estado', () => {
  const p = afa.parseFixture(fx('afa-fixture.html'), 15);
  assert.equal(p.length, 2);
  assert.deepEqual(p[0], {
    fecha: '2026-02-16T17:00:00-03:00', ronda: 'Fecha 1', local: 'Atlanta', visitante: 'Quilmes',
    esLocal: false, gl: 1, gv: 0, jugado: true, estado: 'Finalizado',
  });
  assert.equal(p[1].ronda, 'Fecha 36');
  assert.equal(p[1].visitante, 'Gimnasia y Tiro');
  assert.equal(p[1].jugado, false);
  assert.equal(p[1].gl, null);
  assert.equal(p[1].esLocal, true);
});

test('FEBAMBA: fixture filtra al QAC y distingue jugado de programado', () => {
  const p = febamba.parseFixture(fx('febamba-fixture.html'), 'QUILMES ATLETICO CLUB');
  assert.equal(p.length, 2);
  assert.equal(p[0].fecha, '2026-11-02T20:30:00-03:00');
  assert.equal(p[0].local, 'LANUS');
  assert.equal(p[0].gl, 82);
  assert.equal(p[0].gv, 71);
  assert.equal(p[0].jugado, true);
  assert.equal(p[0].escudoVisitante, 'https://www.febamba.com/escudos/82/94325');
  assert.equal(p[1].jugado, false);
  assert.equal(p[1].gl, null);
  assert.equal(p[1].lugar, 'Quilmes A.C. Sede Central');
});

test('FEBAMBA: tabla de posiciones', () => {
  const f = febamba.parseTabla(fx('febamba-tabla.html'), 'QUILMES ATLETICO CLUB');
  assert.equal(f.length, 2);
  const q = f.find((x) => x.esQuilmes);
  assert.equal(q.pos, 8);
  assert.equal(q.pts, 17);
  assert.equal(q.pct, 41.6);
  assert.equal(q.pf, 813);
});

test('Hockey: normaliza partidos y tabla leídos de la página', () => {
  const n = normalizarHockey(
    {
      titulo: 'Caballeros A',
      subtitulo: '2026 - Primera - A - Masculino',
      crudos: [
        { ronda: 'Fecha 1', fecha: 'dom 08 mar 16:00', local: 'LOMAS', visitante: 'QUILMES', gl: '0', gv: '2' },
        { ronda: 'Fecha 20', fecha: 'mié 23 sept 21:30', local: 'HURLING', visitante: 'QUILMES', gl: '1', gv: '0' },
        { ronda: 'Fecha 27', fecha: 'dom 06 dic 16:00', local: 'QUILMES', visitante: 'MITRE', gl: null, gv: null },
      ],
      grilla: [
        ['#', 'Club', 'PTS', 'PJ', 'PG', 'PE', 'PP', 'GF', 'GC', 'DF', 'PB', ''],
        ['1', 'SAN FERNANDO', '63', '26', '19', '6', '1', '76', '25', '51', '0', ''],
        ['10', 'QUILMES', '27', '26', '6', '9', '11', '52', '68', '-16', '0', ''],
      ],
    },
    'QUILMES',
  );
  assert.equal(n.partidos.length, 3);
  assert.equal(n.partidos[0].fecha, '2026-03-08T16:00:00-03:00');
  assert.equal(n.partidos[1].fecha, '2026-09-23T21:30:00-03:00');
  assert.equal(n.partidos[0].jugado, true);
  assert.equal(n.partidos[2].jugado, false);
  assert.equal(n.partidos[2].esLocal, true);
  const q = n.filas.find((f) => f.esQuilmes);
  assert.deepEqual(q, { pos: 10, equipo: 'QUILMES', pts: 27, pj: 26, pg: 6, pe: 9, pp: 11, gf: 52, gc: 68, dif: -16, esQuilmes: true });
});

test('Fechas cortas en castellano', () => {
  assert.equal(fechaCortaAISO('lun 12 oct 14:00', '2026'), '2026-10-12T14:00:00-03:00');
  assert.equal(fechaCortaAISO('sáb 10 oct 16:00', '2026'), '2026-10-10T16:00:00-03:00');
  assert.equal(fechaCortaAISO('sin fecha', '2026'), null);
});
