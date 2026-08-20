// Teacher dashboard controller: login gate → tabbed dashboard (Results + Escape Builder).

import { el, clear, mount } from '../../engine/dom.js';
import { apiEnabled, isLoggedIn, login, logout } from '../../engine/apiClient.js';
import { renderTeacherResults } from './results.js';
import { renderBuilder } from './builder.js';

export function renderTeacher(root, { onExit, onRefresh } = {}) {
  if (!apiEnabled()) {
    clear(root);
    root.appendChild(el('div', { class: 'hub' }, [
      el('div', { class: 'not-found' }, [
        el('h1', {}, 'Teacher dashboard unavailable'),
        el('p', {}, 'The backend API is not configured for this site.'),
        el('button', { class: 'btn btn-primary', on: { click: onExit } }, '← Back to the Hub'),
      ]),
    ]));
    return;
  }

  if (!isLoggedIn()) return renderLogin(root, { onExit, onSuccess: () => renderDashboard(root, { onExit, onRefresh }) });
  renderDashboard(root, { onExit, onRefresh });
}

function renderLogin(root, { onExit, onSuccess }) {
  const pw = el('input', { type: 'password', class: 'field', placeholder: 'Teacher password', autocomplete: 'current-password' });
  const msg = el('div', { class: 'message error', hidden: true });
  const btn = el('button', { class: 'btn btn-primary', on: { click: submit } }, 'Log in');

  pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  async function submit() {
    msg.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Logging in…';
    try {
      await login(pw.value);
      onSuccess();
    } catch (err) {
      msg.textContent = err.status === 401
        ? 'Incorrect password.'
        : err.status === 429
          ? 'Too many attempts. Please wait a minute and try again.'
          : (err.message || 'Login failed.');
      msg.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Log in';
    }
  }

  mount(root, el('div', { class: 'teacher-login' }, [
    el('div', { class: 'login-card' }, [
      el('div', { class: 'login-badge' }, '🔑'),
      el('h1', {}, 'Teacher sign-in'),
      el('p', { class: 'login-sub' }, 'Log in to review results and build escape rooms.'),
      pw,
      msg,
      btn,
      el('button', { class: 'link-btn', on: { click: onExit } }, '← Back to the Hub'),
    ]),
  ]));
}

function renderDashboard(root, { onExit, onRefresh }) {
  let activeTab = 'builder';
  const content = el('div', { class: 'dash-content' });

  function tabBtn(id, label, icon) {
    return el('button', {
      class: 'dash-tab' + (activeTab === id ? ' active' : ''),
      on: {
        click: () => {
          activeTab = id;
          for (const b of tabs.querySelectorAll('.dash-tab')) b.classList.remove('active');
          tabsById[id].classList.add('active');
          renderTab();
        },
      },
    }, [icon ? `${icon} ` : '', label]);
  }

  const tabsById = {
    results: tabBtn('results', 'Results', '📊'),
    builder: tabBtn('builder', 'Escape Builder', '🛠️'),
  };
  const tabs = el('div', { class: 'dash-tabs' }, [tabsById.builder, tabsById.results]);

  function renderTab() {
    clear(content);
    if (activeTab === 'results') renderTeacherResults(content);
    else renderBuilder(content, { onPublished: onRefresh });
  }

  mount(root, el('div', { class: 'dashboard' }, [
    el('header', { class: 'dash-header' }, [
      el('div', { class: 'dash-brand' }, [
        el('span', { class: 'dash-logo' }, '🎓'),
        el('div', {}, [
          el('h1', { class: 'dash-title' }, 'Teacher Dashboard'),
          el('p', { class: 'dash-sub' }, 'Build escapes and review your classes\u2019 results'),
        ]),
      ]),
      el('div', { class: 'dash-actions' }, [
        el('button', { class: 'btn btn-ghost', on: { click: onExit } }, 'View site ↗'),
        el('button', { class: 'btn btn-ghost', on: { click: () => { logout(); renderTeacher(root, { onExit, onRefresh }); } } }, 'Log out'),
      ]),
    ]),
    tabs,
    content,
  ]));

  renderTab();
}
