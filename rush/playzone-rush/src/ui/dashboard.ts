/**
 * Dashboard de la alfa. SOLO LECTURA.
 *
 * Deliberadamente separado de ui/debug.ts: aquel puede mover el dia, forzar
 * mutadores y lanzar partidas falsas, y por eso no puede ser el sitio donde
 * se miran los resultados de la semana (quien mira los datos no debe poder
 * ensuciarlos sin darse cuenta). Este modulo solo pide GET /api/dashboard y
 * pinta numeros: no hay ni un boton que escriba nada.
 *
 * Se abre con ?dashboard y se carga bajo demanda, asi que no pesa en el
 * arranque normal del juego.
 */
import { el, clear } from './dom';

interface Window {
  eligible: number;
  returned: number;
  rate: number | null;
}

interface DashboardData {
  buildId: string;
  metrics: {
    generatedFor: string;
    players: number;
    days: number;
    retention: { d1: Window; d3: Window; d7: Window };
    revenge: {
      available: number;
      clicked: number;
      rate: number | null;
      timesOvertaken: number;
      byLoss: { id: string; available: number; clicked: number; rate: number | null }[];
    };
    attempts: {
      retosJugados: number;
      one: number;
      two: number;
      three: number;
      exhaustedRate: number | null;
      average: number | null;
    };
    dailyCompletion: {
      activeDays: number;
      startedDays: number;
      completedDays: number;
      startRate: number | null;
      completionRate: number | null;
    };
    organicReopen: {
      closedSessions: number;
      reopened: number;
      organic: number;
      reopenRate: number | null;
      organicReopenRate: number | null;
      medianGapMs: number | null;
    };
    activity: {
      activePlayersByDay: { day: string; players: number }[];
      eventCounts: Record<string, number>;
    };
  };
  errors: {
    last24h: number;
    last7d: number;
    recent: { ts: number; source: string; message: string; url: string | null }[];
  };
}

function pct(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

function num(value: number | null, digits = 1): string {
  return value === null ? '—' : value.toFixed(digits);
}

function minutes(ms: number | null): string {
  if (ms === null) return '—';
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  return `${(mins / 60).toFixed(1)} h`;
}

/** Una metrica grande, con su denominador al lado: un 100% de 1 no es un 100%. */
function metric(label: string, value: string, detail: string, tone = ''): HTMLElement {
  return el('div', { class: `dash-metric${tone ? ` dash-metric--${tone}` : ''}` }, [
    el('div', { class: 'dash-metric__label', text: label }),
    el('div', { class: 'dash-metric__value num', text: value }),
    el('div', { class: 'dash-metric__detail', text: detail }),
  ]);
}

function section(title: string, note?: string): HTMLElement {
  return el('div', { class: 'dash-section' }, [
    el('span', { text: title }),
    note ? el('small', { text: note }) : null,
  ]);
}

function render(root: HTMLElement, data: DashboardData): void {
  const m = data.metrics;
  clear(root);

  const page = el('div', { class: 'dash' }, [
    el('div', { class: 'dash__head' }, [
      el('div', {}, [
        el('div', { class: 'dash__title', text: 'ALFA · DATOS' }),
        el('div', {
          class: 'dash__sub',
          text: `${m.players} jugadores · ${m.days} dias con actividad · build ${data.buildId}`,
        }),
      ]),
      el('div', { class: 'dash__readonly', text: 'SOLO LECTURA' }),
    ]),

    section('RETENCION', 'volver al dia siguiente exacto'),
    el('div', { class: 'dash-grid' }, [
      metric('D1', pct(m.retention.d1.rate), `${m.retention.d1.returned}/${m.retention.d1.eligible}`, 'brand'),
      metric('D3', pct(m.retention.d3.rate), `${m.retention.d3.returned}/${m.retention.d3.eligible}`),
      metric('D7', pct(m.retention.d7.rate), `${m.retention.d7.returned}/${m.retention.d7.eligible}`),
    ]),

    section('REVENGE RATE', 'el KPI estrella'),
    el('div', { class: 'dash-grid' }, [
      metric('REVANCHA', pct(m.revenge.rate), `${m.revenge.clicked}/${m.revenge.available} ofrecidas`, 'gold'),
      metric('ADELANTADO', String(m.revenge.timesOvertaken), 'veces que le han pasado'),
    ]),
    el(
      'div',
      { class: 'dash-bars' },
      m.revenge.byLoss.map((bucket) =>
        el('div', { class: 'dash-bar' }, [
          el('div', { class: 'dash-bar__label', text: `POR ${bucket.id}` }),
          el('div', { class: 'dash-bar__track' }, [
            el('div', {
              class: 'dash-bar__fill',
              style: { width: `${Math.round((bucket.rate ?? 0) * 100)}%` },
            }),
          ]),
          el('div', { class: 'dash-bar__value num', text: `${pct(bucket.rate)} · ${bucket.available}` }),
        ]),
      ),
    ),

    section('ORGANIC REOPEN', 'volver despues de terminar, con el ranking movido'),
    el('div', { class: 'dash-grid' }, [
      metric(
        'ORGANICA',
        pct(m.organicReopen.organicReopenRate),
        `${m.organicReopen.organic}/${m.organicReopen.closedSessions} sesiones`,
        'brand',
      ),
      metric(
        'VUELVE',
        pct(m.organicReopen.reopenRate),
        `${m.organicReopen.reopened} reaperturas`,
      ),
      metric('TARDA', minutes(m.organicReopen.medianGapMs), 'mediana en volver'),
    ]),

    section('INTENTOS', '1/3 frente a 3/3'),
    el('div', { class: 'dash-grid' }, [
      metric('AGOTA 3/3', pct(m.attempts.exhaustedRate), `${m.attempts.three} de ${m.attempts.retosJugados}`),
      metric('SE QUEDA EN 1', pct(m.attempts.retosJugados > 0 ? m.attempts.one / m.attempts.retosJugados : null), `${m.attempts.one} retos`),
      metric('MEDIA', num(m.attempts.average, 2), 'intentos por reto'),
    ]),

    section('RETO DIARIO'),
    el('div', { class: 'dash-grid' }, [
      metric(
        'COMPLETA',
        pct(m.dailyCompletion.completionRate),
        `${m.dailyCompletion.completedDays}/${m.dailyCompletion.activeDays} dias-jugador`,
      ),
      metric(
        'EMPIEZA',
        pct(m.dailyCompletion.startRate),
        `${m.dailyCompletion.startedDays} de los que abren`,
      ),
    ]),

    section('ACTIVIDAD POR DIA'),
    el(
      'div',
      { class: 'dash-days' },
      m.activity.activePlayersByDay.map((row) =>
        el('div', { class: 'dash-day' }, [
          el('span', { text: row.day }),
          el('span', { class: 'num', text: `${row.players} jugador${row.players === 1 ? '' : 'es'}` }),
        ]),
      ),
    ),

    section('ERRORES', `${data.errors.last24h} en 24 h · ${data.errors.last7d} en 7 dias`),
    data.errors.recent.length === 0
      ? el('div', { class: 'dash-empty', text: 'Ninguno. Bien.' })
      : el(
          'div',
          { class: 'dash-errors' },
          data.errors.recent.slice(0, 12).map((row) =>
            el('div', { class: `dash-error dash-error--${row.source}` }, [
              el('span', { class: 'dash-error__source', text: row.source }),
              el('span', { class: 'dash-error__msg', text: row.message }),
            ]),
          ),
        ),

    el('div', { class: 'dash-foot' }, [
      el('span', { text: `Dia competitivo: ${m.generatedFor}` }),
      el('span', { text: 'Este panel no puede modificar resultados.' }),
    ]),
  ]);

  root.appendChild(page);
}

/**
 * Monta el dashboard sobre todo lo demas. Necesita el token de sesion: sin
 * grupo no hay datos que agregar.
 */
export async function mountDashboard(root: HTMLElement, token: string | null): Promise<void> {
  clear(root);
  root.appendChild(el('div', { class: 'dash-empty', text: 'CARGANDO DATOS…' }));

  if (!token) {
    clear(root);
    root.appendChild(
      el('div', { class: 'dash-empty', text: 'Sin grupo: no hay datos agregados que ensenar.' }),
    );
    return;
  }

  try {
    const response = await fetch('/api/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`El servidor ha respondido ${response.status}`);
    render(root, (await response.json()) as DashboardData);
  } catch (error) {
    clear(root);
    root.appendChild(
      el('div', { class: 'dash-empty', text: `No se han podido cargar los datos: ${String(error)}` }),
    );
  }
}
