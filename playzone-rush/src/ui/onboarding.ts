/**
 * Primera apertura: como quieres jugar.
 *
 * Tres caminos y ninguno pide email: crear grupo, entrar con un codigo, o
 * probar solo (que funciona sin backend y sin conexion, como hasta ahora).
 */
import { ApiError, NetworkError } from '../net/client';
import type { App } from './app';
import { compartirTexto } from './compartir';
import { textoInvitacion } from '../meta/compartir';
import { button, el } from './dom';

type Step = 'welcome' | 'create' | 'join' | 'code';

export function renderOnboarding(app: App): HTMLElement {
  const screen = el('div', { class: 'screen onboarding' });
  let step: Step = 'welcome';
  let createdCode = '';

  const body = el('div', { class: 'onboarding__body' });

  const render = () => {
    body.replaceChildren();
    if (step === 'welcome') body.appendChild(renderWelcome());
    else if (step === 'create') body.appendChild(renderCreate());
    else if (step === 'join') body.appendChild(renderJoin());
    else body.appendChild(renderCode());
  };

  const goto = (next: Step) => {
    step = next;
    app.audio.unlock();
    app.audio.play('select');
    render();
  };

  /* ---------------- pantallas ---------------- */

  function renderWelcome(): HTMLElement {
    return el('div', { class: 'onboarding__panel' }, [
      el('div', { class: 'onboarding__kicker', text: '¿COMO QUIERES JUGAR?' }),
      el('div', { class: 'onboarding__options' }, [
        button('CREAR GRUPO', 'btn btn--play btn--lg btn--block', () => goto('create')),
        button('UNIRME A UN GRUPO', 'btn btn--lg btn--block', () => goto('join')),
      ]),
      el('div', { class: 'onboarding__hint', text: 'Sin registro, sin email. Un codigo y ya esta.' }),
      button('PROBAR SOLO', 'btn btn--ghost btn--block onboarding__solo', () => {
        app.audio.unlock();
        app.playSolo();
      }),
      el('div', {
        class: 'onboarding__hint',
        text: 'PROBAR SOLO usa rivales simulados y funciona sin conexion.',
      }),
    ]);
  }

  function renderCreate(): HTMLElement {
    const input = nameInput(app.save.get().profile.name);
    const error = el('div', { class: 'onboarding__error' });
    const submit = button('CREAR GRUPO', 'btn btn--play btn--lg btn--block', async () => {
      const name = input.value.trim();
      if (name.length === 0) {
        error.textContent = 'Escribe un nombre.';
        return;
      }
      submit.disabled = true;
      submit.textContent = 'CREANDO...';
      try {
        await app.createGroup(name);
        createdCode = app.save.get().account.groupCode ?? '';
        app.audio.play('unlock');
        goto('code');
      } catch (err) {
        error.textContent = describeError(err);
        submit.disabled = false;
        submit.textContent = 'CREAR GRUPO';
      }
    });

    return el('div', { class: 'onboarding__panel' }, [
      backLink(() => goto('welcome')),
      el('div', { class: 'onboarding__kicker', text: 'TU NOMBRE EN EL GRUPO' }),
      input,
      error,
      submit,
    ]);
  }

  function renderJoin(): HTMLElement {
    const codeField = el('input', {
      class: 'onboarding__input onboarding__input--code',
      attrs: {
        type: 'text',
        inputmode: 'text',
        autocapitalize: 'characters',
        autocomplete: 'off',
        spellcheck: 'false',
        maxlength: '8',
        placeholder: 'CODIGO',
        'aria-label': 'Codigo del grupo',
      },
    }) as HTMLInputElement;
    codeField.addEventListener('input', () => {
      codeField.value = codeField.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });

    const input = nameInput(app.save.get().profile.name);
    const error = el('div', { class: 'onboarding__error' });
    const submit = button('ENTRAR', 'btn btn--play btn--lg btn--block', async () => {
      const code = codeField.value.trim();
      const name = input.value.trim();
      if (code.length < 4) {
        error.textContent = 'El codigo tiene 4 caracteres.';
        return;
      }
      if (name.length === 0) {
        error.textContent = 'Escribe un nombre.';
        return;
      }
      submit.disabled = true;
      submit.textContent = 'ENTRANDO...';
      try {
        await app.joinGroup(code, name);
        app.audio.play('unlock');
      } catch (err) {
        error.textContent = describeError(err);
        submit.disabled = false;
        submit.textContent = 'ENTRAR';
      }
    });

    return el('div', { class: 'onboarding__panel' }, [
      backLink(() => goto('welcome')),
      el('div', { class: 'onboarding__kicker', text: 'CODIGO DEL GRUPO' }),
      codeField,
      el('div', { class: 'onboarding__kicker', text: 'TU NOMBRE' }),
      input,
      error,
      submit,
    ]);
  }

  function renderCode(): HTMLElement {
    const code = createdCode || (app.save.get().account.groupCode ?? '');
    const feedback = el('div', { class: 'onboarding__hint' });

    const copy = button('COPIAR', 'btn btn--block', async () => {
      const ok = await copyToClipboard(code);
      feedback.textContent = ok ? 'Codigo copiado.' : 'Copialo a mano: ' + code;
      app.audio.play('tap');
    });

    const share = button('COMPARTIR', 'btn btn--block', async () => {
      // Mismo texto que en la portada: se invita igual desde los dos sitios.
      const que = await compartirTexto(textoInvitacion(code));
      if (que === 'copiado') feedback.textContent = 'Invitacion copiada.';
    });

    return el('div', { class: 'onboarding__panel' }, [
      el('div', { class: 'onboarding__kicker', text: 'TU GRUPO' }),
      el(
        'div',
        { class: 'invita__codigo onboarding__code' },
        code.split('').map((letra) => el('span', { class: 'invita__letra', text: letra })),
      ),
      el('div', { class: 'onboarding__hint', text: 'COMPARTELO CON TUS AMIGOS' }),
      el('div', { class: 'onboarding__row' }, [copy, share]),
      feedback,
      button('ENTRAR A PLAYZONE', 'btn btn--play btn--lg btn--block', () => {
        app.renderHome();
      }),
    ]);
  }

  /* ---------------- piezas ---------------- */

  function nameInput(value: string): HTMLInputElement {
    const input = el('input', {
      class: 'onboarding__input',
      attrs: {
        type: 'text',
        maxlength: '16',
        autocomplete: 'off',
        autocapitalize: 'characters',
        spellcheck: 'false',
        placeholder: 'TU NOMBRE',
        value: value === 'ELOI' ? '' : value,
        'aria-label': 'Tu nombre',
      },
    }) as HTMLInputElement;
    return input;
  }

  function backLink(onBack: () => void): HTMLElement {
    return button('‹ VOLVER', 'onboarding__back', onBack);
  }

  screen.appendChild(
    el('div', { class: 'onboarding__head' }, [
      el('div', { class: 'brand brand--big' }, [
        el('span', { class: 'brand__zone', text: 'PLAYZONE' }),
        el('span', { class: 'brand__rush', text: 'RUSH' }),
      ]),
      el('div', { class: 'onboarding__tagline', text: 'Retos diarios. Tu grupo. Revancha.' }),
    ]),
  );
  screen.appendChild(body);
  render();
  return screen;
}

/** Mensajes de error en cristiano: nada de codigos tecnicos en pantalla. */
export function describeError(error: unknown): string {
  if (error instanceof NetworkError) return 'Sin conexion con PLAYZONE. Comprueba la Wi-Fi.';
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'group_not_found':
        return 'Ese grupo no existe. Revisa el codigo.';
      case 'group_full':
        return 'El grupo esta completo.';
      case 'invalid_name':
        return 'Ese nombre no vale. Prueba con otro.';
      case 'rate_limited':
        return 'Demasiados intentos seguidos. Espera unos segundos.';
      default:
        return 'Algo ha fallado en el servidor. Intentalo otra vez.';
    }
  }
  return 'Algo ha fallado. Intentalo otra vez.';
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Safari sin permisos: al menos dejamos el codigo seleccionable.
    return false;
  }
}
