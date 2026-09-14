// content/forum-bridge-main.js
// MAIN world / document_end / apenas em ciahbt.forumeiros.com
//
// A página do fórum (forumeiros/AwesomeBB) expõe um objeto global
// `_userdata` com o nick de quem está logado (`_userdata["username"]`).
// Isso só existe no mundo MAIN (JS da própria página) — um content
// script ISOLATED não enxerga essa variável, mesmo compartilhando o
// DOM. Por isso esse arquivo só lê e repassa via postMessage; quem
// grava no chrome.storage é o companheiro ISOLATED (forum-bridge.js).
(function () {
  'use strict';

  if (window.__HTForumBridgeInstalled) return;
  window.__HTForumBridgeInstalled = true;

  function lerNick() {
    try {
      const ud = window._userdata;
      if (!ud) return null;
      const nick = ud['username'];
      if (!nick || String(nick).toLowerCase() === 'anonymous') return null;
      return String(nick);
    } catch (_) {
      return null;
    }
  }

  function publicar() {
    const nick = lerNick();
    if (!nick) return;
    try {
      window.postMessage({ source: 'ht-forum-bridge', type: 'session', nick }, '*');
    } catch (_) {}
  }

  publicar();

  // _userdata já vem embutido de forma síncrona no HTML, mas por
  // garantia tenta mais algumas vezes logo no início (caso algum
  // script assíncrono da página redefina depois).
  let tentativas = 0;
  const timer = setInterval(() => {
    tentativas += 1;
    publicar();
    if (tentativas >= 10) clearInterval(timer);
  }, 500);
})();
