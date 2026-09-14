// chrome.downloads só é acessível em contextos de extensão (popup,
// background) — não em content scripts, mesmo com a permissão
// declarada no manifest. Por isso esse arquivo existe: os content
// scripts mandam o texto pra cá, e este service worker é quem
// efetivamente chama chrome.downloads.download().
//
// A partir da v0.3.0 este arquivo também funciona como um "relay" de
// fetch genérico (ação 'fetchJSON'). Motivo: o sistema de Ponto precisa
// chamar domínios de fora do habblet.city (Apps Script, opensheet.elk.sh,
// api.habblet.city) a partir de um content script rodando DENTRO da
// página do jogo — e o CSP da própria página pode bloquear esses
// fetches cross-origin. Um service worker de extensão roda com origem
// própria e não sofre essa restrição, então centralizamos essas
// chamadas aqui (mesma ideia que já usávamos pro download).
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === 'downloadText') {
    const dataUrl = 'data:text/plain;charset=utf-8,' + encodeURIComponent(msg.text || '');
    chrome.downloads.download(
      {
        url: dataUrl,
        filename: msg.filename || 'habblet-historico-' + Date.now() + '.txt',
        saveAs: false,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ ok: true, downloadId });
        }
      }
    );
    return true; // mantém sendResponse assíncrono vivo
  }

  if (msg && msg.action === 'fetchJSON') {
    const { url, options } = msg;
    fetch(url, options || {})
      .then(async (res) => {
        let data = null;
        try {
          data = await res.json();
        } catch (_) {
          // Resposta não era JSON (ou veio vazia) — segue sem "data".
          data = null;
        }
        sendResponse({ ok: res.ok, status: res.status, data });
      })
      .catch((err) => {
        sendResponse({ ok: false, error: String((err && err.message) || err) });
      });
    return true; // assíncrono
  }
});
