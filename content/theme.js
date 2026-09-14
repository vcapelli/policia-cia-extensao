// content/theme.js
// ISOLATED world / document_end
//
// Design system compartilhado por todo o resto da extensão (overlay de
// FPS, painel flutuante com as abas Ponto/Histórico/Chat). Visual
// baseado no formulário "Controle de Ponto" da CIA: cards claros,
// cantos bem arredondados, Plus Jakarta Sans, paleta cinza + azul/
// esmeralda/rosa pros estados.
//
// IMPORTANTE: as variáveis abaixo (cores, raios) são espelhadas em
// popup/popup.css, porque o popup roda num documento separado e não
// consegue herdar este <style> injetado na página do jogo. Se mudar
// uma paleta aqui, replique lá também.
(function () {
  const STYLE_ID = 'ht-theme-style';
  const FONT_LINK_ID = 'ht-theme-font';

  if (document.getElementById(STYLE_ID)) return;

  // Fonte via Google Fonts — best effort. Se o CSP da página bloquear,
  // cai só no fallback do font-stack (Segoe UI/Arial) sem quebrar nada.
  try {
    if (!document.getElementById(FONT_LINK_ID)) {
      const link = document.createElement('link');
      link.id = FONT_LINK_ID;
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap';
      (document.head || document.documentElement).appendChild(link);
    }
  } catch (_) {
    /* segue com o fallback de fontes do sistema */
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      --ht-bg: #f3f4f6;
      --ht-card: #ffffff;
      --ht-border: #e5e7eb;
      --ht-text: #1f2937;
      --ht-muted: #9ca3af;
      --ht-muted-2: #d1d5db;
      --ht-accent: #3b82f6;
      --ht-accent-dark: #2563eb;
      --ht-success: #10b981;
      --ht-success-bg: #d1fae5;
      --ht-success-text: #047857;
      --ht-danger: #f43f5e;
      --ht-danger-bg: #ffe4e6;
      --ht-danger-text: #be123c;
      --ht-radius-lg: 20px;
      --ht-radius-md: 14px;
      --ht-radius-sm: 10px;
      --ht-font: 'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif;
      --ht-shadow: 0 10px 30px rgba(15, 23, 42, 0.14);
    }

    #ht-overlay,
    #ht-panel,
    #ht-launcher {
      font-family: var(--ht-font);
      box-sizing: border-box;
    }
    #ht-overlay *,
    #ht-panel *,
    #ht-launcher * {
      box-sizing: border-box;
      font-family: inherit;
    }

    /* ---------- overlay de FPS ---------- */
    #ht-overlay {
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 2147483647;
      background: var(--ht-card);
      color: var(--ht-text);
      font-size: 12px;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid var(--ht-border);
      box-shadow: var(--ht-shadow);
      display: flex;
      align-items: center;
      gap: 6px;
      pointer-events: none;
      user-select: none;
    }
    #ht-overlay .ht-fps-dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: var(--ht-success);
      flex-shrink: 0;
    }
    #ht-overlay .ht-fps-dot.warn { background: #f59e0b; }
    #ht-overlay .ht-fps-dot.bad { background: var(--ht-danger); }

    /* ---------- launcher (canto inferior esquerdo) ---------- */
    #ht-launcher {
      position: fixed;
      bottom: 66px;
      left: 6px;
      z-index: 2147483000;
      width: 46px;
      height: 46px;
      border-radius: 999px;
      background: var(--ht-card);
      border: 1px solid var(--ht-border);
      box-shadow: var(--ht-shadow);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      overflow: hidden;
      user-select: none;
      transition: transform 0.15s ease, filter 0.15s ease;
    }
    #ht-launcher:hover { transform: translateY(-1px); filter: brightness(1.03); }
    #ht-launcher img { width: 100%; height: 100%; object-fit: cover; display: block; }
    #ht-launcher .ht-launcher-fallback { font-size: 18px; }

    /* ---------- painel principal ---------- */
    #ht-panel {
      position: fixed;
      bottom: 120px;
      left: 6px;
      z-index: 2147483000;
      width: 340px;
      max-width: calc(100vw - 32px);
      max-height: 70vh;
      display: none;
      flex-direction: column;
      background: var(--ht-bg);
      border: 1px solid var(--ht-border);
      border-radius: var(--ht-radius-lg);
      color: var(--ht-text);
      font-size: 13px;
      line-height: 1.45;
      box-shadow: var(--ht-shadow);
      overflow: hidden;
    }
    #ht-panel.open { display: flex; }

    .ht-panel-header {
      padding: 14px 16px 10px;
      background: var(--ht-card);
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--ht-border);
    }
    .ht-panel-title { font-weight: 800; font-size: 14px; }
    .ht-panel-close {
      cursor: pointer;
      color: var(--ht-muted);
      font-weight: 900;
      padding: 2px 6px;
      border-radius: 6px;
    }
    .ht-panel-close:hover { background: var(--ht-bg); color: var(--ht-text); }

    .ht-tabbar {
      display: flex;
      gap: 4px;
      padding: 8px 10px;
      background: var(--ht-card);
      border-bottom: 1px solid var(--ht-border);
    }
    .ht-tab {
      flex: 1;
      text-align: center;
      padding: 7px 6px;
      border-radius: var(--ht-radius-sm);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--ht-muted);
      cursor: pointer;
      background: transparent;
    }
    .ht-tab:hover { color: var(--ht-text); }
    .ht-tab.active { background: var(--ht-accent); color: #fff; }

    .ht-body {
      padding: 14px 16px 16px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .ht-card-section {
      background: var(--ht-card);
      border: 1px solid var(--ht-border);
      border-radius: var(--ht-radius-md);
      padding: 12px 14px;
    }

    .ht-category-title {
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--ht-muted-2);
      margin: 0 0 8px;
    }

    .ht-label {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--ht-muted);
      display: block;
      margin-bottom: 3px;
    }

    .ht-input {
      width: 100%;
      padding: 7px 0;
      border: none;
      border-bottom: 2px solid var(--ht-border);
      background: transparent;
      outline: none;
      font-weight: 600;
      font-size: 12.5px;
      color: var(--ht-text);
    }
    .ht-input:focus { border-bottom-color: var(--ht-accent); }

    .ht-input-block { margin-bottom: 4px; }
    .ht-hint { font-size: 10px; color: var(--ht-muted); margin: 4px 0 0; }

    .ht-avatar {
      width: 40px;
      height: 40px;
      border-radius: 999px;
      overflow: hidden;
      background: #e5e7eb;
      flex-shrink: 0;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ht-avatar img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center top;
      display: none;
      transform: scale(2);
      transform-origin: center 25%;
      top: -16px;
    }
    .ht-avatar img.pronto { display: block; }
    .ht-avatar .ht-avatar-inicial {
      color: #6b7280;
      font-weight: 800;
      font-size: 13px;
      position: relative;
      z-index: 0;
    }
    .ht-avatar img.pronto ~ .ht-avatar-inicial { display: none; }

    .ht-row { display: flex; align-items: center; gap: 10px; }
    .ht-greeting { font-weight: 800; font-size: 13.5px; line-height: 1.2; }
    .ht-subtle { font-size: 10px; font-weight: 700; color: var(--ht-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 2px; }

    .ht-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 12px;
      border-radius: var(--ht-radius-sm);
      border: none;
      font-weight: 800;
      font-size: 12.5px;
      cursor: pointer;
      color: #fff;
      transition: filter 0.15s ease, transform 0.15s ease;
    }
    .ht-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
    .ht-btn:active { transform: translateY(0); filter: brightness(0.95); }
    .ht-btn:disabled { opacity: 0.5; pointer-events: none; }
    .ht-btn-success { background: var(--ht-success); }
    .ht-btn-danger { background: var(--ht-danger); }
    .ht-btn-neutral { background: var(--ht-accent); }

    .ht-feedback { font-size: 11px; font-weight: 700; color: var(--ht-muted); min-height: 14px; margin: 8px 0 0; }
    .ht-feedback.ok { color: var(--ht-success-text); }
    .ht-feedback.error { color: var(--ht-danger-text); }

    .ht-ponto-counter {
      font-size: 24px;
      font-weight: 800;
      text-align: center;
      letter-spacing: 0.04em;
      color: var(--ht-accent-dark);
      font-variant-numeric: tabular-nums;
      margin: 2px 0 0;
    }

    .ht-roster-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 4px;
      cursor: pointer;
      border-radius: var(--ht-radius-sm);
    }
    .ht-roster-row:hover { background: var(--ht-bg); }
    .ht-roster-name { font-weight: 700; font-size: 12px; }

    .ht-status-badge {
      font-size: 10px;
      font-weight: 800;
      padding: 3px 9px;
      border-radius: 999px;
      background: #f3f4f6;
      color: #6b7280;
      white-space: nowrap;
    }
    .ht-status-badge.iniciado { background: var(--ht-success-bg); color: var(--ht-success-text); }
    .ht-status-badge.finalizado { background: var(--ht-danger-bg); color: var(--ht-danger-text); }

    .ht-hist-panel {
      padding: 6px 4px 10px 4px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .ht-hist-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
      font-size: 11px;
      padding: 4px 2px;
      border-top: 1px solid var(--ht-border);
    }
    .ht-hist-row:first-child { border-top: none; }

    .ht-empty { color: var(--ht-muted); text-align: center; padding: 18px 0; font-size: 11.5px; font-weight: 600; }
    .ht-spinner-row { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 16px 0; color: var(--ht-muted); font-size: 11.5px; font-weight: 700; }
    .ht-spin {
      width: 13px;
      height: 13px;
      border-radius: 999px;
      border: 2px solid var(--ht-border);
      border-top-color: var(--ht-accent);
      animation: ht-spin 0.7s linear infinite;
    }
    @keyframes ht-spin { to { transform: rotate(360deg); } }

    .ht-suggest-wrap { position: relative; }
    .ht-suggest-dropdown {
      position: absolute; z-index: 5; top: 100%; left: 0; width: 100%; margin-top: 4px;
      background: var(--ht-card); border: 1px solid var(--ht-border); border-radius: var(--ht-radius-sm);
      max-height: 150px; overflow-y: auto; display: none;
      box-shadow: var(--ht-shadow);
    }
    .ht-suggest-item {
      padding: 8px 12px; font-size: 11.5px; cursor: pointer;
      display: flex; justify-content: space-between; gap: 8px;
      border-bottom: 1px solid var(--ht-bg);
    }
    .ht-suggest-item:last-child { border-bottom: none; }
    .ht-suggest-item:hover { background: #eff6ff; }
    .ht-suggest-item .ht-suggest-patente { color: var(--ht-muted); font-size: 10px; }

    .ht-pill-row { display: flex; flex-wrap: wrap; gap: 5px; max-height: 60px; overflow-y: auto; }
    .ht-pill {
      padding: 3px 9px;
      border-radius: 999px;
      background: var(--ht-bg);
      border: 1px solid var(--ht-border);
      cursor: pointer;
      white-space: nowrap;
      font-size: 10.5px;
      font-weight: 700;
      color: var(--ht-text);
    }
    .ht-pill.active { background: var(--ht-accent); color: #fff; border-color: transparent; }

    .ht-msg-list {
      max-height: 220px;
      overflow-y: auto;
      background: var(--ht-bg);
      border-radius: var(--ht-radius-sm);
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .ht-msg { line-height: 1.35; word-break: break-word; font-size: 11.5px; }
    .ht-msg .ht-msg-time { color: var(--ht-muted); margin-right: 4px; }
    .ht-msg .ht-msg-name { color: var(--ht-accent-dark); font-weight: 700; }

    .ht-chat-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .ht-chat-stats { color: var(--ht-muted); font-size: 10.5px; font-weight: 700; }

    #ht-panel ::-webkit-scrollbar { width: 4px; }
    #ht-panel ::-webkit-scrollbar-track { background: transparent; }
    #ht-panel ::-webkit-scrollbar-thumb { background: var(--ht-muted-2); border-radius: 10px; }
  `;
  (document.head || document.documentElement).appendChild(style);
})();
