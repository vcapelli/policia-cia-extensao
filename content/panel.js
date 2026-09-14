// content/panel.js
// ISOLATED world / document_end
//
// Painel flutuante único da extensão — launcher no canto INFERIOR
// ESQUERDO da tela (substitui o antigo launcher de chat, que ficava à
// direita). Três abas:
//   - "Ponto":     bater ponto (iniciar/finalizar), adaptado do
//                   formulário HTML "Controle de Ponto" da CIA.
//   - "Histórico": lista de militares + histórico individual (expande
//                   inline ao clicar na linha, em vez de modal — não
//                   tem espaço pra um modal dentro do painel flutuante).
//   - "Chat":       o antigo painel de histórico de chat (busca, filtro
//                   por usuário, download), inalterado por baixo, só
//                   reestilizado.
//
// Depende de: theme.js (estilos), config.js (__HT.getSettings),
// ponto.js (__HT.ponto), chat-history.js (__HT.chatHistory).
(function () {
  const LAUNCHER_ID = 'ht-launcher';
  const PANEL_ID = 'ht-panel';
  const BADGE_URL = 'https://imaging.habblet.city/badge/b0913s02154s01134s19114s17118';

  let panelOpen = false;
  let activeTab = 'ponto'; // 'ponto' | 'historico' | 'chat'
  let settings = { ponto: true, chatHistory: true };

  let manualMode = false;

  // -- cronômetro da aba "Ponto" --
  let timerInterval = null;
  let timerStartedAt = null; // epoch ms desde quando o "Iniciar" foi clicado NESTA sessão do navegador
  let ultimoFeedback = null; // { ok: bool, texto: string } — sobrevive a um re-render da aba

  function formatDuracao(ms) {
    const totalSeg = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(totalSeg / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeg % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeg % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function tickTimer() {
    const el = document.getElementById('ht-ponto-timer');
    if (!el || !timerStartedAt) return;
    el.textContent = formatDuracao(Date.now() - timerStartedAt);
  }

  function startTimer() {
    timerStartedAt = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tickTimer, 1000);
  }

  function stopTimer() {
    timerStartedAt = null;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // -- chat tab state (portado do antigo chat-history-panel.js) --
  let filterUsers = new Set();
  let searchText = '';

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  function inicial(nome) {
    return (nome || '?').trim().charAt(0).toUpperCase() || '?';
  }

  // ------------------------------------------------------------
  // Launcher + shell do painel
  // ------------------------------------------------------------
  function buildLauncher() {
    const btn = el('div', null);
    btn.id = LAUNCHER_ID;
    btn.title = 'Habblet Tools';

    const img = document.createElement('img');
    img.src = BADGE_URL;
    img.alt = '';
    img.onerror = () => {
      img.remove();
      btn.appendChild(el('span', 'ht-launcher-fallback', '🕒'));
    };
    btn.appendChild(img);

    btn.addEventListener('click', () => togglePanel());
    (document.body || document.documentElement).appendChild(btn);
  }

  function buildPanel() {
    const panel = el('div');
    panel.id = PANEL_ID;

    const header = el('div', 'ht-panel-header');
    header.appendChild(el('span', 'ht-panel-title', 'CIA · Habblet Tools'));
    const close = el('span', 'ht-panel-close', '✕');
    close.addEventListener('click', () => togglePanel(false));
    header.appendChild(close);
    panel.appendChild(header);

    const tabbar = el('div', 'ht-tabbar');
    tabbar.id = 'ht-tabbar';
    panel.appendChild(tabbar);

    const body = el('div', 'ht-body');
    body.id = 'ht-body';
    panel.appendChild(body);

    (document.body || document.documentElement).appendChild(panel);
  }

  function togglePanel(force) {
    panelOpen = typeof force === 'boolean' ? force : !panelOpen;
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.classList.toggle('open', panelOpen);
    if (panelOpen) {
      if (window.__HT.ponto) window.__HT.ponto.init();
      render();
    }
  }

  function tabsDisponiveis() {
    const tabs = [];
    if (settings.ponto) tabs.push({ id: 'ponto', label: 'Ponto' });
    if (settings.ponto) tabs.push({ id: 'historico', label: 'Histórico' });
    if (settings.chatHistory) tabs.push({ id: 'chat', label: 'Chat' });
    return tabs;
  }

  function renderTabbar() {
    const tabbar = document.getElementById('ht-tabbar');
    if (!tabbar) return;
    tabbar.innerHTML = '';

    const tabs = tabsDisponiveis();
    if (!tabs.some((t) => t.id === activeTab) && tabs.length) {
      activeTab = tabs[0].id;
    }

    tabs.forEach((t) => {
      const tab = el('div', 'ht-tab' + (activeTab === t.id ? ' active' : ''), t.label);
      tab.addEventListener('click', () => {
        activeTab = t.id;
        render();
      });
      tabbar.appendChild(tab);
    });
  }

  function renderBody() {
    const body = document.getElementById('ht-body');
    if (!body) return;
    body.innerHTML = '';

    const tabs = tabsDisponiveis();
    if (!tabs.length) {
      body.appendChild(el('div', 'ht-empty', 'Nenhuma funcionalidade ativa. Ative "Ponto" ou "Gravar histórico de chat" no popup da extensão.'));
      return;
    }

    if (activeTab === 'ponto') renderPontoTab(body);
    else if (activeTab === 'historico') renderHistoricoTab(body);
    else if (activeTab === 'chat') renderChatTab(body);
  }

  function render() {
    if (!panelOpen) return;
    renderTabbar();
    renderBody();
  }

  // ------------------------------------------------------------
  // Aba "Ponto"
  // ------------------------------------------------------------
  function carregarAvatarInline(nick, imgEl, spanEl) {
    if (!window.__HT.ponto) return;
    window.__HT.ponto.urlAvatarPorNick(nick).then((url) => {
      if (!url || !imgEl.isConnected) return;
      imgEl.onload = () => imgEl.classList.add('pronto');
      imgEl.onerror = () => imgEl.classList.remove('pronto');
      imgEl.src = url;
    });
  }

  function buildAvatar(nick, size) {
    const wrap = el('div', 'ht-avatar');
    if (size) wrap.style.cssText = `width:${size}px;height:${size}px`;
    const img = document.createElement('img');
    img.alt = '';
    const span = el('span', 'ht-avatar-inicial', inicial(nick));
    wrap.appendChild(img);
    wrap.appendChild(span);
    if (nick) carregarAvatarInline(nick, img, span);
    return wrap;
  }

  function ativarAutocomplete(inputEl, aoSelecionar) {
    const wrapper = el('div', 'ht-suggest-wrap');
    inputEl.parentElement.insertBefore(wrapper, inputEl);
    wrapper.appendChild(inputEl);

    const dropdown = el('div', 'ht-suggest-dropdown');
    wrapper.appendChild(dropdown);

    inputEl.addEventListener('input', () => {
      const sugestoes = window.__HT.ponto.buscarSugestoes(inputEl.value);
      dropdown.innerHTML = '';
      if (!sugestoes.length) {
        dropdown.style.display = 'none';
        return;
      }
      sugestoes.forEach((u) => {
        const item = el('div', 'ht-suggest-item');
        item.appendChild(el('span', null, u.nickname));
        item.appendChild(el('span', 'ht-suggest-patente', u.patente));
        item.addEventListener('click', () => {
          inputEl.value = u.nickname;
          dropdown.style.display = 'none';
          aoSelecionar(u.nickname);
        });
        dropdown.appendChild(item);
      });
      dropdown.style.display = 'block';
    });

    document.addEventListener('click', (e) => {
      if (e.target !== inputEl) dropdown.style.display = 'none';
    });
  }

  function renderPontoTab(body) {
    const ponto = window.__HT.ponto;
    const autor = ponto ? ponto.getAutor() : null;
    const section = el('div', 'ht-card-section');

    if (!autor && !manualMode) {
      section.appendChild(el('div', 'ht-spinner-row', ''));
      const row = section.querySelector('.ht-spinner-row');
      const spin = el('span', 'ht-spin');
      row.appendChild(spin);
      row.appendChild(document.createTextNode('Identificando...'));
    } else if (!autor && manualMode) {
      section.appendChild(el('span', 'ht-label', 'Confirme seu nickname'));
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'ht-input';
      input.placeholder = 'Comece a digitar para buscar';
      input.autocomplete = 'off';
      const inputBlock = el('div', 'ht-input-block');
      inputBlock.appendChild(input);
      section.appendChild(inputBlock);
      section.appendChild(el('p', 'ht-hint', 'Não conseguimos identificar você automaticamente pela sessão do fórum.'));
      ativarAutocomplete(input, (nick) => {
        ponto.definirAutorManual(nick);
        render();
      });
    } else {
      const row = el('div', 'ht-row');
      row.appendChild(buildAvatar(autor.nick, 44));
      const info = el('div');
      info.appendChild(el('p', 'ht-greeting', 'Olá, ' + autor.nick + '.'));
      info.appendChild(el('p', 'ht-subtle', 'Registre seu ponto aqui:'));
      row.appendChild(info);
      section.appendChild(row);
    }

    body.appendChild(section);

    // Se o roster já mostra "Iniciado" pra esse nick (por exemplo, o
    // ponto foi iniciado numa sessão/aparelho anterior e o navegador foi
    // fechado/recarregado nesse meio tempo), bloqueia o "Iniciar" mesmo
    // sem termos o cronômetro ao vivo — não temos o horário exato de
    // início nesse caso, só sabemos que já está aberto.
    const meuRegistro = autor ? ponto.getMilitares().find((m) => m.nome === autor.nick) : null;
    const jaIniciadoAlhures = !!meuRegistro && meuRegistro.ultimoStatus === 'Iniciado' && !timerStartedAt;

    const actions = el('div', 'ht-row');
    const btnIn = el('button', 'ht-btn ht-btn-success', 'Iniciar');
    const btnOut = el('button', 'ht-btn ht-btn-danger', 'Finalizar');
    btnIn.disabled = !autor || !!timerStartedAt || jaIniciadoAlhures;
    btnOut.disabled = !autor;

    const feedback = el(
      'p',
      'ht-feedback' + (ultimoFeedback ? (ultimoFeedback.ok ? ' ok' : ' error') : ''),
      ultimoFeedback ? ultimoFeedback.texto : ''
    );

    function bater(tipo) {
      btnIn.disabled = true;
      btnOut.disabled = true;
      feedback.className = 'ht-feedback';
      feedback.textContent = 'Registrando...';
      ponto
        .baterPonto(tipo)
        .then(() => {
          ultimoFeedback = { ok: true, texto: 'Ponto registrado: ' + autor.nick + ' — ' + tipo + '.' };
          if (tipo === 'Iniciado') startTimer();
          else stopTimer();
          if (activeTab === 'ponto') renderBody();
        })
        .catch((err) => {
          ultimoFeedback = { ok: false, texto: err.message || 'Erro ao registrar o ponto.' };
          if (activeTab === 'ponto') renderBody();
        });
    }

    btnIn.addEventListener('click', () => bater('Iniciado'));
    btnOut.addEventListener('click', () => bater('Finalizado'));
    actions.appendChild(btnIn);
    actions.appendChild(btnOut);
    body.appendChild(actions);
    body.appendChild(feedback);

    if (timerStartedAt) {
      const timerEl = el('p', 'ht-ponto-counter', formatDuracao(Date.now() - timerStartedAt));
      timerEl.id = 'ht-ponto-timer';
      body.appendChild(timerEl);
    } else if (jaIniciadoAlhures) {
      body.appendChild(el('p', 'ht-hint', 'Ponto já iniciado anteriormente — clique em Finalizar pra encerrar.'));
    }

    if (!autor && !manualMode) {
      // dá um tempo pra detecção automática antes de oferecer o fallback manual
      window.addEventListener(
        'ht-ponto-manual',
        () => {
          manualMode = true;
          if (activeTab === 'ponto') renderBody();
        },
        { once: true }
      );
    }
  }

  // ------------------------------------------------------------
  // Aba "Histórico"
  // ------------------------------------------------------------
  function badgeClasse(status) {
    if (status === 'Iniciado') return 'iniciado';
    if (status === 'Finalizado') return 'finalizado';
    return '';
  }

  function renderHistoricoTab(body) {
    const ponto = window.__HT.ponto;
    const autor = ponto ? ponto.getAutor() : null;

    if (!autor) {
      body.appendChild(el('div', 'ht-empty', 'Identifique-se na aba "Ponto" pra ver seu histórico.'));
      return;
    }

    const header = el('div', 'ht-card-section');
    const row = el('div', 'ht-row');
    row.appendChild(buildAvatar(autor.nick, 36));
    const info = el('div');
    info.appendChild(el('p', 'ht-greeting', autor.nick));
    info.appendChild(el('p', 'ht-subtle', 'Seu histórico de ponto'));
    row.appendChild(info);
    header.appendChild(row);
    body.appendChild(header);

    const section = el('div', 'ht-card-section');
    const loading = el('div', 'ht-spinner-row');
    loading.appendChild(el('span', 'ht-spin'));
    loading.appendChild(document.createTextNode('Carregando...'));
    section.appendChild(loading);
    body.appendChild(section);

    ponto.buscarHistorico(autor.nick).then((registros) => {
      section.innerHTML = '';
      if (!registros.length) {
        section.appendChild(el('div', 'ht-empty', 'Sem registros ainda.'));
        return;
      }
      registros.forEach((r) => {
        const rowHist = el('div', 'ht-hist-row');
        rowHist.appendChild(el('span', null, r.data));
        rowHist.appendChild(el('span', null, r.horario));
        rowHist.appendChild(el('span', 'ht-status-badge ' + badgeClasse(r.tipo), r.tipo));
        section.appendChild(rowHist);
      });
    });
  }

  // ------------------------------------------------------------
  // Aba "Chat" (portado do antigo chat-history-panel.js)
  // ------------------------------------------------------------
  function renderChatTab(body) {
    if (!window.__HT.chatHistory) {
      body.appendChild(el('div', 'ht-empty', 'Captura de chat indisponível nesta página.'));
      return;
    }

    const section = el('div', 'ht-card-section');

    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'ht-input';
    search.placeholder = 'Buscar texto ou nick...';
    search.value = searchText;
    search.addEventListener('input', () => {
      searchText = search.value.trim();
      renderChatList();
    });
    const searchBlock = el('div', 'ht-input-block');
    searchBlock.appendChild(search);
    section.appendChild(searchBlock);

    const users = el('div', 'ht-pill-row');
    users.id = 'ht-chat-users';
    section.appendChild(users);

    const list = el('div', 'ht-msg-list');
    list.id = 'ht-chat-list';
    section.appendChild(list);

    const footer = el('div', 'ht-chat-footer');
    const stats = el('span', 'ht-chat-stats');
    stats.id = 'ht-chat-stats';
    footer.appendChild(stats);
    const downloadBtn = el('button', 'ht-btn ht-btn-neutral', 'Baixar histórico');
    downloadBtn.style.flex = '0 0 auto';
    downloadBtn.addEventListener('click', () => {
      window.__HT.chatHistory.download(Array.from(filterUsers), searchText);
    });
    footer.appendChild(downloadBtn);
    section.appendChild(footer);

    body.appendChild(section);
    renderChatUsers();
    renderChatList();
  }

  function renderChatUsers() {
    const container = document.getElementById('ht-chat-users');
    if (!container || !window.__HT.chatHistory) return;
    container.innerHTML = '';

    const todos = el('div', 'ht-pill' + (filterUsers.size ? '' : ' active'), 'Todos');
    todos.addEventListener('click', () => {
      filterUsers.clear();
      renderChatUsers();
      renderChatList();
    });
    container.appendChild(todos);

    window.__HT.chatHistory.getUsers().forEach((name) => {
      const pill = el('div', 'ht-pill' + (filterUsers.has(name) ? ' active' : ''), name);
      pill.addEventListener('click', () => {
        if (filterUsers.has(name)) filterUsers.delete(name);
        else filterUsers.add(name);
        renderChatUsers();
        renderChatList();
      });
      container.appendChild(pill);
    });
  }

  function renderChatList() {
    const list = document.getElementById('ht-chat-list');
    const statsEl = document.getElementById('ht-chat-stats');
    if (!list || !statsEl || !window.__HT.chatHistory) return;

    const all = window.__HT.chatHistory.getAll();
    const filtered = window.__HT.chatHistory.getFiltered(Array.from(filterUsers), searchText);

    statsEl.textContent = `${filtered.length} de ${all.length} msgs`;

    list.innerHTML = '';
    if (!filtered.length) {
      list.appendChild(el('div', 'ht-empty', 'Nenhuma mensagem encontrada.'));
      return;
    }
    filtered.slice(-200).forEach((m) => {
      const row = el('div', 'ht-msg');
      row.appendChild(el('span', 'ht-msg-time', new Date(m.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })));
      row.appendChild(el('span', 'ht-msg-name', m.username + ': '));
      row.appendChild(document.createTextNode(m.text));
      list.appendChild(row);
    });
    list.scrollTop = list.scrollHeight;
  }

  // ------------------------------------------------------------
  // Init
  // ------------------------------------------------------------
  function applySettings(s) {
    settings = { ponto: !!s.ponto, chatHistory: !!s.chatHistory };
    if (panelOpen) render();
    const launcher = document.getElementById(LAUNCHER_ID);
    if (launcher) launcher.style.display = settings.ponto || settings.chatHistory ? '' : 'none';
  }

  function init() {
    buildLauncher();
    buildPanel();

    window.addEventListener('ht-ponto-autor', () => {
      if (panelOpen && (activeTab === 'ponto' || activeTab === 'historico')) renderBody();
    });
    window.addEventListener('ht-ponto-roster', () => {
      if (panelOpen && activeTab === 'historico') renderBody();
    });
    window.addEventListener('ht-chat-message', () => {
      if (panelOpen && activeTab === 'chat') renderChatList();
    });

    if (window.__HT.getSettings) {
      window.__HT.getSettings((s) => applySettings(s));
      window.__HT.onSettingsChanged((changes) => {
        if (changes.ponto || changes.chatHistory) {
          window.__HT.getSettings((s) => applySettings(s));
        }
      });
    }
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
