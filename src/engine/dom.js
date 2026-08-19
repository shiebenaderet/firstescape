// Tiny DOM helper utilities used across the framework.
// Keeping these dependency-free keeps the whole project build-free and static-host friendly.

/**
 * Create an element with attributes/props and children.
 * @param {string} tag
 * @param {Object} [props] - attributes, `class`, `style` object, `dataset`, `on` handlers, or direct props.
 * @param {Array<Node|string>|Node|string} [children]
 * @returns {HTMLElement}
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props || {})) {
    if (value == null) continue;
    if (key === 'class' || key === 'className') {
      node.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(node.style, value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(node.dataset, value);
    } else if (key === 'html') {
      node.innerHTML = value;
    } else if (key === 'on' && typeof value === 'object') {
      for (const [evt, handler] of Object.entries(value)) {
        node.addEventListener(evt, handler);
      }
    } else if (key in node) {
      try {
        node[key] = value;
      } catch {
        node.setAttribute(key, value);
      }
    } else {
      node.setAttribute(key, value);
    }
  }

  appendChildren(node, children);
  return node;
}

export function appendChildren(node, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function mount(container, node) {
  clear(container);
  container.appendChild(node);
  return container;
}

/** Escape a string for safe insertion as text (used when building innerHTML). */
export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
