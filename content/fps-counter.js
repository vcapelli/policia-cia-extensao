// Mede o FPS de renderização da página contando frames por segundo via
// requestAnimationFrame. Não depende de nenhum detalhe interno do motor
// gráfico do jogo — é uma técnica genérica que funciona em qualquer canvas.
(function () {
  let frames = 0;
  let lastTime = performance.now();
  let enabled = true;

  function loop(now) {
    frames++;
    if (now - lastTime >= 1000) {
      const fps = Math.round((frames * 1000) / (now - lastTime));
      if (enabled && window.__HT && window.__HT.overlay) {
        window.__HT.overlay.setFps(fps);
      }
      frames = 0;
      lastTime = now;
    }
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  if (window.__HT && window.__HT.getSettings) {
    window.__HT.getSettings((s) => {
      enabled = !!s.showFps;
      window.__HT.overlay && window.__HT.overlay.setVisible(enabled);
    });
    window.__HT.onSettingsChanged((changes) => {
      if (changes.showFps) {
        enabled = !!changes.showFps.newValue;
        window.__HT.overlay && window.__HT.overlay.setVisible(enabled);
      }
    });
  }
})();
