import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fechaISO, parseTabla, fechasDeTorneo, parsePartidos } from '../scripts/sources/datafem.js';

// Misma estructura que datafem.com.ar (noviembre 2026), sin las clases de Tailwind.
const tabla = `<div><h2>Zona A</h2><div><table>
  <thead><tr><th>Pos.</th><th>Equipo</th><th>Pts.</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>DG</th></tr></thead>
  <tbody>
    <tr><td>1</td><td><a href="/equipos/quilmes"><span>Quilmes</span></a></td><td>54</td><td>20</td><td>17</td><td>3</td><td>0</td><td>+49</td></tr>
    <tr><td>2</td><td><a href="/equipos/chacarita-juniors"><span>Chacarita</span></a></td><td>49</td><td>20</td><td>16</td><td>1</td><td>3</td><td>+35</td></tr>
  </tbody></table></div></div>
  <div><h2>Zona B</h2><div><table><thead><tr><th>Pos.</th><th>Equipo</th></tr></thead><tbody></tbody></table></div></div>`;

const partido = (cancha, hora, estado, loc, gl, gv, vis) => `<div><div>${cancha}</div><div><span>${hora}</span><span>${estado}</span></div>
  <div><a href="/equipos/${loc[0]}"><span>${loc[1]}</span><div></div></a><div><div><span>${gl}</span><span>v</span><span>${gv}</span></div></div><a href="/equipos/${vis[0]}"><div></div><span>${vis[1]}</span></a></div></div>`;

const fixture = `<a href="/primera-c?temporada=2026&amp;seccion=fixture&amp;torneo=zona-a&amp;fecha=1">1</a>
  <a href="/primera-c?temporada=2026&amp;seccion=fixture&amp;torneo=zona-a&amp;fecha=22">22</a>
  <div><h3>Domingo, 1 de noviembre de 2026</h3>
  ${partido('Estadio Ricardo Puga', '10:00', 'Finalizado', ['atlas', 'Atlas'], 2, 2, ['quilmes', 'Quilmes'])}
  ${partido('Estadio Ricardo Puga', '10:00', 'Finalizado', ['atlas', 'Atlas'], 2, 2, ['quilmes', 'Quilmes'])}
  ${partido('Speed Camp', '11:00', 'Finalizado', ['deportivo-riestra', 'Dep. Riestra'], 0, 2, ['chacarita-juniors', 'Chacarita'])}
  </div>`;

test('datafem: fecha en castellano a ISO', () => {
  assert.equal(fechaISO('Sábado, 14 de noviembre de 2026', '15:00'), '2026-11-14T15:00:00-03:00');
  assert.equal(fechaISO('A confirmar', '15:00'), null);
});

test('datafem: tabla de la zona pedida', () => {
  const t = parseTabla(tabla, 'Zona A', 'quilmes');
  assert.equal(t.filas.length, 2);
  assert.deepEqual(t.filas[0], { pos: 1, equipo: 'Quilmes', equipoId: 'quilmes', pts: 54, pj: 20, pg: 17, pe: 3, pp: 0, dif: 49, esQuilmes: true });
});

test('datafem: fechas del selector y partidos sin duplicados', () => {
  assert.deepEqual(fechasDeTorneo(fixture, 'zona-a'), [1, 22]);
  const p = parsePartidos(fixture, 'quilmes', { ronda: 'Fecha 22' });
  assert.equal(p.length, 1, 'solo el de Quilmes y una sola vez');
  assert.deepEqual(p[0], {
    fecha: '2026-11-01T10:00:00-03:00', ronda: 'Fecha 22', local: 'Atlas', visitante: 'Quilmes',
    esLocal: false, gl: 2, gv: 2, jugado: true, estado: 'Finalizado', lugar: 'Estadio Ricardo Puga',
  });
});
