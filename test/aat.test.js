import { test } from 'node:test';
import assert from 'node:assert/strict';
import { llaves, crucesDelClub, datosDelGrupo, club } from '../scripts/sources/aat.js';

// Forma real del HTML de las llaves de deportivoaat.com.ar (mal formado a propósito: <h2> suelto).
const celda = (txt) => `<tr ><td class=llave> ${txt}</td></tr><tr ><td class=entreLlave>&nbsp;</td></tr>`;
const eq = (n, lado = '') => `<a href=../app/vEquipo.php?idEquipo=1>${n}</a>${lado ? ` (${lado})` : ''}`;
const gan = (n, lado, s) => `<a href=../app/vEquipo.php?idEquipo=1>${n}${lado ? ` (${lado})` : ''}</a><br/><a href=../app/vSerie.php?idSerie=9>Score: ${s} </a>`;
const ronda = (...c) => `<td><table align=center>${c.map(celda).join('')}</table></td>`;
const html = `<tr><td><h2> Llave Campeonato </h2></td></tr><table id=Campeonato><tr>
  ${ronda(eq('GIMNASIA-A'), 'Bye', eq('QUILMES ATLETICO-A', 'L'), eq('BANCO PROV.DE BS. AS.-A', 'V'))}
  ${ronda(eq('GIMNASIA-A', 'L'), gan('BANCO PROV.DE BS. AS.-A', 'V', '3-0'))}
  ${ronda(gan('GIMNASIA-A', '', '2-1'))}
</tr></table> Imprimir Todos los Grupos/Zonas`;

test('aat: nombre del club sin la letra del equipo', () => {
  assert.equal(club('QUILMES ATLETICO-A'), 'QUILMES ATLETICO');
  assert.equal(club('SOC.ITALIANA (SITAS)-A (V)'), 'SOC.ITALIANA (SITAS)');
});

test('aat: el score de la llave es del ganador (Quilmes local perdió 0-3)', () => {
  const ll = llaves(html);
  assert.deepEqual(ll.map((l) => [l.nombre, l.rondas.map((r) => r.length)]), [['Llave Campeonato', [4, 2, 1]]]);
  const c = crucesDelClub(ll, 'QUILMES ATLETICO');
  assert.equal(c.length, 1);
  assert.deepEqual(
    { local: c[0].local, visitante: c[0].visitante, esLocal: c[0].esLocal, gl: c[0].gl, gv: c[0].gv, ronda: c[0].ronda },
    { local: 'QUILMES ATLETICO', visitante: 'BANCO PROV.DE BS. AS.', esLocal: true, gl: 0, gv: 3, ronda: 'Llave Campeonato · Semifinal' },
  );
});

test('aat: tabla y series del grupo (números como texto o número)', () => {
  const d = datosDelGrupo({
    posiciones: [{ equipo: 'QUILMES ATLETICO-A', puntos: 11, seriesJugadas: '6', seriesGanadas: 5, difSet: '+15', difGame: '+49' }],
    series: [{ Grupo: 'D', fec: '2026-03-15', Hora: '12:30', nombreEntL: 'LUJAN TENNIS CLUB', nombreEntV: 'QUILMES ATLETICO', puntosL: '2', puntosV: '1', wo: '0' }],
  }, 'QUILMES ATLETICO', 'D');
  assert.deepEqual(d.filas[0], { pos: 1, equipo: 'QUILMES ATLETICO', pts: 11, pj: 6, pg: 5, pp: 1, dif: 15, dg: 49, esQuilmes: true });
  assert.deepEqual(
    { fecha: d.partidos[0].fecha, esLocal: d.partidos[0].esLocal, gl: d.partidos[0].gl, gv: d.partidos[0].gv, jugado: d.partidos[0].jugado },
    { fecha: '2026-03-15T12:30:00-03:00', esLocal: false, gl: 2, gv: 1, jugado: true },
  );
});
