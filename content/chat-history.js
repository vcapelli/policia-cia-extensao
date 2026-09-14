// Captura mensagens de chat do DOM, guarda em memória e permite exportar
// (com filtro opcional por um ou mais usuários + busca de texto) como
// arquivo .txt.
//
// Os seletores abaixo são um CHUTE INICIAL baseado na estrutura comum de
// clients de Habbo (tipo "Nitro"): balões de chat com classe ".chat-bubble"
// e o nome do usuário em ".username" dentro do balão. Confirme no seu
// navegador (Inspecionar elemento numa mensagem) e ajuste se precisar.
const MESSAGE_SELECTOR = '.chat-bubble';
const USERNAME_SELECTOR = '.username';

(function () {
  const history = [];
  let enabled = true;

  function extractText(el) {
    const clone = el.cloneNode(true);
    const userEl = clone.querySelector(USERNAME_SELECTOR);
    if (userEl) userEl.remove();
    return clone.textContent.trim();
  }

  function captureNode(el) {
    if (!enabled) return;
    const userEl = el.querySelector(USERNAME_SELECTOR);
    const username = userEl ? userEl.textContent.trim() : '(desconhecido)';
    const text = extractText(el);
    if (!text) return;
    const entry = { ts: Date.now(), username, text };
    history.push(entry);
    if (history.length > 5000) history.shift(); // limite pra não crescer sem fim
    window.dispatchEvent(new CustomEvent('ht-chat-message', { detail: entry }));
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches && node.matches(MESSAGE_SELECTOR)) captureNode(node);
        node.querySelectorAll &&
          node.querySelectorAll(MESSAGE_SELECTOR).forEach(captureNode);
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // filterUsers: array de nicks (vazio/undefined = todos). Comparação
  // exata (case-insensitive), pra bater com os chips clicáveis do painel.
  // searchText: substring livre, aplicada em cima do nome OU do texto.
  function matches(m, filterUsers, searchText) {
    if (filterUsers && filterUsers.length) {
      const set = filterUsers.map((u) => u.toLowerCase());
      if (!set.includes(m.username.toLowerCase())) return false;
    }
    if (searchText) {
      const q = searchText.toLowerCase();
      if (!m.username.toLowerCase().includes(q) && !m.text.toLowerCase().includes(q)) return false;
    }
    return true;
  }

  function getFiltered(filterUsers, searchText) {
    return history.filter((m) => matches(m, filterUsers, searchText));
  }

  function toText(filterUsers, searchText) {
    return getFiltered(filterUsers, searchText)
      .map((m) => `[${new Date(m.ts).toLocaleString('pt-BR')}] ${m.username}: ${m.text}`)
      .join('\n');
  }

  // O content script não tem acesso a chrome.downloads — só repassa o
  // texto já filtrado pro background.js, que é quem baixa de verdade.
  function download(filterUsers, searchText) {
    const text = toText(filterUsers, searchText) || '(nenhuma mensagem capturada ainda)';
    chrome.runtime.sendMessage(
      {
        action: 'downloadText',
        text,
        filename: 'habblet-historico-' + Date.now() + '.txt',
      },
      (resp) => {
        if (!resp || !resp.ok) {
          console.error('[HT] Falha ao baixar histórico:', resp && resp.error);
        } else {
          console.log('[HT] Download iniciado, id=' + resp.downloadId);
        }
      }
    );
  }

  window.__HT = window.__HT || {};
  window.__HT.chatHistory = {
    getAll: () => history.slice(),
    getFiltered,
    toText,
    download,
    getUsers: () => {
      const seen = new Set();
      const users = [];
      history.forEach((m) => {
        const key = m.username.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          users.push(m.username);
        }
      });
      return users.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    },
  };

  // Ponte com o popup: o popup pede o download, mas quem efetivamente
  // inicia é este arquivo, via chrome.downloads — evita o problema de
  // cliques programáticos bloqueados pela página.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.action === 'downloadHistory') {
      const filterUsers = msg.filterUser ? [msg.filterUser] : [];
      download(filterUsers, msg.searchText);
      sendResponse({ ok: true, count: getFiltered(filterUsers, msg.searchText).length });
    }
  });

  if (window.__HT.getSettings) {
    window.__HT.getSettings((s) => {
      enabled = !!s.chatHistory;
    });
    window.__HT.onSettingsChanged((changes) => {
      if (changes.chatHistory) enabled = !!changes.chatHistory.newValue;
    });
  }
})();
