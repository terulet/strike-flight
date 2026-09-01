/**
 * difficulty-bench.ts
 *
 * Informe del banco de dificultad, sin navegador. `npm run bench`.
 */

import { buildCanyonRun } from '../src/tracks/CanyonRun';
import { PilotSkill, runProfile, summarise } from '../src/tools/DifficultyBench';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const SKILLS: PilotSkill[] = ['descuidado', 'competente', 'perfecto'];

const misiones = [{ nombre: 'M01 CANYON RUN', track: buildCanyonRun() }];

for (const mision of misiones) {
  console.log('');
  console.log(`=== ${mision.nombre}  (${SEEDS.length} semillas por perfil)`);
  console.log('perfil       llega   t.medio  mejor   cadena  flow  turbos  linea RUSH  err.angulo  P/G/R/B/C');
  for (const skill of SKILLS) {
    const runs = runProfile(mision.track, skill, SEEDS, { mission: mision.nombre });
    const s = summarise(runs);
    const l = s.landings;
    console.log(
      skill.padEnd(12),
      `${(s.completionRate * 100).toFixed(0)}%`.padStart(5),
      (s.meanTime === null ? '  -  ' : s.meanTime.toFixed(1) + 's').padStart(9),
      (s.bestTime === null ? '  -  ' : s.bestTime.toFixed(1) + 's').padStart(7),
      s.meanBestCombo.toFixed(1).padStart(7),
      s.meanMaxFlow.toFixed(0).padStart(5),
      s.meanBoosts.toFixed(1).padStart(7),
      `${(s.rushLineRate * 100).toFixed(0)}%`.padStart(11),
      `${(s.meanAngleError * 57.3).toFixed(1)}deg`.padStart(11),
      `  ${l.PERFECT}/${l.GOOD}/${l.ROUGH}/${l.BAD}/${l.CRASH}`,
    );
  }
  const descuidado = runProfile(mision.track, 'descuidado', SEEDS, { mission: mision.nombre });
  const causas = new Map<string, number>();
  for (const run of descuidado) {
    if (!run.failure) continue;
    causas.set(run.failure, (causas.get(run.failure) ?? 0) + 1);
  }
  if (causas.size > 0) {
    console.log('  por que se pierde el descuidado:');
    for (const [causa, veces] of [...causas].sort((a, b) => b[1] - a[1])) {
      console.log(`    x${veces}  ${causa}`);
    }
  }
}
console.log('');
