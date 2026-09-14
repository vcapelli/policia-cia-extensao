// content/forum-bridge.js
// ISOLATED world / document_end / apenas em ciahbt.forumeiros.com
//
// Recebe o nick publicado pelo forum-bridge-main.js (mundo MAIN) e
// grava em chrome.storage.local — o único jeito de levar essa
// informação pra fora desta aba/domínio, já que chrome.storage não
// existe no mundo MAIN. O ponto.js, rodando no habblet.city, lê essa
// mesma chave do storage (extensão compartilha storage entre domínios).
(function () {
  'use strict';

  if (window.__HTForumBridgeIsolatedInstalled) return;
  window.__HTForumBridgeIsolatedInstalled = true;

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.source !== 'ht-forum-bridge' || data.type !== 'session') return;
    if (!data.nick) return;

    chrome.storage.local.set({
      htForumNick: data.nick,
      htForumNickAt: Date.now(),
    });
  });
})();
