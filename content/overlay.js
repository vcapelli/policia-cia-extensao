// Cria um painel fixo no canto da tela, usado pelo contador de FPS
// (e, no futuro, pelo indicador de ping). Visual definido em theme.js.
(function () {
  function createOverlay() {
    if (document.getElementById('ht-overlay')) return;

    const box = document.createElement('div');
    box.id = 'ht-overlay';
    box.innerHTML =
      '<span class="ht-fps-dot" id="ht-fps-dot"></span>' +
      '<span id="ht-fps">FPS: --</span>';
    (document.body || document.documentElement).appendChild(box);
  }

  function ready(fn) {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  ready(createOverlay);

  window.__HT = window.__HT || {};
  window.__HT.overlay = {
    setFps(value) {
      const el = document.getElementById('ht-fps');
      const dot = document.getElementById('ht-fps-dot');
      if (el) el.textContent = 'FPS: ' + value;
      if (dot) {
        dot.classList.remove('warn', 'bad');
        if (value < 30) dot.classList.add('bad');
        else if (value < 50) dot.classList.add('warn');
      }
    },
    setVisible(visible) {
      const el = document.getElementById('ht-overlay');
      if (el) el.style.display = visible ? '' : 'none';
    },
  };
})();
