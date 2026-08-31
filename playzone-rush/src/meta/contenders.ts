/**
 * De donde salen los rivales.
 *
 * El ranking no sabe si compites contra personas o contra bots: recibe una
 * lista de contendientes y los ordena. Eso permite que el modo "PROBAR SOLO"
 * siga funcionando exactamente igual que antes, sin backend, y que el modo
 * grupo use jugadores reales sin duplicar la logica.
 */
import { hashString } from '../core/rng';
import type { SaveManager } from '../core/save';
import type { GroupSnapshot } from '../net/types';
import type { DailyPlan } from './daily';
import { botStandings, rankedChallenges, type Standing } from './ranking';

export { botStandings };

/** Paleta para jugadores reales: color estable derivado de su id. */
const PLAYER_COLORS = [
  '#ff6b6b',
  '#22d3ee',
  '#f472b6',
  '#a3e635',
  '#a78bfa',
  '#fbbf24',
  '#38bdf8',
  '#fb7185',
];

export function colorForPlayer(playerId: string): string {
  return PLAYER_COLORS[hashString(playerId) % PLAYER_COLORS.length] as string;
}

/** Rivales de verdad, sacados de la foto del grupo. No incluye al jugador. */
export function remoteStandings(
  snapshot: GroupSnapshot,
  myPlayerId: string | null,
  plan: DailyPlan,
  secretUnlocked: boolean,
): Standing[] {
  const rankedIds = new Set(rankedChallenges(plan, secretUnlocked).map((spec) => spec.id));
  const byPlayer = new Map<string, Record<string, number>>();

  for (const row of snapshot.scores) {
    if (!row.countsForRanking || !rankedIds.has(row.challengeId)) continue;
    const entry = byPlayer.get(row.playerId) ?? {};
    entry[row.challengeId] = row.bestScore;
    byPlayer.set(row.playerId, entry);
  }

  return snapshot.members
    .filter((member) => member.id !== myPlayerId)
    .map((member) => {
      const perChallenge = byPlayer.get(member.id) ?? {};
      const total = Object.values(perChallenge).reduce((sum, value) => sum + value, 0);
      return {
        id: member.id,
        name: member.name,
        color: colorForPlayer(member.id),
        isMe: false,
        total,
        perChallenge,
        played: member.completedDaily,
        online: member.online,
        activeToday: member.activeToday,
      };
    });
}

/**
 * Mi marca en un reto: la mejor entre lo que tengo guardado en el movil y lo
 * que sabe el servidor. Asi la puntuacion aparece al instante aunque el envio
 * todavia este en la cola, y nunca baja por un desfase de sincronizacion.
 */
export function myBestFor(
  save: SaveManager,
  dayKey: string,
  challengeId: string,
  snapshot: GroupSnapshot | null,
  myPlayerId: string | null,
): number {
  const progress = save.get().days[dayKey]?.challenges[challengeId];
  const local = progress?.bestScore ?? 0;
  // Una apuesta sustituye la marca, tambien cuando se pierde. Mientras ese
  // reenvio esta offline, el snapshot remoto conserva la marca antigua y un
  // MAX() la resucitaria. Tras apostar, local es la ultima palabra.
  if (progress?.apuesta) return local;
  if (!snapshot || !myPlayerId) return local;
  const remote =
    snapshot.scores.find((row) => row.playerId === myPlayerId && row.challengeId === challengeId)
      ?.bestScore ?? 0;
  return Math.max(local, remote);
}
