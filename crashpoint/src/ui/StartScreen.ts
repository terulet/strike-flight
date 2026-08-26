export class StartScreen {
  el: HTMLDivElement;

  constructor(private onStart: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'cp-overlay';
    this.el.innerHTML = `
      <h1 class="cp-title">CRASH<span class="accent">POINT</span></h1>
      <div class="cp-subtitle">THE TOWER</div>
      <button class="cp-btn" id="cp-demolish-btn">DEMOLISH</button>
      <div class="cp-tag">Placeholder art · Prototipo vertical slice · PLAYZONE</div>
    `;
    this.el.querySelector('#cp-demolish-btn')!.addEventListener('click', () => this.onStart());
  }

  show(): void {
    this.el.classList.remove('cp-hidden');
  }

  hide(): void {
    this.el.classList.add('cp-hidden');
  }
}
