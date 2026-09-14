// Esconde elementos de anúncio via CSS + MutationObserver.
//
// Seletores confirmados a partir do content.js da Bananablet (mesma
// lógica que eles usam contra o habblet.city de verdade):
const AD_SELECTORS = [
  '.adTimer',
  '.adsbygoogle',
  '[id^="closeAd"]',
  '[id*="btnCloseAd"]',
];

// Heurística extra: banners de "seu navegador está bloqueando anúncios"
// geralmente não têm classe fixa, mas seguem um padrão de estilo — fixo
// no rodapé, com z-index absurdo e um texto característico.
function isAdBlockBanner(el) {
  if (!el || el.style.position !== 'fixed') return false;
  if (el.style.bottom !== '0px') return false;
  if (parseInt(el.style.zIndex, 10) <= 2147483000) return false;
  return (el.textContent || '').includes('ad or script blocking');
}

(function () {
  let enabled = true;

  function hideAds() {
    if (!enabled) return;
    AD_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        el.remove();
      });
    });
    // Varre containers fixos no rodapé procurando o banner de anti-adblock.
    document.querySelectorAll('div[style*="position: fixed"], div[style*="position:fixed"]').forEach((el) => {
      if (isAdBlockBanner(el)) el.remove();
    });
  }

  const observer = new MutationObserver(hideAds);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  hideAds();

  if (window.__HT && window.__HT.getSettings) {
    window.__HT.getSettings((s) => {
      enabled = !!s.removeAds;
      hideAds();
    });
    window.__HT.onSettingsChanged((changes) => {
      if (changes.removeAds) {
        enabled = !!changes.removeAds.newValue;
        hideAds();
      }
    });
  }
})();
