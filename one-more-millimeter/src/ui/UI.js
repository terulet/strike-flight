/**
 * UI — thin DOM layer. The canvas owns the game; the DOM owns text, buttons and
 * anything that must stay crisp and accessible. All copy comes from i18n.
 */
import { t, setLanguage, getLanguage, LANGUAGES } from './i18n.js';
import { formatMm, formatMmDistinct, toMm } from './format.js';
import { GameConfig } from '../config/GameConfig.js';
import { getObject } from '../config/objects.js';
import { buildBoard, playerRank } from '../game/Ranking.js';
import { createChallenge, dailyId } from '../game/Challenge.js';
import { clamp01 } from '../core/math.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(deps) {
    this.save = deps.save;
    this.audio = deps.audio;
    this.haptics = deps.haptics;
    this.actions = deps.actions || {};
    this.el = {
      home: $('home'), hud: $('hud'), result: $('result'), modal: $('modal'),
      toast: $('toast'), flash: $('flash'),
      meterFill: $('meter-fill'), meterValue: $('meter-value'), meter: $('meter'),
      prompt: $('prompt'), attempt: $('hud-attempt'), setup: $('hud-setup'),
      targetChip: $('hud-target'), targetName: $('hud-target-name'), targetValue: $('hud-target-value'),
      mutator: $('hud-mutator'),
      targetLabel: $('hud-target-label'), finalShot: $('final-shot'),
      resultZone: $('result-zone'), resultNumber: $('result-number'), resultSub: $('result-sub'),
      resultNote: $('result-note'), resultVersus: $('result-versus'), resultHint: $('result-hint'),
      vsYouName: $('vs-you-name'), vsYouVal: $('vs-you-val'),
      vsRivalName: $('vs-rival-name'), vsRivalVal: $('vs-rival-val'),
      btnPrimary: $('btn-primary'), btnSecondary: $('btn-secondary'), btnShare: $('btn-share'),
      homeBest: $('home-best'), homeToday: $('home-today'),
      modalTitle: $('modal-title'), modalBody: $('modal-body'),
    };
    this._flashTimer = 0;
    this._toastTimer = 0;
    this._resetArmed = false;
    this._bind();
    this.applyLanguage();
  }

  // ------------------------------------------------------------------ SETUP
  _bind() {
    const a = this.actions;
    $('btn-play').addEventListener('click', () => { this.click(); a.play && a.play('quick'); });
    for (const b of document.querySelectorAll('.btn-mode')) {
      b.addEventListener('click', () => { this.click(); a.play && a.play(b.dataset.mode); });
    }
    $('btn-quit').addEventListener('click', () => { this.click(); a.quit && a.quit(); });
    $('btn-ranking').addEventListener('click', () => { this.click(); this.openRanking(); });
    $('btn-stats').addEventListener('click', () => { this.click(); this.openStats(); });
    $('btn-settings').addEventListener('click', () => { this.click(); this.openSettings(); });
    $('modal-close').addEventListener('click', () => { this.click(); this.closeModal(); });
    this.el.modal.addEventListener('click', (e) => { if (e.target === this.el.modal) this.closeModal(); });
    this.el.btnPrimary.addEventListener('click', () => { this.click(); a.advance && a.advance(); });
    this.el.btnSecondary.addEventListener('click', () => {
      this.click();
      if (this._secondaryKind === 'newSetup') a.newSetup && a.newSetup();
      else a.quit && a.quit();
    });
    this.el.btnShare.addEventListener('click', async () => {
      this.click();
      const ok = this.actions.share && (await this.actions.share());
      if (!ok) this.showToast(t('share.title'), t('share.beat'), 1800);
    });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeModal(); });
  }

  click() { this.audio.unlock(); this.audio.play('ui'); this.haptics.buzz(6); }

  applyLanguage() {
    setLanguage(this.save.data.settings.lang);
    document.documentElement.lang = getLanguage();
    $('title1').textContent = t('app.title1');
    $('title2').textContent = t('app.title2');
    $('tagline').textContent = t('home.tagline');
    $('btn-play').textContent = t('home.play');
    $('btn-mode-three').textContent = t('home.three');
    $('btn-mode-daily').textContent = t('home.daily');
    $('btn-mode-beat').textContent = t('home.beat');
    $('lbl-best').textContent = t('home.best');
    $('lbl-today').textContent = t('home.today');
    $('btn-ranking').textContent = t('home.ranking');
    $('btn-stats').textContent = t('home.stats');
    $('btn-settings').textContent = t('home.settings');
    this.el.targetLabel.textContent = t('hud.target');
    this.el.finalShot.textContent = t('hud.finalShot');
    document.documentElement.dataset.contrast = this.save.data.settings.highContrast ? 'high' : 'normal';
    this.refreshHome();
  }

  // ----------------------------------------------------------------- SCREENS
  setScreen(name) {
    this.el.home.hidden = name !== 'home';
    this.el.hud.hidden = name !== 'game';
    if (name !== 'game') this.hideResult();
    if (name === 'home') this.refreshHome();
  }

  refreshHome() {
    const d = this.save.data;
    this.el.homeBest.innerHTML = d.records.bestM == null
      ? '--'
      : `${formatMm(toMm(d.records.bestM))}<span class="unit">mm</span>`;
    const dayBest = d.records.today && d.records.today.bestM;
    if (dayBest == null) {
      this.el.homeToday.textContent = '--';
    } else {
      const ch = createChallenge(dailyId());
      const board = buildBoard(ch, dayBest, t('rank.you'));
      this.el.homeToday.textContent = t('home.rank', { rank: playerRank(board) });
    }
  }

  // --------------------------------------------------------------------- HUD
  updateHud(info) {
    const el = this.el;
    if (Number.isFinite(info.maxAttempts)) {
      el.attempt.textContent = t('hud.attempt', { n: info.attempt, total: info.maxAttempts });
    } else {
      el.attempt.textContent = t(`mode.${info.modeId}`);
    }
    el.setup.textContent = info.setupLabel;
    el.mutator.hidden = !info.mutatorLabel;
    el.mutator.textContent = info.mutatorLabel || '';
    el.finalShot.hidden = !info.finalShot;
    if (info.target) {
      el.targetChip.hidden = false;
      el.targetName.textContent = info.target.name;
      el.targetValue.textContent = `${formatMm(info.target.mm)} mm`;
      el.targetName.style.color = info.target.color;
    } else if (info.best != null) {
      el.targetChip.hidden = false;
      el.targetLabel.textContent = t('hud.best');
      el.targetName.textContent = t('hud.you');
      el.targetName.style.color = '#ffffff';
      el.targetValue.textContent = `${formatMm(toMm(info.best))} mm`;
    } else {
      el.targetChip.hidden = true;
    }
  }

  setMeter(power) {
    const p = clamp01(power);
    this.el.meterFill.style.width = `${(p * 100).toFixed(2)}%`;
    this.el.meterValue.textContent = `${Math.round(p * 100)}%`;
    this.el.meter.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    this.el.meter.classList.toggle('hot', p > 0.82);
  }

  setPrompt(text, small = false) {
    this.el.prompt.textContent = text;
    this.el.prompt.classList.toggle('small', small);
    this.el.prompt.style.opacity = text ? '0.9' : '0';
  }

  // ------------------------------------------------------------------ RESULT
  showResult(p) {
    const el = this.el;
    const r = p.result;
    const copy = resultCopy(p);
    el.resultZone.textContent = copy.zone;
    el.resultZone.style.color = copy.zoneColor;
    el.resultNumber.textContent = copy.number;
    el.resultSub.textContent = copy.sub;
    el.resultSub.className = `result-sub ${copy.subClass}`;
    el.resultNote.textContent = copy.note;
    el.btnPrimary.textContent = copy.primary;
    this._secondaryKind = copy.secondaryKind || 'home';
    el.btnSecondary.hidden = !copy.secondary;
    if (copy.secondary) el.btnSecondary.textContent = copy.secondary;
    el.btnShare.hidden = !copy.share;
    el.resultHint.textContent = copy.hint || '';

    if (copy.versus) {
      el.resultVersus.hidden = false;
      el.vsYouName.textContent = copy.versus.youName;
      el.vsYouVal.textContent = copy.versus.you;
      el.vsRivalName.textContent = copy.versus.rivalName;
      el.vsRivalVal.textContent = copy.versus.rival;
      el.vsRivalName.style.color = copy.versus.rivalColor || '';
    } else {
      el.resultVersus.hidden = true;
    }

    el.result.hidden = false;
    // Re-trigger the entry animation
    el.result.querySelector('.result-card').style.animation = 'none';
    void el.result.offsetWidth;
    el.result.querySelector('.result-card').style.animation = '';
    this.refreshHome();
  }

  hideResult() { this.el.result.hidden = true; }

  // ------------------------------------------------------------------ EXTRAS
  flash(intensity = 0.25) {
    if (this.save.data.settings.reduceFx) return;
    const f = this.el.flash;
    f.style.setProperty('--i', String(intensity));
    f.style.opacity = String(intensity);
    f.classList.add('on');
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      f.classList.remove('on');
      f.style.opacity = '0';
    }, 40);
  }

  showToast(title, sub, ms = 2600) {
    // Two unlocks can land on the same shot: queue instead of stomping.
    if (this._toastBusy) {
      (this._toastQueue = this._toastQueue || []).push([title, sub, ms]);
      return;
    }
    this._toastBusy = true;
    const el = this.el.toast;
    el.innerHTML = '';
    const a = document.createElement('div'); a.className = 't-title'; a.textContent = title;
    const b = document.createElement('div'); b.className = 't-sub'; b.textContent = sub;
    el.append(a, b);
    el.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      el.hidden = true;
      this._toastBusy = false;
      const next = this._toastQueue && this._toastQueue.shift();
      if (next) this.showToast(next[0], next[1], next[2]);
    }, ms);
  }

  // ------------------------------------------------------------------ MODALS
  openModal(title, build) {
    this.el.modalTitle.textContent = title;
    this.el.modalBody.innerHTML = '';
    build(this.el.modalBody);
    this.el.modal.hidden = false;
  }
  closeModal() { this.el.modal.hidden = true; this._resetArmed = false; }

  openRanking() {
    const d = this.save.data;
    const ch = createChallenge(dailyId());
    const board = buildBoard(ch, d.records.today && d.records.today.day === todayKey() ? d.records.today.bestM : (d.daily.day === todayKey() ? d.daily.bestM : null), t('rank.you'));
    this.openModal(t('rank.title'), (body) => {
      const sub = document.createElement('div');
      sub.className = 'rank-sub';
      sub.textContent = `${t('rank.today')} · ${ch.surface.name} · ${ch.object.name}`;
      body.appendChild(sub);
      const all = board.filter((e) => e.marginM != null).map((e) => e.mm);
      for (const e of board) {
        const row = document.createElement('div');
        row.className = `rank-row${e.isPlayer ? ' me' : ''}`;
        const pos = document.createElement('div');
        pos.className = 'rank-pos';
        pos.textContent = e.marginM == null ? '--' : `${e.rank}`;
        const dot = document.createElement('div');
        dot.className = 'rank-dot';
        dot.style.background = e.color;
        const name = document.createElement('div');
        name.className = 'rank-name';
        name.textContent = e.name;
        const val = document.createElement('div');
        val.className = 'rank-val';
        val.textContent = e.marginM == null ? t('rank.empty') : `${formatMmDistinct(e.mm, all)} mm`;
        row.append(pos, dot, name, val);
        body.appendChild(row);
      }
    });
  }

  openStats() {
    const d = this.save.data;
    const s = d.stats;
    this.openModal(t('stats.title'), (body) => {
      const rows = [
        [t('stats.best'), d.records.bestM == null ? '--' : `${formatMm(toMm(d.records.bestM))} mm`, true],
        [t('stats.attempts'), s.attempts],
        [t('stats.falls'), s.falls],
        [t('stats.closeCalls'), s.closeCalls],
        [t('stats.nearMisses'), s.nearMisses],
        [t('stats.rivalsBeaten'), s.rivalsBeaten],
        [t('stats.streak'), s.streak],
        [t('stats.bestStreak'), s.bestStreak],
        [t('stats.eliteZone'), (s.zones.elite || 0) + (s.zones.legendary || 0)],
      ];
      for (const [label, value, hot] of rows) {
        const row = document.createElement('div');
        row.className = 'row';
        const l = document.createElement('span'); l.textContent = label;
        const v = document.createElement('span'); v.className = `val${hot ? ' hot' : ''}`; v.textContent = String(value);
        row.append(l, v);
        body.appendChild(row);
      }
      const reset = document.createElement('button');
      reset.className = 'btn';
      reset.style.marginTop = '14px';
      reset.textContent = t('stats.reset');
      reset.addEventListener('click', () => {
        if (!this._resetArmed) {
          this._resetArmed = true;
          reset.textContent = t('stats.resetConfirm');
          return;
        }
        this.save.reset();
        this.applyLanguage();
        this.closeModal();
        this.actions.saveReset && this.actions.saveReset();
      });
      body.appendChild(reset);
    });
  }

  openSettings() {
    const st = this.save.data.settings;
    this.openModal(t('set.title'), (body) => {
      // Language
      const langRow = document.createElement('div');
      langRow.className = 'row';
      const ll = document.createElement('span'); ll.textContent = t('set.lang');
      const wrap = document.createElement('span');
      for (const lang of LANGUAGES) {
        const b = document.createElement('button');
        b.className = `toggle${st.lang === lang.id ? ' on' : ''}`;
        b.style.marginLeft = '6px';
        b.textContent = lang.label;
        b.addEventListener('click', () => {
          this.click();
          this.save.update((d) => { d.settings.lang = lang.id; });
          this.applyLanguage();
          this.openSettings();
        });
        wrap.appendChild(b);
      }
      langRow.append(ll, wrap);
      body.appendChild(langRow);

      const toggles = [
        ['sound', t('set.sound'), (v) => this.audio.setEnabled(v)],
        ['haptics', t('set.haptics'), (v) => this.haptics.setEnabled(v)],
        ['shake', t('set.shake'), null],
        ['reduceFx', t('set.reduceFx'), null],
        ['highContrast', t('set.contrast'), () => { document.documentElement.dataset.contrast = this.save.data.settings.highContrast ? 'high' : 'normal'; }],
      ];
      for (const [key, label, apply] of toggles) {
        const row = document.createElement('div');
        row.className = 'row';
        const l = document.createElement('span'); l.textContent = label;
        const b = document.createElement('button');
        const paint = () => {
          const on = !!this.save.data.settings[key];
          b.className = `toggle${on ? ' on' : ''}`;
          b.textContent = on ? t('set.on') : t('set.off');
          b.setAttribute('aria-pressed', String(on));
        };
        b.addEventListener('click', () => {
          this.save.update((d) => { d.settings[key] = !d.settings[key]; });
          paint();
          if (apply) apply(this.save.data.settings[key]);
          this.click();
        });
        paint();
        row.append(l, b);
        body.appendChild(row);
      }
      const hint = document.createElement('div');
      hint.className = 'rank-sub';
      hint.style.marginTop = '14px';
      hint.textContent = `${t('set.keys')} · v${GameConfig.version}`;
      body.appendChild(hint);
    });
  }
}

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Result copy. Short, competitive, never neutral (spec 17/28/68).
 */
export function resultCopy(p) {
  const r = p.result;
  const target = p.target;
  const out = { zoneColor: '#38e8ff', hint: '', versus: null, secondary: null };

  if (r.fell) {
    out.zone = t('result.tooFar');
    out.zoneColor = '#ff4d3d';
    out.number = formatMm(r.overshootMm);
    out.sub = t('result.pastEdge', { d: formatMm(r.overshootMm) });
    out.subClass = 'fail';
    out.note = r.nearMiss ? t('result.soClose') : '';
    out.primary = t('btn.again');
    if (p.finished) { out.primary = t('btn.done'); out.secondary = t('btn.home'); out.secondaryKind = 'home'; }
    else if (p.canChangeSetup) { out.secondary = t('btn.newSetup'); out.secondaryKind = 'newSetup'; }
    return out;
  }

  out.zone = t(`zone.${r.zoneId}`);
  const zoneCfg = GameConfig.zones.find((z) => z.id === r.zoneId);
  out.zoneColor = zoneCfg ? zoneCfg.color : '#38e8ff';
  out.number = formatMm(r.mm);

  const beatenTarget = target && r.marginM < target.marginM;
  const wasBeaten = p.beaten && p.beaten.length ? p.beaten[0] : null;

  if (p.isAllTimeBest) {
    out.sub = t('result.newBest');
    out.subClass = 'best';
  } else if (wasBeaten) {
    out.sub = t('result.beaten', { name: wasBeaten.name, d: formatMm(wasBeaten.mm - r.mm) });
    out.subClass = 'beaten';
  } else if (p.isChallengeBest) {
    out.sub = t('result.newRecord');
    out.subClass = 'best';
  } else if (p.stillLeads) {
    out.sub = t('result.stillLeads', { name: p.stillLeads.name });
    out.subClass = 'lose';
  } else {
    out.sub = r.hanging ? t('result.onTheBrink') : t(`zone.${r.zoneId}`);
    out.subClass = '';
  }

  if (r.absurd) out.note = t('result.absurd');
  else if (r.hanging) out.note = t('result.hanging', { d: formatMm(r.overhangMm) });
  else if (p.stillLeads) out.note = t('result.toBeat', { d: formatMm(r.mm - p.stillLeads.mm) });
  else out.note = '';

  if (p.rank === 1 && p.board && p.board.length > 1) {
    out.sub = t('result.tookFirst');
    out.subClass = 'best';
  }

  if (target) {
    out.versus = {
      youName: t('result.you'),
      you: `${formatMm(r.mm)} mm`,
      rivalName: target.name,
      rival: `${formatMm(target.mm)} mm`,
      rivalColor: target.color,
    };
  }

  if (p.finished) {
    const best = p.match.best;
    out.sub = best ? t('result.finalBest') : t('result.noScore');
    out.subClass = best ? 'best' : 'lose';
    out.number = best ? formatMm(toMm(best.marginM)) : '--';
    out.zone = best ? t(`zone.${best.zoneId}`) : t('zone.fall');
    out.primary = t('btn.again');
    out.secondary = t('btn.home');
    out.secondaryKind = 'home';
    out.share = !!best;
    out.note = p.rank ? t('home.rank', { rank: p.rank }) : '';
    return out;
  }

  if (p.stillLeads) out.primary = t('btn.revenge');
  else if (beatenTarget) out.primary = t('btn.nextRival');
  else out.primary = t('btn.oneMore');
  if (p.canChangeSetup) { out.secondary = t('btn.newSetup'); out.secondaryKind = 'newSetup'; }
  out.share = !!(p.isAllTimeBest || p.rank === 1);
  if (Number.isFinite(p.attemptsLeft)) out.hint = t('hud.attempt', { n: p.match.attempt + 1, total: p.match.maxAttempts });
  return out;
}
