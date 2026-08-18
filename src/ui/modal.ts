import { button, el } from './dom';

/** Modal minimo (sin dependencias) para editar el nombre local. */
export function promptText(options: {
  title: string;
  value: string;
  maxLength?: number;
  onAccept: (value: string) => void;
}): void {
  const input = el('input', {
    class: 'modal__input',
    attrs: {
      type: 'text',
      value: options.value,
      maxlength: String(options.maxLength ?? 12),
      autocomplete: 'off',
      autocapitalize: 'characters',
      spellcheck: 'false',
    },
  }) as HTMLInputElement;

  const close = () => overlay.remove();
  const accept = () => {
    const value = input.value.trim().toUpperCase().slice(0, options.maxLength ?? 12);
    if (value.length > 0) options.onAccept(value);
    close();
  };

  const overlay = el('div', { class: 'modal' }, [
    el('div', { class: 'modal__card' }, [
      el('div', { class: 'modal__title', text: options.title }),
      input,
      el('div', { class: 'modal__actions' }, [
        button('CANCELAR', 'btn btn--ghost', close),
        button('GUARDAR', 'btn btn--play', accept),
      ]),
    ]),
  ]);

  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) close();
  });
  input.addEventListener('keydown', (ev) => {
    if ((ev as KeyboardEvent).key === 'Enter') accept();
    if ((ev as KeyboardEvent).key === 'Escape') close();
  });

  document.body.appendChild(overlay);
  setTimeout(() => {
    input.focus();
    input.select();
  }, 30);
}
