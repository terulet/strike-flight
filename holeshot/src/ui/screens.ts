/** Pantallas del menu (HTML). Devuelven marcado; main.ts engancha los botones. */
import { dailyTheme, dayNumber } from '../game/daily';
import { Mission, Theme, getMission, missionSummaries } from '../game/missions';
import { Progress, RiderProfile, SPECIAL_LIVERIES } from '../game/progress';
import { fmtDecimal, fmtNumber, lang, ordinal, t } from '../i18n';
import { profile } from '../render/backdrop';

export function fmtTime(t: number): string {
  if (!Number.isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export function fmtInt(n: number): string {
  return fmtNumber(n);
}

const medalName = (m: number): string => [t('SIN MEDALLA'), t('BRONCE'), t('PLATA'), t('ORO')][m] ?? '';

/** Nombre visible de una prueba o del Barro del Dia. */
export function missionName(m: Mission): string {
  return m.daily ? t('BARRO DEL DÍA #{n}', { n: m.daily.number }) : t(m.name);
}

function medalIcon(m: number): string {
  return `<span class="medal m${m}">${m ? '★' : '·'}</span>`;
}

const keys = (): string => `
  <span><b>↑</b>/<b>W</b> ${t('gas')}</span>
  <span><b>↓</b>/<b>S</b> ${t('freno')}</span>
  <span><b>←</b>/<b>A</b> ${t('cuerpo atrás')}</span>
  <span><b>→</b>/<b>D</b> ${t('cuerpo adelante')}</span>
  <span><b>${t('ESPACIO')}</b> ${t('nitro')}</span>
  <span><b>T</b> ${t('tear-off (limpiar gafas)')}</span>
  <span><b>R</b> ${t('reiniciar')}</span>
  <span><b>ESC</b> ${t('pausa')}</span>`;

export function titleHTML(touch: boolean, dailyKey: string): string {
  return `
  <div class="scrim"></div>
  <div class="title-screen">
    <div class="logo"><span class="hole">HOLE</span><span class="shot">SHOT</span></div>
    <div class="logo-stripes"></div>
    <div class="tagline">${t('GIRA MUNDIAL DEL BARRO')}</div>
    <div class="title-btns">
      <button class="big-btn blink" data-act="daily">${t('BARRO DEL DÍA #{n}', { n: dayNumber(dailyKey) })}</button>
      <button class="ghost-btn" data-act="start">${t('LA GIRA')}</button>
      <button class="ghost-btn" data-act="garage">${t('GARAJE')}</button>
      <button class="ghost-btn lang-btn" data-act="lang" aria-label="${t('Idioma')}">${lang() === 'es' ? 'EN' : 'ES'}</button>
    </div>
    ${touch ? '' : `<div class="keys">${keys()}</div>`}
  </div>
  <div class="foot">${t('UNA PISTA NUEVA CADA DÍA · LA MISMA PARA TODO EL MUNDO')}</div>`;
}

function cardArt(theme: Theme, seed: number): string {
  const W = 200;
  const H = 300;
  let layers = '';
  theme.layers.forEach((l, i) => {
    const pts: string[] = [];
    for (let x = 0; x <= W; x += 4) {
      const y = H * (l.base - 0.1) - profile(l.kind, x / H + seed * 0.7 + i, l.seed) * H * l.height;
      pts.push(`${x},${y.toFixed(1)}`);
    }
    layers += `<polygon points="0,${H} ${pts.join(' ')} ${W},${H}" fill="${l.color}"/>`;
  });
  const g = theme.ground;
  const sun = theme.sun ? `<circle cx="${theme.sun.x * W}" cy="${theme.sun.y * H * 0.8}" r="${theme.sun.r * H}" fill="${theme.sun.color}"/><circle cx="${theme.sun.x * W}" cy="${theme.sun.y * H * 0.8}" r="${theme.sun.r * H * 3}" fill="${theme.sun.glow}"/>` : '';
  const stars = theme.stars ? Array.from({ length: 30 }, (_, i) => `<circle cx="${(i * 67) % W}" cy="${(i * 37) % 130}" r="0.9" fill="#fff" opacity="0.7"/>`).join('') : '';
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="sky${seed}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${theme.skyTop}"/><stop offset="0.55" stop-color="${theme.skyMid}"/><stop offset="1" stop-color="${theme.skyBottom}"/>
    </linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#sky${seed})"/>${stars}${sun}${layers}
    <path d="M0,${H * 0.66} C60,${H * 0.63} 90,${H * 0.56} 120,${H * 0.6} L140,${H * 0.52} L150,${H * 0.66} C170,${H * 0.68} 190,${H * 0.66} 200,${H * 0.66} L200,${H} L0,${H} Z" fill="${g.crust}"/>
    <path d="M0,${H * 0.72} C60,${H * 0.7} 120,${H * 0.74} 200,${H * 0.72} L200,${H} L0,${H} Z" fill="${g.strata[1]}"/>
    <path d="M0,${H * 0.82} C80,${H * 0.8} 120,${H * 0.85} 200,${H * 0.83} L200,${H} L0,${H} Z" fill="${g.strata[3]}"/>
  </svg>`;
}

function untilMidnight(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const mins = Math.max(0, Math.round((next.getTime() - now.getTime()) / 60000));
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`;
}

/** AAAA-MM-DD a dd/mm/aaaa (es) o mm/dd/aaaa (en). */
export function fmtDate(key: string): string {
  const [y, m, d] = key.split('-');
  return lang() === 'en' ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
}

function dailyCard(progress: Progress, key: string, selected: boolean): string {
  const { theme } = dailyTheme(key);
  const best = progress.daily[key];
  return `
    <button class="daily-card ${selected ? 'sel' : ''}" data-act="pick" data-id="0" style="--card-accent:${theme.accent}">
      <div class="art">${cardArt(theme, 9)}</div>
      <div class="daily-body">
        <div class="daily-kicker">${t('HOY')} · ${fmtDate(key)}</div>
        <div class="daily-name">${t('BARRO DEL DÍA #{n}', { n: dayNumber(key) })}</div>
        <div class="daily-sub">${t('La misma pista para todo el mundo. Nueva en {t}.', { t: untilMidnight() })}</div>
      </div>
      <div class="daily-best">${best ? `${medalIcon(best.medal)} <b>${fmtTime(best.time)}</b><small>${t('TU MEJOR HOY')}</small>` : `<b>${t('¡A POR ELLA!')}</b><small>${t('SIN CORRER HOY')}</small>`}</div>
    </button>`;
}

export function selectHTML(progress: Progress, selected: number, dailyKey: string): string {
  const cards = missionSummaries()
    .map((m) => {
      const locked = m.id > progress.unlocked;
      const best = progress.best[m.id];
      const mission = getMission(m.id);
      return `
      <button class="card ${locked ? 'locked' : ''} ${m.id === selected ? 'sel' : ''}" data-act="pick" data-id="${m.id}" style="--card-accent:${m.accent}">
        <div class="art">${cardArt(mission.theme, m.id)}</div>
        <div class="num">0${m.id}</div>
        ${locked ? `<div class="lock">${t('BLOQUEADA')}</div>` : ''}
        <div class="body">
          <div class="name">${t(m.name)}</div>
          <div class="place">${t(m.place)}</div>
          <div class="obj">${t(m.objectiveText).toUpperCase()}</div>
          <div class="best">${medalIcon(best?.medal ?? 0)} ${best ? fmtTime(best.time) : locked ? t('Gana una medalla en la anterior') : t('Sin correr')}</div>
        </div>
      </button>`;
    })
    .join('');
  return `
  <div class="scrim"></div>
  <div class="select-screen">
    <div class="screen-title">${t('LA GIRA')}<small>${t('ELIGE PRUEBA · ←/→ Y ENTER')}</small></div>
    ${dailyCard(progress, dailyKey, selected === 0)}
    <div class="cards">${cards}</div>
    <div class="row-btns"><button class="ghost-btn" data-act="title">${t('VOLVER')}</button><button class="ghost-btn" data-act="garage">${t('GARAJE')}</button></div>
  </div>`;
}

function goalLine(m: Mission): string {
  const md = m.medals;
  switch (m.objective) {
    case 'plates':
      return t('Oro: {a} placas y {b} · Plata: {c} placas y {d}', { a: md.goldPlates ?? 0, b: fmtTime(md.gold), c: md.silverPlates ?? 0, d: fmtTime(md.silver) });
    case 'tricks':
      return t('Oro: {a} pts de truco · Plata: {b} pts', { a: fmtInt(md.goldScore ?? 0), b: fmtInt(md.silverScore ?? 0) });
    case 'final':
      return t('Oro: ganar la final · Plata: segundo · Bronce: terminar');
    default:
      return t('Oro: {a} · Plata: {b} · Bronce: terminar', { a: fmtTime(md.gold), b: fmtTime(md.silver) });
  }
}

export interface BriefingExtra {
  /** Reto recibido por enlace. */
  challenge: { name: string; number: string; time: number } | null;
  /** Tu mejor tiempo en esta pista (hay fantasma). */
  ownBest: number | null;
}

export function briefingHTML(m: Mission, touch: boolean, extra: BriefingExtra = { challenge: null, ownBest: null }): string {
  const md = m.medals;
  const medals =
    m.objective === 'final'
      ? `<span>${medalIcon(3)} ${ordinal(1)}</span><span>${medalIcon(2)} ${ordinal(2)}</span><span>${medalIcon(1)} ${t('terminar')}</span>`
      : m.objective === 'tricks'
      ? `<span>${medalIcon(3)} ${fmtInt(md.goldScore ?? 0)}</span><span>${medalIcon(2)} ${fmtInt(md.silverScore ?? 0)}</span><span>${medalIcon(1)} ${t('terminar')}</span>`
      : m.objective === 'plates'
        ? `<span>${medalIcon(3)} ${t('{n} placas', { n: md.goldPlates ?? 0 })} · ${fmtTime(md.gold)}</span><span>${medalIcon(2)} ${md.silverPlates} · ${fmtTime(md.silver)}</span><span>${medalIcon(1)} ${t('terminar')}</span>`
          : `<span>${medalIcon(3)} ${fmtTime(md.gold)}</span><span>${medalIcon(2)} ${fmtTime(md.silver)}</span><span>${medalIcon(1)} ${t('terminar')}</span>`;
  return `
  <div class="panel briefing">
    <div class="kicker">${m.daily ? `${t('BARRO DEL DÍA')} · ${fmtDate(m.daily.key)}` : t('PRUEBA {n} DE 5', { n: m.id })}</div>
    <h2>${missionName(m)}</h2>
    <div class="place">${m.daily ? t('Una pista nueva cada día, la misma para todos') : t(m.place)}</div>
    ${extra.challenge ? `<div class="challenge"><span class="challenge-tag">${t('RETO')}</span><span class="challenge-name"></span><b>${fmtTime(extra.challenge.time)}</b><small>${t('Su fantasma corre contigo. Gánale y devuélvele el reto.')}</small></div>` : ''}
    <p>${t(m.briefing)}</p>
    ${extra.ownBest !== null ? `<p style="font-size:15px;opacity:.85">${t('Tu mejor vuelta aquí: <b>{t}</b>. Correrás contra tu fantasma.', { t: fmtTime(extra.ownBest) })}</p>` : ''}
    <div class="goal">🏁 ${t(m.objectiveText)}</div>
    <div class="medals-row">${medals}</div>
    ${m.rivals.length ? `<p style="font-size:15px;opacity:.85">${t('Rivales')}: ${m.rivals.map((r) => `#${r.number} ${r.name}`).join(' · ')}</p>` : ''}
    ${touch ? `<p style="font-size:15px;opacity:.8">${t('Izquierda: cuerpo atrás / adelante y TEAR para limpiar las gafas · Derecha: gas, freno y nitro.')}</p>` : `<div class="keys">${keys()}</div>`}
    <div class="row-btns">
      <button class="big-btn" data-act="go">${t('¡A CORRER!')}</button>
      <button class="ghost-btn" data-act="select">${t('MISIONES')}</button>
    </div>
  </div>`;
}

const COLOR_SWATCHES: Array<[string, string]> = [
  ['orange', '#ff5a1f'],
  ['blue', '#2f7df6'],
  ['green', '#3fbf5a'],
  ['yellow', '#ffcf1f'],
  ['purple', '#8a4dff'],
];

const SPECIAL_SWATCHES: Record<string, string> = {
  gold: 'conic-gradient(from 30deg, #fff3b0, #e0b12e, #9c7512, #e0b12e, #fff3b0)',
  neon: 'linear-gradient(135deg, #ff2fa8, #3dfcff)',
  carbon: 'repeating-linear-gradient(45deg, #2c2f36 0 4px, #16181c 4px 8px)',
};

export function garageHTML(r: RiderProfile, unlocked: (id: string) => boolean, hasRewarded: boolean): string {
  const specials = SPECIAL_LIVERIES.map((l) => {
    const open = unlocked(l.id);
    return `<button class="swatch special ${r.colors === l.id ? 'sel' : ''} ${open ? '' : 'locked'}" data-act="color" data-color="${l.id}" style="--sw:${SPECIAL_SWATCHES[l.id]}" aria-label="${t(l.name)}${open ? '' : ` (${t('bloqueada')})`}" title="${t(l.name)}: ${t(l.how)}"></button>`;
  }).join('');
  return `
  <div class="scrim"></div>
  <div class="panel garage">
    <div class="kicker">${t('GARAJE')}</div>
    <h2>${t('TU PILOTO')}</h2>
    <canvas id="garagePreview" width="520" height="300" aria-label="${t('Tu moto y tu piloto')}"></canvas>
    <div class="garage-row">
      <span class="garage-label">${t('COLORES')}</span>
      <div class="swatches">${COLOR_SWATCHES.map(([k, c]) => `<button class="swatch ${r.colors === k ? 'sel' : ''}" data-act="color" data-color="${k}" style="--sw:${c}" aria-label="${k}"></button>`).join('')}</div>
    </div>
    <div class="garage-row">
      <span class="garage-label">${t('ESPECIALES')}</span>
      <div class="swatches">${specials}</div>
    </div>
    <div class="garage-unlock" id="garageUnlock"></div>
    ${hasRewarded ? `<div class="garage-unlock-ad hidden" id="garageAd"><button class="ghost-btn" data-act="unlock-ad">${t('VER UN ANUNCIO Y DESBLOQUEAR')}</button></div>` : ''}
    <div class="garage-row">
      <label class="garage-label" for="gNumber">${t('DORSAL')}</label>
      <input id="gNumber" class="garage-input num" inputmode="numeric" maxlength="2" value="${r.number}" />
      <label class="garage-label" for="gName">${t('NOMBRE')}</label>
      <input id="gName" class="garage-input" maxlength="12" autocomplete="off" spellcheck="false" />
    </div>
    <p style="font-size:14px;opacity:.75">${t('Tu nombre y tu dorsal viajan con tu fantasma en los enlaces de reto y salen en tu portada.')}</p>
    <div class="row-btns">
      <button class="big-btn" data-act="garage-save">${t('GUARDAR')}</button>
      <button class="ghost-btn" data-act="title">${t('VOLVER')}</button>
    </div>
  </div>`;
}

export function pauseHTML(muted: boolean): string {
  return `
  <div class="scrim"></div>
  <div class="panel">
    <div class="kicker">${t('PAUSA')}</div>
    <h2>${t('EN BOXES')}</h2>
    <div class="row-btns">
      <button class="big-btn" data-act="resume">${t('CONTINUAR')}</button>
      <button class="ghost-btn" data-act="restart">${t('REINICIAR')}</button>
      <button class="ghost-btn" data-act="select">${t('MISIONES')}</button>
      <button class="ghost-btn" data-act="mute">${muted ? t('SONIDO: NO') : t('SONIDO: SÍ')}</button>
      <button class="ghost-btn" data-act="lang">${lang() === 'es' ? 'ENGLISH' : 'ESPAÑOL'}</button>
    </div>
  </div>`;
}

export interface ResultView {
  mission: Mission;
  finished: boolean;
  failReason: string;
  medal: number;
  time: number;
  bestTime: number | null;
  record: boolean;
  score: number;
  trickScore: number;
  plates: number;
  totalPlates: number;
  crashes: number;
  flips: number;
  maxAir: number;
  bestCombo: number;
  position: number | null;
  riders: number;
  cover: string | null;
  /** Resumen para compartir (solo si ha terminado). */
  share: { text: string; canNative: boolean; canSaveCover: boolean; canClip: boolean } | null;
  versus: { name: string; won: boolean; diff: string } | null;
  hasNext: boolean;
  nextUnlocked: boolean;
}

export function resultsHTML(r: ResultView): string {
  const m = r.mission;
  const title = !r.finished
    ? t('ELIMINADO')
    : r.position !== null && m.objective === 'final'
      ? r.position === 1
        ? t('¡CAMPEÓN!')
        : t('{p} EN LA FINAL', { p: ordinal(r.position) })
      : r.medal === 3
        ? t('¡BRUTAL!')
        : r.medal === 2
          ? t('¡MUY BIEN!')
          : t('¡TERMINADA!');
  const stats: Array<[string, string]> = [
    [t('TIEMPO'), fmtTime(r.time)],
    [t('MEJOR'), r.bestTime !== null ? fmtTime(r.bestTime) : '—'],
    [t('PUNTOS'), fmtInt(r.score)],
    [t('CAÍDAS'), String(r.crashes)],
    [t('MORTALES'), String(r.flips)],
    [t('VUELO MÁX.'), `${fmtDecimal(r.maxAir, 2)} s`],
  ];
  if (m.objective === 'plates') stats.splice(2, 0, [t('PLACAS'), `${r.plates}/${r.totalPlates}`]);
  if (r.position !== null) stats.splice(0, 0, [t('PUESTO'), `${ordinal(r.position)} / ${r.riders}`]);
  if (m.objective === 'tricks') stats.splice(2, 0, [t('PTS TRUCO'), fmtInt(r.trickScore)]);
  if (r.bestCombo > 1) stats.push([t('MEJOR COMBO'), `x${r.bestCombo}`]);
  return `
  <div class="scrim"></div>
  <div class="panel results ${r.cover ? 'with-cover' : ''}">
    ${r.cover ? `<div class="cover-wrap"><img src="${r.cover}" alt="${t('Portada de revista con tu mejor salto')}" /><div class="cover-cap">${t('TU PORTADA')}</div></div>` : ''}
    <div class="results-body">
    ${r.finished ? `<div class="big-medal m${r.medal}">${r.medal ? medalName(r.medal) : '—'}</div>` : ''}
    <div class="kicker">${m.daily ? missionName(m) : `${t('PRUEBA {n}', { n: m.id })} · ${missionName(m)}`}</div>
    <h2>${title}${r.record ? `<span class="record">${t('NUEVA MARCA')}</span>` : ''}</h2>
    ${r.versus ? `<div class="versus ${r.versus.won ? 'won' : 'lost'}">${r.versus.won ? t('HAS GANADO A') : t('TE HA GANADO')} <span class="versus-name"></span> · ${r.versus.diff}</div>` : ''}
    ${r.finished ? '' : `<p>${t(r.failReason)}. ${t('Vuelve a intentarlo: no frenes y no te caigas.')}</p>`}
    <div class="stats">${stats.map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
    <p style="font-size:15px;opacity:.8">${goalLine(m)}</p>
    ${
      r.share
        ? `<div class="share">
      <pre class="share-text" id="shareText"></pre>
      <div class="row-btns">
        <button class="big-btn share-btn" data-act="copy">${t('COPIAR Y RETAR')}</button>
        ${r.share.canNative ? `<button class="ghost-btn" data-act="native-share">${t('COMPARTIR')}</button>` : ''}
        ${r.share.canClip ? `<button class="ghost-btn" data-act="clip">${t('CLIP VERTICAL')}</button>` : ''}
        ${r.share.canSaveCover && r.cover ? `<button class="ghost-btn" data-act="save-cover">${t('GUARDAR PORTADA')}</button>` : ''}
      </div>
      <div class="share-note" id="shareNote"></div>
    </div>`
        : ''
    }
    <div class="row-btns">
      ${r.hasNext && r.nextUnlocked ? `<button class="big-btn" data-act="next">${t('SIGUIENTE PRUEBA')}</button>` : ''}
      <button class="${r.hasNext && r.nextUnlocked ? 'ghost-btn' : 'big-btn'}" data-act="restart">${t('REPETIR')}</button>
      <button class="ghost-btn" data-act="select">${t('MISIONES')}</button>
    </div>
    </div>
  </div>`;
}
