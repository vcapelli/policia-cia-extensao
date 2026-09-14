// content/settings-bridge.js
// ISOLATED world / document_start / all_frames=true
//
// V10: ponte enxuta entre as configuracoes da extensao e o MAIN world.
(function () {
  'use strict';

  if (window.__HTSettingsBridgeInstalledV10) return;
  window.__HTSettingsBridgeInstalledV10 = true;

  const IS_TOP = window === window.top;
  const SETTINGS_CACHE_KEY = 'ht-main-settings-cache-v3';
  const SETTINGS_DOM_ATTR = 'data-ht-settings';

  let latest = null;
  let attached = false;

  function bool(value, fallback) {
    if (value === true || value === false) return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    return fallback;
  }

  function normalize(source) {
    const value =
      source && typeof source === 'object'
        ? source
        : {};

    return {
      hideTyping: bool(
        value.hideTyping ??
          value.hideMyTypingBalloon ??
          value.hideTypingBalloon,
        false
      ),
      antiAfk: bool(
        value.antiAfk ??
          value.antiAFK ??
          value.antiAusEnabled,
        false
      )
    };
  }

  function postToChildren(message) {
    try {
      for (let i = 0; i < window.frames.length; i++) {
        try {
          window.frames[i].postMessage(message, '*');
        } catch (_) {}
      }
    } catch (_) {}
  }

  function broadcast(
    source,
    relayChildren = true
  ) {
    const normalized = normalize(source);
    latest = normalized;

    const serialized =
      JSON.stringify(normalized);

    try {
      localStorage.setItem(
        SETTINGS_CACHE_KEY,
        serialized
      );
    } catch (_) {}

    try {
      if (document.documentElement) {
        document.documentElement.setAttribute(
          SETTINGS_DOM_ATTR,
          serialized
        );
      }
    } catch (_) {}

    try {
      window.dispatchEvent(
        new CustomEvent(
          'ht-settings-update',
          { detail: serialized }
        )
      );
    } catch (_) {}

    try {
      window.postMessage(
        {
          source: 'ht-settings-bridge',
          type: 'settings',
          settings: normalized
        },
        '*'
      );
    } catch (_) {}

    if (relayChildren) {
      postToChildren({
        source: 'ht-settings-parent-v10',
        type: 'settings',
        settings: normalized
      });
    }
  }

  window.addEventListener(
    'message',
    (event) => {
      const data = event.data;
      if (!data) return;

      if (
        data.source === 'ht-settings-parent-v10' &&
        data.type === 'settings'
      ) {
        broadcast(
          data.settings,
          true
        );
        return;
      }

      if (
        data.source === 'ht-protocol' &&
        data.type === 'ready' &&
        latest
      ) {
        broadcast(
          latest,
          true
        );
      }
    }
  );

  if (!IS_TOP) {
    try {
      const cached =
        localStorage.getItem(
          SETTINGS_CACHE_KEY
        );

      if (cached) {
        broadcast(
          JSON.parse(cached),
          false
        );
      }
    } catch (_) {}

    try {
      window.parent.postMessage(
        {
          source: 'ht-settings-child-v10',
          type: 'request-settings'
        },
        '*'
      );
    } catch (_) {}

    return;
  }

  window.addEventListener(
    'message',
    (event) => {
      const data = event.data;

      if (
        data &&
        data.source === 'ht-settings-child-v10' &&
        data.type === 'request-settings' &&
        latest
      ) {
        try {
          event.source.postMessage(
            {
              source: 'ht-settings-parent-v10',
              type: 'settings',
              settings: latest
            },
            '*'
          );
        } catch (_) {}
      }
    }
  );

  function attach() {
    if (attached) return true;

    const api = window.__HT;

    if (
      !api ||
      typeof api.getSettings !== 'function'
    ) {
      return false;
    }

    attached = true;

    api.getSettings((settings) => {
      broadcast(settings, true);
    });

    if (
      typeof api.onSettingsChanged ===
      'function'
    ) {
      api.onSettingsChanged(() => {
        api.getSettings((settings) => {
          broadcast(settings, true);
        });
      });
    }

    return true;
  }

  if (!attach()) {
    let attempts = 0;

    const timer = setInterval(() => {
      attempts += 1;

      if (
        attach() ||
        attempts >= 1200
      ) {
        clearInterval(timer);
      }
    }, 50);
  }
})();
