/** Utilidades de DOM. Lo justo para no escribir document.createElement 400 veces. */
export interface ElOptions {
  class?: string;
  text?: string;
  html?: string;
  style?: Partial<CSSStyleDeclaration>;
  attrs?: Record<string, string>;
  on?: Partial<Record<keyof HTMLElementEventMap, (ev: Event) => void>>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElOptions = {},
  children: (Node | string | null | false | undefined)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.class) node.className = options.class;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.html !== undefined) node.innerHTML = options.html;
  if (options.attrs) for (const [key, value] of Object.entries(options.attrs)) node.setAttribute(key, value);
  if (options.style) Object.assign(node.style, options.style);
  if (options.on) {
    for (const [type, fn] of Object.entries(options.on)) {
      if (fn) node.addEventListener(type, fn as EventListener);
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Boton con feedback tactil inmediato (sin esperar al click de 300 ms). */
export function button(
  label: string,
  className: string,
  onPress: () => void,
  options: { disabled?: boolean } = {},
): HTMLButtonElement {
  const node = el('button', { class: className, text: label });
  node.type = 'button';
  if (options.disabled) node.disabled = true;
  node.addEventListener('click', (ev) => {
    ev.preventDefault();
    if (node.disabled) return;
    onPress();
  });
  return node;
}
