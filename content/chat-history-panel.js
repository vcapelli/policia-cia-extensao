// Painel flutuante de histórico de chat — busca, filtro por usuário e
// download, tudo dentro da própria tela do jogo (não precisa abrir o
// popup da extensão).
//
// NOTA: as abas "Geral"/"Sussurros" (como a Bananablet tem) exigiriam
// saber o TIPO de cada mensagem, e isso só dá pra descobrir capturando
// os pacotes do WebSocket (Fase 2) — nossa captura atual é via DOM, que
// não distingue isso. Por enquanto o painel mostra "Todos" só.
(function () {
  const STYLE_ID = 'ht-chat-panel-style';
  const PANEL_ID = 'ht-chat-panel';
  const LAUNCHER_ID = 'ht-chat-launcher';

  let filterUsers = new Set(); // vazio = todos
  let searchText = '';
  let panelOpen = false;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${LAUNCHER_ID} {
        position: fixed;
        bottom: 16px;
        right: 16px;
        z-index: 2147483000;
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: linear-gradient(180deg, #f59e0b, #d97706);
        color: #1f1300;
        font-size: 18px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(0,0,0,0.4);
        user-select: none;
        font-family: "Segoe UI", Arial, sans-serif;
      }
      #${LAUNCHER_ID}:hover { filter: brightness(1.08); }

      #${PANEL_ID} {
        position: fixed;
        bottom: 66px;
        right: 16px;
        z-index: 2147483000;
        width: 340px;
        max-width: calc(100vw - 32px);
        max-height: 60vh;
        display: none;
        flex-direction: column;
        background: rgba(15,15,20,0.96);
        border: 1px solid rgba(245,158,11,0.35);
        border-radius: 10px;
        color: #e5e7eb;
        font: 12px/1.4 "Segoe UI", Arial, sans-serif;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        overflow: hidden;
      }
      #${PANEL_ID}.open { display: flex; }

      .ht-chp-header {
        padding: 8px 10px;
        background: linear-gradient(90deg, #f59e0b, #f97316);
        color: #1f1300;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .ht-chp-close { cursor: pointer; font-weight: 900; padding: 0 4px; }

      .ht-chp-body { padding: 8px 10px; display: flex; flex-direction: column; gap: 8px; overflow: hidden; }

      .ht-chp-search {
        width: 100%;
        box-sizing: border-box;
        background: rgba(0,0,0,0.4);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 6px;
        color: #fff;
        padding: 6px 8px;
      }

      .ht-chp-users { display: flex; flex-wrap: wrap; gap: 5px; max-height: 70px; overflow-y: auto; }
      .ht-chp-pill {
        padding: 3px 8px;
        border-radius: 999px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.1);
        cursor: pointer;
        white-space: nowrap;
      }
      .ht-chp-pill.active {
        background: linear-gradient(180deg, #f59e0b, #d97706);
        color: #1f1300;
        border-color: transparent;
        font-weight: 700;
      }

      .ht-chp-list {
        flex: 1;
        overflow-y: auto;
        min-height: 120px;
        max-height: 240px;
        background: rgba(0,0,0,0.25);
        border-radius: 6px;
        padding: 6px 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .ht-chp-msg { line-height: 1.35; word-break: break-word; }
      .ht-chp-msg .ht-chp-time { color: #6b7280; margin-right: 4px; }
      .ht-chp-msg .ht-chp-name { color: #fbbf24; font-weight: 700; }
      .ht-chp-empty { color: #9ca3af; text-align: center; padding: 16px 0; }

      .ht-chp-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .ht-chp-stats { color: #9ca3af; font-size: 11px; }
      .ht-chp-download {
        background: linear-gradient(180deg, #f59e0b, #d97706);
        border: none;
        border-radius: 6px;
        color: #1f1300;
        font-weight: 800;
        padding: 6px 10px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  function buildPanel() {
    const panel = el('div');
    panel.id = PANEL_ID;

    const header = el('div', 'ht-chp-header');
    header.appendChild(el('span', null, '📜 Histórico de chat'));
    const close = el('span', 'ht-chp-close', '✕');
    close.addEventListener('click', () => togglePanel(false));
    header.appendChild(close);
    panel.appendChild(header);

    const body = el('div', 'ht-chp-body');

    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'ht-chp-search';
    search.placeholder = 'Buscar texto ou nick...';
    search.addEventListener('input', () => {
      searchText = search.value.trim();
      render();
    });
    body.appendChild(search);

    const users = el('div', 'ht-chp-users');
    users.id = 'ht-chp-users';
    body.appendChild(users);

    const list = el('div', 'ht-chp-list');
    list.id = 'ht-chp-list';
    body.appendChild(list);

    const footer = el('div', 'ht-chp-footer');
    const stats = el('span', 'ht-chp-stats');
    stats.id = 'ht-chp-stats';
    footer.appendChild(stats);
    const downloadBtn = el('button', 'ht-chp-download', 'Baixar histórico');
    downloadBtn.addEventListener('click', download);
    footer.appendChild(downloadBtn);
    body.appendChild(footer);

    panel.appendChild(body);
    (document.body || document.documentElement).appendChild(panel);
  }

  function buildLauncher() {
    const btn = el('div', null, '💬');
    btn.id = LAUNCHER_ID;
    btn.title = 'Histórico de chat';
    btn.addEventListener('click', () => togglePanel());
    (document.body || document.documentElement).appendChild(btn);
  }

  function togglePanel(force) {
    panelOpen = typeof force === 'boolean' ? force : !panelOpen;
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.classList.toggle('open', panelOpen);
    if (panelOpen) render();
  }

  function renderUsers() {
    const container = document.getElementById('ht-chp-users');
    if (!container || !window.__HT || !window.__HT.chatHistory) return;
    container.innerHTML = '';

    const todos = el('div', 'ht-chp-pill' + (filterUsers.size ? '' : ' active'), 'Todos');
    todos.addEventListener('click', () => {
      filterUsers.clear();
      render();
    });
    container.appendChild(todos);

    window.__HT.chatHistory.getUsers().forEach((name) => {
      const pill = el(
        'div',
        'ht-chp-pill' + (filterUsers.has(name) ? ' active' : ''),
        name
      );
      pill.addEventListener('click', () => {
        if (filterUsers.has(name)) filterUsers.delete(name);
        else filterUsers.add(name);
        render();
      });
      container.appendChild(pill);
    });
  }

  function renderList() {
    const list = document.getElementById('ht-chp-list');
    const statsEl = document.getElementById('ht-chp-stats');
    if (!list || !statsEl || !window.__HT || !window.__HT.chatHistory) return;

    const all = window.__HT.chatHistory.getAll();
    const filtered = window.__HT.chatHistory.getFiltered(Array.from(filterUsers), searchText);

    statsEl.textContent = `${filtered.length} de ${all.length} msgs`;

    list.innerHTML = '';
    if (!filtered.length) {
      list.appendChild(el('div', 'ht-chp-empty', 'Nenhuma mensagem encontrada.'));
      return;
    }
    // Mostra as últimas 200 pra não pesar o navegador.
    filtered.slice(-200).forEach((m) => {
      const row = el('div', 'ht-chp-msg');
      const time = el('span', 'ht-chp-time', new Date(m.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      const name = el('span', 'ht-chp-name', m.username + ': ');
      row.appendChild(time);
      row.appendChild(name);
      row.appendChild(document.createTextNode(m.text));
      list.appendChild(row);
    });
    list.scrollTop = list.scrollHeight;
  }

  function render() {
    if (!panelOpen) return;
    renderUsers();
    renderList();
  }

  function download() {
    if (!window.__HT || !window.__HT.chatHistory) return;
    window.__HT.chatHistory.download(Array.from(filterUsers), searchText);
  }

  function init() {
    injectStyle();
    buildLauncher();
    buildPanel();
    window.addEventListener('ht-chat-message', () => {
      if (panelOpen) render();
    });
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
