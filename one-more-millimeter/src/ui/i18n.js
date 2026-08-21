/**
 * i18n — every string the player sees comes from here. English ships as the base,
 * Spanish is complete. Missing keys fall back to English, then to the key itself.
 */
const EN = {
  'app.title1': 'ONE MORE',
  'app.title2': 'MILLIMETER',
  'home.play': 'PLAY',
  'home.best': 'BEST',
  'home.today': 'TODAY',
  'home.noScore': 'NO SCORE YET',
  'home.rank': '#{rank}',
  'home.quick': 'QUICK PLAY',
  'home.three': '3 SHOTS',
  'home.daily': 'DAILY',
  'home.beat': 'BEAT THE SCORE',
  'home.ranking': 'RANKING',
  'home.stats': 'STATS',
  'home.settings': 'SETTINGS',
  'home.tagline': 'STOP IT AS CLOSE TO THE EDGE AS YOU CAN.',

  'hud.target': 'TARGET',
  'hud.attempt': 'ATTEMPT {n}/{total}',
  'hud.finalShot': 'FINAL SHOT',
  'hud.best': 'BEST',
  'hud.leader': 'LEADER',
  'hud.you': 'YOU',
  'hud.noTarget': 'FREE RUN',

  'prompt.hold': 'HOLD',
  'prompt.release': 'RELEASE',
  'prompt.tapToStart': 'TAP AND HOLD',

  'result.newBest': 'NEW BEST',
  'result.newRecord': 'NEW RECORD',
  'result.tooFar': 'TOO FAR',
  'result.pastEdge': '{d} mm PAST THE EDGE',
  'result.soClose': 'SO CLOSE',
  'result.onTheBrink': 'ON THE BRINK',
  'result.hanging': 'HANGING {d} mm OVER',
  'result.beaten': '{name} BEATEN BY {d} mm',
  'result.stillLeads': '{name} STILL LEADS',
  'result.toBeat': '{d} mm TO BEAT',
  'result.tookFirst': 'YOU TOOK #1',
  'result.stillFirst': 'YOUR RECORD SURVIVED',
  'result.tie': 'DEAD HEAT WITH {name}',
  'result.you': 'YOU',
  'result.absurd': 'THAT IS NOT HUMAN',
  'result.finalBest': 'BEST OF 3',
  'result.noScore': 'NO SCORE',

  'btn.again': 'AGAIN',
  'btn.revenge': 'REVENGE',
  'btn.nextRival': 'NEXT RIVAL',
  'btn.oneMore': 'ONE MORE',
  'btn.retry': 'RETRY',
  'btn.done': 'DONE',
  'btn.home': 'HOME',
  'btn.close': 'CLOSE',
  'btn.newSetup': 'NEW SETUP',
  'btn.share': 'SHARE',
  'btn.play': 'PLAY',

  'zone.legendary': 'LEGENDARY',
  'zone.elite': 'ELITE',
  'zone.insane': 'INSANE',
  'zone.great': 'GREAT',
  'zone.good': 'GOOD',
  'zone.safe': 'SAFE',
  'zone.fall': 'FALL',

  'stats.title': 'STATS',
  'stats.best': 'BEST',
  'stats.attempts': 'ATTEMPTS',
  'stats.falls': 'FALLS',
  'stats.closeCalls': 'CLOSE CALLS',
  'stats.nearMisses': 'NEAR MISSES',
  'stats.rivalsBeaten': 'RIVALS BEATEN',
  'stats.streak': 'CURRENT STREAK',
  'stats.bestStreak': 'BEST STREAK',
  'stats.eliteZone': 'ELITE ZONE',
  'stats.reset': 'RESET SAVE',
  'stats.resetConfirm': 'TAP AGAIN TO WIPE',

  'rank.title': 'RANKING',
  'rank.today': "TODAY'S CHALLENGE",
  'rank.you': 'YOU',
  'rank.empty': 'PLAY A SHOT TO ENTER',

  'set.title': 'SETTINGS',
  'set.lang': 'LANGUAGE',
  'set.sound': 'SOUND',
  'set.haptics': 'VIBRATION',
  'set.shake': 'SCREEN SHAKE',
  'set.reduceFx': 'REDUCE EFFECTS',
  'set.contrast': 'HIGH CONTRAST',
  'set.on': 'ON',
  'set.off': 'OFF',
  'set.keys': 'SPACE OR CLICK TO PLAY',

  'mode.quick': 'QUICK PLAY',
  'mode.three': 'THREE SHOTS',
  'mode.daily': 'DAILY CHALLENGE',
  'mode.beat': 'BEAT THE SCORE',
  'mode.dailyDone': "TODAY'S RUN IS DONE",
  'mode.dailyBest': "TODAY: {d} mm",

  'unlock.title': 'UNLOCKED',
  'unlock.sub': '{name} IS YOURS',

  'share.title': 'ONE MORE MILLIMETER',
  'share.rank': '#{rank} IN THE GROUP',
  'share.beat': 'BEAT THAT.',

  'social.tookFirst': '{name} TOOK YOUR #1',
  'social.beatYou': '{name} BEAT YOU BY {d} mm',
  'social.survived': 'YOUR RECORD SURVIVED',
  'social.ahead': '{n} FRIENDS ARE AHEAD OF YOU',
  'social.revenge': 'REVENGE AVAILABLE',
};

const ES = {
  'app.title1': 'UN MILÍMETRO',
  'app.title2': 'MÁS',
  'home.play': 'JUGAR',
  'home.best': 'MEJOR',
  'home.today': 'HOY',
  'home.noScore': 'SIN MARCA',
  'home.rank': '#{rank}',
  'home.quick': 'PARTIDA RÁPIDA',
  'home.three': '3 TIROS',
  'home.daily': 'DIARIO',
  'home.beat': 'SUPERA LA MARCA',
  'home.ranking': 'RANKING',
  'home.stats': 'DATOS',
  'home.settings': 'AJUSTES',
  'home.tagline': 'DÉJALO LO MÁS CERCA DEL BORDE QUE PUEDAS.',

  'hud.target': 'OBJETIVO',
  'hud.attempt': 'TIRO {n}/{total}',
  'hud.finalShot': 'ÚLTIMO TIRO',
  'hud.best': 'MEJOR',
  'hud.leader': 'LÍDER',
  'hud.you': 'TÚ',
  'hud.noTarget': 'LIBRE',

  'prompt.hold': 'MANTÉN',
  'prompt.release': 'SUELTA',
  'prompt.tapToStart': 'MANTÉN PULSADO',

  'result.newBest': 'NUEVO RÉCORD',
  'result.newRecord': 'NUEVO RÉCORD',
  'result.tooFar': 'TE PASASTE',
  'result.pastEdge': '{d} mm DE MÁS',
  'result.soClose': 'POR POCO',
  'result.onTheBrink': 'AL BORDE',
  'result.hanging': 'ASOMANDO {d} mm',
  'result.beaten': '{name} SUPERADO POR {d} mm',
  'result.stillLeads': '{name} SIGUE GANANDO',
  'result.toBeat': 'TE FALTAN {d} mm',
  'result.tookFirst': 'ERES EL #1',
  'result.stillFirst': 'TU RÉCORD AGUANTA',
  'result.tie': 'EMPATE CON {name}',
  'result.you': 'TÚ',
  'result.absurd': 'ESO NO ES HUMANO',
  'result.finalBest': 'MEJOR DE 3',
  'result.noScore': 'SIN MARCA',

  'btn.again': 'OTRA',
  'btn.revenge': 'REVANCHA',
  'btn.nextRival': 'SIGUIENTE RIVAL',
  'btn.oneMore': 'UNA MÁS',
  'btn.retry': 'REINTENTAR',
  'btn.done': 'LISTO',
  'btn.home': 'INICIO',
  'btn.close': 'CERRAR',
  'btn.newSetup': 'OTRO RETO',
  'btn.share': 'COMPARTIR',
  'btn.play': 'JUGAR',

  'zone.legendary': 'LEYENDA',
  'zone.elite': 'ÉLITE',
  'zone.insane': 'BRUTAL',
  'zone.great': 'GENIAL',
  'zone.good': 'BIEN',
  'zone.safe': 'SEGURO',
  'zone.fall': 'CAÍDA',

  'stats.title': 'DATOS',
  'stats.best': 'MEJOR',
  'stats.attempts': 'INTENTOS',
  'stats.falls': 'CAÍDAS',
  'stats.closeCalls': 'AL LÍMITE',
  'stats.nearMisses': 'POR POCO',
  'stats.rivalsBeaten': 'RIVALES SUPERADOS',
  'stats.streak': 'RACHA ACTUAL',
  'stats.bestStreak': 'MEJOR RACHA',
  'stats.eliteZone': 'ZONA ÉLITE',
  'stats.reset': 'BORRAR DATOS',
  'stats.resetConfirm': 'PULSA OTRA VEZ',

  'rank.title': 'RANKING',
  'rank.today': 'RETO DE HOY',
  'rank.you': 'TÚ',
  'rank.empty': 'TIRA PARA ENTRAR',

  'set.title': 'AJUSTES',
  'set.lang': 'IDIOMA',
  'set.sound': 'SONIDO',
  'set.haptics': 'VIBRACIÓN',
  'set.shake': 'TEMBLOR',
  'set.reduceFx': 'MENOS EFECTOS',
  'set.contrast': 'ALTO CONTRASTE',
  'set.on': 'SÍ',
  'set.off': 'NO',
  'set.keys': 'ESPACIO O CLIC PARA JUGAR',

  'mode.quick': 'PARTIDA RÁPIDA',
  'mode.three': '3 TIROS',
  'mode.daily': 'RETO DIARIO',
  'mode.beat': 'SUPERA LA MARCA',
  'mode.dailyDone': 'YA HAS JUGADO HOY',
  'mode.dailyBest': 'HOY: {d} mm',

  'unlock.title': 'DESBLOQUEADO',
  'unlock.sub': '{name} ES TUYO',

  'share.title': 'UN MILÍMETRO MÁS',
  'share.rank': '#{rank} DEL GRUPO',
  'share.beat': 'SUPÉRALO.',

  'social.tookFirst': '{name} TE QUITÓ EL #1',
  'social.beatYou': '{name} TE GANA POR {d} mm',
  'social.survived': 'TU RÉCORD AGUANTA',
  'social.ahead': '{n} AMIGOS POR DELANTE',
  'social.revenge': 'REVANCHA DISPONIBLE',
};

const DICTS = { en: EN, es: ES };
export const LANGUAGES = [
  { id: 'en', label: 'EN' },
  { id: 'es', label: 'ES' },
];

let current = 'en';

export function setLanguage(lang) {
  current = DICTS[lang] ? lang : 'en';
  return current;
}
export function getLanguage() { return current; }

/** Detects a sensible default from the browser, never throws. */
export function detectLanguage() {
  try {
    const nav = globalThis.navigator;
    const tags = (nav && (nav.languages || [nav.language])) || [];
    for (const tag of tags) {
      if (!tag) continue;
      const base = String(tag).toLowerCase().slice(0, 2);
      if (DICTS[base]) return base;
    }
  } catch (e) { /* ignore */ }
  return 'en';
}

export function t(key, params) {
  const dict = DICTS[current] || EN;
  let s = dict[key] ?? EN[key] ?? key;
  if (params) {
    for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]));
  }
  return s;
}

/** Used by tests and tooling to guarantee no language falls behind. */
export function missingKeys(lang) {
  const dict = DICTS[lang] || {};
  return Object.keys(EN).filter((k) => !(k in dict));
}
