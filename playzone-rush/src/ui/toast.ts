import { el } from './dom';

export type ToastTone = 'good' | 'bad' | 'gold' | 'neutral';

/** Avisos cortos que no interrumpen: desbloqueos, records, adelantamientos. */
export class Toaster {
  private root: HTMLElement;

  constructor(parent: HTMLElement = document.body) {
    this.root = el('div', { class: 'toaster' });
    parent.appendChild(this.root);
  }

  show(text: string, tone: ToastTone = 'neutral', ms = 2200): void {
    const node = el('div', { class: `toast toast--${tone}`, text });
    this.root.appendChild(node);
    setTimeout(() => {
      node.style.transition = 'opacity 200ms, transform 200ms';
      node.style.opacity = '0';
      node.style.transform = 'translateY(-8px)';
      setTimeout(() => node.remove(), 220);
    }, ms);
  }

  clear(): void {
    this.root.replaceChildren();
  }
}
