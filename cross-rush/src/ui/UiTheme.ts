/**
 * UiTheme.ts
 *
 * Hoja de estilo unica de la interfaz (HUD, controles tactiles y pantalla de
 * resultados). Se inyecta una sola vez y sustituye a los estilos en linea que
 * habia repartidos por los tres componentes.
 *
 * Dos razones para centralizarla:
 *
 * 1. SAFE AREAS. En iPhone/iPad el notch, la isla dinamica y la barra de
 *    gestos se comen los bordes de la pantalla. Con estilos en linea no hay
 *    forma de usar `env(safe-area-inset-*)`, asi que el crono se metia debajo
 *    del notch y los botones debajo de la barra de gestos. Aqui todo cuelga de
 *    cuatro variables (`--cr-safe-*`) que ya llevan un margen minimo.
 *
 * 2. RESPONSIVE DE VERDAD. El mismo HUD tiene que leerse en 1366x768 y en
 *    393x852. Con media queries se cambian tamanos y colocacion de golpe, en
 *    vez de recalcular pixeles a mano en cada `update`.
 *
 * Requiere `viewport-fit=cover` en el meta viewport (ver index.html): sin eso
 * `env(safe-area-inset-*)` vale siempre 0 y el navegador recorta por su cuenta.
 */

export const BRAND = {
  orange: '#ff6a1a',
  orangeSoft: '#ffb37a',
  red: '#ff2d2d',
  green: '#5ce08a',
  ink: '#0d0906',
} as const;

const STYLE_ID = 'cross-rush-ui';

const CSS = `
:root {
  --cr-orange: ${BRAND.orange};
  --cr-orange-soft: ${BRAND.orangeSoft};
  --cr-red: ${BRAND.red};
  --cr-green: ${BRAND.green};
  --cr-safe-t: calc(env(safe-area-inset-top, 0px) + 10px);
  --cr-safe-r: calc(env(safe-area-inset-right, 0px) + 14px);
  --cr-safe-b: calc(env(safe-area-inset-bottom, 0px) + 14px);
  --cr-safe-l: calc(env(safe-area-inset-left, 0px) + 14px);
  --cr-plate: rgba(12, 8, 5, 0.62);
  --cr-plate-edge: rgba(255, 176, 122, 0.28);
}

.cr-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  color: #fff;
  -webkit-user-select: none;
  user-select: none;
}

/* Placa oscura translucida: es lo que garantiza que el crono se lea igual
   sobre cielo claro que sobre tierra oscura. Sin ella el texto blanco con
   sombra desaparecia en cuanto el fondo era arena. */
.cr-plate {
  background: var(--cr-plate);
  border: 1px solid var(--cr-plate-edge);
  border-radius: 10px;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
}

/* ------------------------------------------------------------------ marca */
.cr-brand {
  position: absolute;
  top: var(--cr-safe-t);
  left: var(--cr-safe-l);
  font-family: 'Arial Black', 'Segoe UI', system-ui, sans-serif;
  font-weight: 900;
  font-style: italic;
  letter-spacing: -0.5px;
  line-height: 0.95;
  font-size: 20px;
  -webkit-text-stroke: 0.8px #000;
  filter: drop-shadow(2px 3px 5px rgba(0, 0, 0, 0.6));
}
.cr-brand em {
  font-style: inherit;
  background: linear-gradient(90deg, var(--cr-orange), var(--cr-red));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}

/* --------------------------------------------------------------- crono */
.cr-board {
  position: absolute;
  top: var(--cr-safe-t);
  right: var(--cr-safe-r);
  padding: 8px 14px 10px;
  text-align: right;
  min-width: 168px;
}
.cr-board-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 2.5px;
  color: var(--cr-orange-soft);
  opacity: 0.9;
}
/* tabular-nums: sin esto cada digito tiene un ancho distinto y el crono
   "baila" horizontalmente varias veces por segundo. */
.cr-time {
  font-size: 34px;
  font-weight: 900;
  line-height: 1.02;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.7);
}
.cr-board-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}
.cr-best {
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--cr-orange-soft);
}
.cr-best b {
  font-size: 9px;
  letter-spacing: 1.5px;
  opacity: 0.75;
  margin-right: 4px;
  font-weight: 800;
}
.cr-delta {
  font-size: 13px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid currentColor;
  color: #cfd6e4;
  min-width: 62px;
}
.cr-delta.ahead { color: var(--cr-green); background: rgba(92, 224, 138, 0.14); }
.cr-delta.behind { color: var(--cr-red); background: rgba(255, 45, 45, 0.14); }

/* ---------------------------------------------------------------- flow */
.cr-flow {
  position: absolute;
  top: calc(var(--cr-safe-t) + 34px);
  left: var(--cr-safe-l);
}
.cr-flow-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 2.5px;
  margin-bottom: 4px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
}
.cr-flow-bar { display: flex; gap: 3px; }
.cr-flow-seg {
  width: 16px;
  height: 10px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.22);
  transition: background 0.1s linear, border-color 0.1s linear;
}

/* -------------------------------------------------------------- centro */
.cr-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  display: none;
}
.cr-center-brand {
  font-family: 'Arial Black', 'Segoe UI', system-ui, sans-serif;
  font-weight: 900;
  font-style: italic;
  font-size: 44px;
  letter-spacing: -1px;
  -webkit-text-stroke: 1.6px #000;
  filter: drop-shadow(2px 5px 8px rgba(0, 0, 0, 0.65));
  margin-bottom: 6px;
}
.cr-center-brand em {
  font-style: inherit;
  background: linear-gradient(90deg, var(--cr-orange), var(--cr-red));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}
.cr-center-msg {
  font-size: 84px;
  font-weight: 900;
  font-style: italic;
  line-height: 1;
  -webkit-text-stroke: 2px #000;
  text-shadow: 0 6px 22px rgba(0, 0, 0, 0.8);
}
/* Cada numero entra de golpe y se relaja: la cuenta atras se NOTA en vez de
   limitarse a cambiar de caracter. */
.cr-pop { animation: cr-pop 0.42s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes cr-pop {
  0% { transform: scale(1.75); opacity: 0.15; }
  55% { transform: scale(0.94); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
.cr-go { color: var(--cr-orange); animation: cr-go 0.6s ease-out forwards; }
@keyframes cr-go {
  0% { transform: scale(0.7); opacity: 1; }
  35% { transform: scale(1.25); opacity: 1; }
  100% { transform: scale(2.1); opacity: 0; }
}

/* Cartel de sector/split, debajo del FLOW. */
.cr-split {
  position: absolute;
  top: calc(var(--cr-safe-t) + 72px);
  left: var(--cr-safe-l);
  font-size: 14px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
  display: none;
}

/* ----------------------------------------------------- controles tactiles */
.cr-pad {
  position: absolute;
  bottom: var(--cr-safe-b);
  display: flex;
  gap: 14px;
  pointer-events: auto;
}
.cr-pad.left { left: var(--cr-safe-l); }
.cr-pad.right { right: var(--cr-safe-r); }
.cr-btn {
  width: 78px;
  height: 78px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.5px;
  color: #fff;
  /* Contraste alto a proposito: los botones anteriores eran casi
     transparentes sobre tierra clara y no se veian a pleno sol. */
  background: radial-gradient(circle at 32% 28%, rgba(70, 46, 30, 0.95), rgba(14, 9, 6, 0.92));
  border: 2px solid rgba(255, 176, 122, 0.55);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.18);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
  transition: transform 0.06s ease-out, box-shadow 0.06s ease-out, background 0.06s ease-out;
  touch-action: none;
}
.cr-btn .cr-btn-icon { font-size: 20px; line-height: 1; }
.cr-btn.gas { border-color: rgba(255, 106, 26, 0.85); }
.cr-btn.brake { border-color: rgba(255, 45, 45, 0.7); }
/* Feedback al pulsar: se hunde, se enciende y cambia de borde. Antes no
   cambiaba nada al tocar y no habia forma de saber si habia registrado. */
.cr-btn.active {
  transform: scale(0.92);
  background: radial-gradient(circle at 32% 28%, rgba(255, 150, 70, 0.95), rgba(150, 60, 12, 0.95));
  box-shadow: 0 0 22px rgba(255, 122, 40, 0.75), inset 0 2px 6px rgba(0, 0, 0, 0.45);
  border-color: #ffd2ab;
}
.cr-btn.brake.active {
  background: radial-gradient(circle at 32% 28%, rgba(255, 96, 96, 0.95), rgba(140, 20, 20, 0.95));
  box-shadow: 0 0 22px rgba(255, 60, 60, 0.7), inset 0 2px 6px rgba(0, 0, 0, 0.45);
}

/* --------------------------------------------- pantallas grandes / moviles */
@media (max-width: 700px), (max-height: 460px) {
  .cr-brand { font-size: 15px; }
  .cr-board { min-width: 130px; padding: 6px 10px 8px; }
  .cr-time { font-size: 25px; }
  .cr-best { font-size: 11px; }
  .cr-delta { font-size: 11px; min-width: 54px; }
  .cr-flow { top: calc(var(--cr-safe-t) + 26px); }
  .cr-flow-seg { width: 11px; height: 8px; }
  .cr-split { top: calc(var(--cr-safe-t) + 58px); font-size: 12px; }
  .cr-center-brand { font-size: 30px; }
  .cr-center-msg { font-size: 62px; }
  .cr-btn { width: 68px; height: 68px; font-size: 11px; }
  .cr-pad { gap: 10px; }
}

@media (prefers-reduced-motion: reduce) {
  .cr-pop, .cr-go { animation: none; }
}
`;

/** Inyecta la hoja de estilo una sola vez. Inerte fuera del navegador (tests). */
export function ensureUiStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
