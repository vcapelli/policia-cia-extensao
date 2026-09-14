// Namespace compartilhado entre os scripts desta extensão (mundo ISOLATED).
// Guarda as configurações padrão e helpers pra ler/observar o chrome.storage.
(function () {
  const DEFAULTS = {
    removeAds: true,
    hideTyping: true,
    showFps: true,
    chatHistory: true,
    ponto: true,
  };

  window.__HT = window.__HT || {};

  window.__HT.DEFAULTS = DEFAULTS;

  window.__HT.log = function (...args) {
    console.log('%c[HT]', 'color:#3b82f6;font-weight:bold', ...args);
  };

  window.__HT.getSettings = function (callback) {
    chrome.storage.local.get(Object.assign({}, DEFAULTS, { htForumNick: null }), (data) => {
      const settings = {};
      Object.keys(DEFAULTS).forEach((key) => {
        settings[key] = data[key];
      });

      // "Esconder balão de digitando" só fica disponível pra quem tem
      // uma sessão reconhecida no fórum da CIA (_userdata["username"]
      // detectado pelo forum-bridge.js em ciahbt.forumeiros.com — só
      // existe quando "session_logged_in" é 1 e o usuário não é
      // anônimo). Gate centralizado aqui: vale tanto pro toggle do
      // popup quanto pro hook de verdade em protocol-stubs.js (via
      // settings-bridge.js, que consome este mesmo getSettings).
      settings.hideTypingDisponivel = !!data.htForumNick;
      settings.hideTyping = !!settings.hideTyping && settings.hideTypingDisponivel;

      callback(settings);
    });
  };

  // callback recebe o objeto "changes" do chrome.storage.onChanged
  window.__HT.onSettingsChanged = function (callback) {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'local') callback(changes);
    });
  };
})();
