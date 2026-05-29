(function () {
  "use strict";

  if (window.__sipacProtocoloRapidoWindowOpenRedirect) {
    return;
  }

  window.__sipacProtocoloRapidoWindowOpenRedirect = true;

  const originalWindowOpen = window.open;

  window.open = function (url) {
    const activeUntil = Number(
      sessionStorage.getItem("sipacProtocoloRapido:openInCurrentPageUntil") || 0
    );

    if (url && activeUntil > Date.now()) {
      sessionStorage.removeItem("sipacProtocoloRapido:openInCurrentPageUntil");
      window.location.assign(new URL(url, window.location.href).href);
      return window;
    }

    return originalWindowOpen.apply(window, arguments);
  };
})();
