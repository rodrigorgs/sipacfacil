(function () {
  "use strict";

  const ROOT_ID = "sipac-protocolo-rapido";
  const LAST_SEARCH_KEY = "sipacProtocoloRapido:lastSearch";
  const PENDING_AUTH_SEARCH_KEY = "sipacProtocoloRapido:pendingAuthSearch";
  const AUTO_OPEN_WINDOW_MS = 15000;
  const AUTH_SEARCH_URLS = {
    document: "/sipac/protocolo/consulta/consulta_documento.jsf",
    process: "/sipac/protocolo/consulta/consulta_processo.jsf"
  };

  const isSipacPage = location.hostname === "sipac.ufba.br";
  const isPortalPage =
    isSipacPage && (location.pathname === "/" || location.pathname === "/public/jsp/portal.jsf");
  const isAdminPortalPage =
    isSipacPage &&
    (location.pathname === "/sipac/portal_administrativo/index.jsf" ||
      location.pathname === "/sipac/menuUnidade.do");
  const isAuthenticatedSearchPage =
    isSipacPage && Object.values(AUTH_SEARCH_URLS).includes(location.pathname);

  if (!isSipacPage) {
    return;
  }

  injectWindowOpenRedirect();

  function onlyDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function injectWindowOpenRedirect() {
    if (document.documentElement.dataset.sipacPrWindowOpenRedirect === "true") {
      return;
    }

    document.documentElement.dataset.sipacPrWindowOpenRedirect = "true";

    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("page-bridge.js");
    (document.head || document.documentElement).appendChild(script);
    script.addEventListener("load", () => script.remove(), { once: true });
  }

  function getLastSearch() {
    try {
      const raw = sessionStorage.getItem(LAST_SEARCH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function setLastSearch(protocol, target) {
    try {
      sessionStorage.setItem(
        LAST_SEARCH_KEY,
        JSON.stringify({ protocol, target: target || "process", digits: onlyDigits(protocol), at: Date.now() })
      );
    } catch (_error) {
      // The extension still works without sessionStorage.
    }
  }

  function getPendingAuthSearch() {
    try {
      const raw = sessionStorage.getItem(PENDING_AUTH_SEARCH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function setPendingAuthSearch(parts, target) {
    try {
      sessionStorage.setItem(
        PENDING_AUTH_SEARCH_KEY,
        JSON.stringify({ parts, target, protocol: formatProtocol(parts), at: Date.now() })
      );
    } catch (_error) {
      // The user can still search manually if storage is unavailable.
    }
  }

  function clearPendingAuthSearch() {
    try {
      sessionStorage.removeItem(PENDING_AUTH_SEARCH_KEY);
    } catch (_error) {
      // Ignore storage failures.
    }
  }

  function clearLastSearch() {
    try {
      sessionStorage.removeItem(LAST_SEARCH_KEY);
    } catch (_error) {
      // Ignore storage failures.
    }
  }

  function parseProtocol(value) {
    const raw = String(value || "").trim();
    const formatted = raw.match(/(\d{5,7})\D+(\d{1,8})\D+(\d{4})\D+(\d{1,2})/);

    if (formatted) {
      return {
        radical: formatted[1],
        number: formatted[2],
        year: formatted[3],
        checkDigits: formatted[4].padStart(2, "0")
      };
    }

    const digits = onlyDigits(raw);

    if (digits.length < 12) {
      return null;
    }

    const checkDigits = digits.slice(-2);
    const year = digits.slice(-6, -2);
    const prefixAndNumber = digits.slice(0, -6);
    const radical = prefixAndNumber.startsWith("23066")
      ? "23066"
      : prefixAndNumber.slice(0, Math.max(5, prefixAndNumber.length - 8));
    const number = prefixAndNumber.slice(radical.length);

    if (
      radical.length < 5 ||
      radical.length > 7 ||
      number.length < 1 ||
      number.length > 8 ||
      !/^20\d{2}$|^19\d{2}$/.test(year)
    ) {
      return null;
    }

    return { radical, number, year, checkDigits };
  }

  function formatProtocol(parts) {
    return `${parts.radical}.${parts.number}/${parts.year}-${parts.checkDigits}`;
  }

  function setInputValue(input, value) {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setStatus(root, message, kind) {
    const status = root.querySelector("[data-sipac-status]");
    status.textContent = message;
    status.dataset.kind = kind || "info";
  }

  function getProcessForm() {
    return document.querySelector("form#processoForm");
  }

  function getDocumentForm() {
    return document.querySelector("form#documentosForm, form#docsForm");
  }

  function submitPublicSearch(parts, root) {
    const form = getProcessForm();

    if (!form) {
      setStatus(root, "Busca oficial de processos não encontrada nesta página.", "error");
      return;
    }

    const fields = {
      RADICAL_PROTOCOLO: parts.radical,
      NUM_PROTOCOLO: parts.number,
      ANO_PROTOCOLO: parts.year,
      DV_PROTOCOLO: parts.checkDigits
    };

    Object.entries(fields).forEach(([name, value]) => {
      const input = form.querySelector(`[name="${name}"]`);
      if (input) {
        setInputValue(input, value);
      }
    });

    const protocol = formatProtocol(parts);
    setLastSearch(protocol, "process");

    const protocolCheckbox = form.querySelector("#n_proc_p");
    if (protocolCheckbox) {
      protocolCheckbox.checked = true;
    }

    ["interessado_p", "identificador_p", "cadastro_p", "conarq_p"].forEach((id) => {
      const checkbox = form.querySelector(`#${id}`);
      if (checkbox) {
        checkbox.checked = false;
      }
    });

    setStatus(root, `Consultando ${protocol}...`, "loading");

    const submitButton = Array.from(form.querySelectorAll('input[type="submit"]')).find((button) =>
      /consultar processo/i.test(button.value || "")
    );

    if (submitButton) {
      submitButton.click();
      return;
    }

    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
    } else {
      form.submit();
    }
  }

  function submitPublicDocumentSearch(parts, root) {
    const form = getDocumentForm();

    if (!form) {
      setStatus(root, "Busca oficial de documentos não encontrada nesta página.", "error");
      return;
    }

    const fields = {
      RADICAL_PROTOCOLO: parts.radical,
      NUM_PROTOCOLO: parts.number,
      ANO_PROTOCOLO: parts.year,
      DV_PROTOCOLO: parts.checkDigits
    };

    Object.entries(fields).forEach(([name, value]) => {
      const input = form.querySelector(`[name="${name}"]`);
      if (input) {
        setInputValue(input, value);
      }
    });

    setCheckbox(form, '[name="tipo_consulta"]', true);
    [
      "tipo_consulta_interessado",
      "tipo_consulta_identificador",
      "tipo_consulta_cadastro",
      "tipo_consulta_documento",
      "tipo_consulta_conarq"
    ].forEach((name) => setCheckbox(form, `[name="${name}"]`, false));

    const protocol = formatProtocol(parts);
    setLastSearch(protocol, "document");
    setStatus(root, `Consultando documento ${protocol}...`, "loading");

    const submitButton = Array.from(form.querySelectorAll('input[type="submit"]')).find((button) =>
      /consultar documento/i.test(button.value || "")
    );

    if (submitButton) {
      submitButton.click();
      return;
    }

    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
    } else {
      form.submit();
    }
  }

  function setCheckbox(form, selector, checked) {
    const checkbox = form.querySelector(selector);
    if (checkbox) {
      checkbox.checked = checked;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function submitAuthenticatedSearch(parts, root, target) {
    const searchUrl = AUTH_SEARCH_URLS[target];
    const isDocument = target === "document";
    const form = isDocument ? getDocumentForm() : getProcessForm();
    const expectedField = isDocument ? '[name="docsForm:radical"]' : '[name="processoForm:radical"]';

    if (!form || !form.querySelector(expectedField)) {
      setPendingAuthSearch(parts, target);
      setStatus(root, "Abrindo consulta autenticada...", "loading");
      location.assign(searchUrl);
      return;
    }

    const prefix = isDocument ? "docsForm" : "processoForm";
    const fields = {
      [`${prefix}:radical`]: parts.radical,
      [`${prefix}:numProtocolo`]: parts.number,
      [`${prefix}:ano`]: parts.year,
      [`${prefix}:dv`]: parts.checkDigits
    };

    Object.entries(fields).forEach(([name, value]) => {
      const input = form.querySelector(`[name="${name}"]`);
      if (input) {
        setInputValue(input, value);
      }
    });

    setCheckbox(
      form,
      isDocument ? '[name="docsForm:buscaProtocolo"]' : '[name="processoForm:byIdentificadores"]',
      true
    );
    setLastSearch(formatProtocol(parts), target);
    clearPendingAuthSearch();
    setStatus(
      root,
      `Consultando ${isDocument ? "documento" : "processo"} ${formatProtocol(parts)} com sua sessão...`,
      "loading"
    );

    const submitButton =
      form.querySelector(isDocument ? "#docsForm\\:b_buscar" : "#processoForm\\:b_buscar_processo") ||
      Array.from(form.querySelectorAll('input[type="submit"]')).find((button) =>
        /buscar/i.test(button.value || "")
      );

    if (submitButton) {
      submitButton.click();
      return;
    }

    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
    } else {
      form.submit();
    }
  }

  function handleSearch(root, mode, target) {
    const input = root.querySelector(`[data-sipac-input="${target}"]`);
    const parts = parseProtocol(input.value);

    if (!parts) {
      setStatus(root, "Cole um protocolo no formato 23066.000000/2026-00.", "error");
      input.focus();
      return;
    }

    if (mode === "authenticated") {
      submitAuthenticatedSearch(parts, root, target);
      return;
    }

    if (target === "document") {
      submitPublicDocumentSearch(parts, root);
      return;
    }

    submitPublicSearch(parts, root);
  }

  function createWidget(mode) {
    const container = document.createElement("div");
    container.id = ROOT_ID;
    container.className = mode === "authenticated" ? "sipac-pr-admin" : "";
    container.innerHTML = [
      '<div class="sipac-pr-title">Consulta rápida de protocolo</div>',
      '<label class="sipac-pr-label" for="sipac-pr-process-input">Processo</label>',
      '<div class="sipac-pr-row" data-sipac-row="process">',
      '<input id="sipac-pr-process-input" data-sipac-input="process" type="text" inputmode="numeric" autocomplete="off" placeholder="23066.000000/2026-00" />',
      '<button type="button" data-sipac-submit="process">Buscar processo</button>',
      "</div>",
      '<label class="sipac-pr-label" for="sipac-pr-document-input">Documento</label>',
      '<div class="sipac-pr-row" data-sipac-row="document">',
      '<input id="sipac-pr-document-input" data-sipac-input="document" type="text" inputmode="numeric" autocomplete="off" placeholder="23066.000000/2026-00" />',
      '<button type="button" data-sipac-submit="document">Buscar documento</button>',
      "</div>",
      '<div class="sipac-pr-status" data-sipac-status data-kind="info">Cole o número do protocolo na busca de processo ou documento.</div>'
    ].join("");

    container.querySelectorAll("[data-sipac-submit]").forEach((button) => {
      button.addEventListener("click", () => {
        handleSearch(container, mode, button.dataset.sipacSubmit);
      });
    });

    container.querySelectorAll("[data-sipac-input]").forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          handleSearch(container, mode, input.dataset.sipacInput);
        }
      });

      input.addEventListener("paste", () => {
        window.setTimeout(() => handleSearch(container, mode, input.dataset.sipacInput), 50);
      });
    });

    return container;
  }

  function insertPublicWidget() {
    const editaisBox = document.querySelector("#p-comunicados div.editais");
    const editaisTitle = editaisBox && editaisBox.querySelector("h3");

    if (!editaisBox || !editaisTitle) {
      return false;
    }

    editaisTitle.insertAdjacentElement("afterend", createWidget("public"));
    return true;
  }

  function insertAdminWidget() {
    const content = document.querySelector("#conteudo");
    const title = content && content.querySelector("h2.title");
    const anchor =
      title ||
      document.querySelector("#operacoes_extrato") ||
      document.querySelector("#menu_principal") ||
      content;

    if (!anchor) {
      return false;
    }

    const widget = createWidget("authenticated");

    if (title) {
      title.insertAdjacentElement("afterend", widget);
    } else {
      anchor.insertAdjacentElement("afterbegin", widget);
    }

    return true;
  }

  function visibleText(element) {
    return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
  }

  function isActionableProcessLink(link) {
    const haystack = getLinkHaystack(link);

    if (/listaEditais|portal\.jsf/i.test(haystack)) {
      return false;
    }

    return /visuali[sz]ar|exibir|detalh|processo|documento|protocolo|lupa|jsfcljs|public/i.test(haystack);
  }

  function getLinkHaystack(link) {
    const imageText = Array.from(link.querySelectorAll("img"))
      .map(
        (image) =>
          `${image.getAttribute("alt") || ""} ${image.getAttribute("title") || ""} ${
            image.getAttribute("src") || ""
          }`
      )
      .join(" ");
    return `${visibleText(link)} ${imageText} ${link.getAttribute("title") || ""} ${
      link.getAttribute("href") || ""
    } ${link.getAttribute("onclick") || ""}`;
  }

  function getPopupUrl(link) {
    const onclick = link.getAttribute("onclick") || "";
    const match = onclick.match(/window\.open\s*\(\s*['"]([^'"]+)['"]/i);
    return match ? match[1] : null;
  }

  function openLinkInCurrentPage(link) {
    const popupUrl = getPopupUrl(link);

    if (popupUrl) {
      location.assign(new URL(popupUrl, location.href).href);
      return;
    }

    const href = link.getAttribute("href") || "";
    if (href && href !== "#" && !/^javascript:/i.test(href)) {
      location.assign(new URL(href, location.href).href);
      return;
    }

    try {
      sessionStorage.setItem("sipacProtocoloRapido:openInCurrentPageUntil", String(Date.now() + 5000));
    } catch (_error) {
      // Popup interception is best effort.
    }

    link.click();
  }

  function isDetailLink(link, target) {
    const haystack = getLinkHaystack(link);
    const targetPattern =
      target === "document" ? /documento|doc\b|docu/i : /processo|proc\b/i;

    if (/cancelar|imprimir|pdf|voltar|remover|excluir|alterar|enviar|receber/i.test(haystack)) {
      return false;
    }

    return (
      /lupa\.gif|visuali[sz]ar|exibir|detalh/i.test(haystack) &&
      (targetPattern.test(haystack) || !/processo|documento|proc\b|doc\b|docu/i.test(haystack))
    );
  }

  function findProcessLink(protocolDigits, target) {
    const rows = Array.from(
      document.querySelectorAll("#corpo tr, #corpo .listagem li, #corpo dl, #conteudo tr, #conteudo .listagem li, #conteudo dl")
    );
    const preferredPattern =
      target === "document"
        ? /lupa\.gif|visuali[sz]ar|exibir|detalh|documento/i
        : /lupa\.gif|visuali[sz]ar|exibir|detalh|processo/i;

    for (const row of rows) {
      if (!onlyDigits(visibleText(row)).includes(protocolDigits)) {
        continue;
      }

      const links = Array.from(row.querySelectorAll("a")).filter(isActionableProcessLink);
      const detailLinks = links.filter((link) => isDetailLink(link, target));
      const preferred = detailLinks.find((link) => preferredPattern.test(getLinkHaystack(link)));
      if (preferred) {
        return preferred;
      }

      if (detailLinks.length === 1) {
        return detailLinks[0];
      }

      if (links.length === 1) {
        return links[0];
      }
    }

    const detailLinks = Array.from(document.querySelectorAll("#corpo a, #conteudo a")).filter((link) =>
      isDetailLink(link, target)
    );

    if (detailLinks.length === 1) {
      return detailLinks[0];
    }

    const linksWithProtocol = Array.from(document.querySelectorAll("#corpo a, #conteudo a")).filter(
      (link) => {
        const haystack = getLinkHaystack(link);
        return onlyDigits(haystack).includes(protocolDigits) && isActionableProcessLink(link);
      }
    );

    return linksWithProtocol.length === 1 ? linksWithProtocol[0] : null;
  }

  function tryAutoOpenResult() {
    const lastSearch = getLastSearch();

    if (!lastSearch || Date.now() - lastSearch.at > AUTO_OPEN_WINDOW_MS) {
      clearLastSearch();
      return true;
    }

    const pageText = visibleText(document.body);
    const protocolWasRendered = onlyDigits(pageText).includes(lastSearch.digits);
    const link = protocolWasRendered ? findProcessLink(lastSearch.digits, lastSearch.target) : null;

    if (!link) {
      if (/nenhum|não encontrado|nao encontrado/i.test(pageText)) {
        clearLastSearch();
        return true;
      }

      return false;
    }

    clearLastSearch();
    openLinkInCurrentPage(link);
    return true;
  }

  function scheduleAutoOpen() {
    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      if (tryAutoOpenResult() || attempts >= 20) {
        window.clearInterval(interval);
      }
    }, 500);
  }

  function runPendingAuthenticatedSearch() {
    const pending = getPendingAuthSearch();

    if (!pending || Date.now() - pending.at > AUTO_OPEN_WINDOW_MS) {
      clearPendingAuthSearch();
      return;
    }

    const hiddenRoot = document.createElement("div");
    hiddenRoot.innerHTML = '<span data-sipac-status></span>';
    submitAuthenticatedSearch(pending.parts, hiddenRoot, pending.target || "process");
  }

  if (isPortalPage && !document.getElementById(ROOT_ID) && !insertPublicWidget()) {
    const observer = new MutationObserver(() => {
      if (document.getElementById(ROOT_ID)) {
        observer.disconnect();
        return;
      }

      if (insertPublicWidget()) {
        observer.disconnect();
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (isAdminPortalPage && !document.getElementById(ROOT_ID) && !insertAdminWidget()) {
    const observer = new MutationObserver(() => {
      if (document.getElementById(ROOT_ID)) {
        observer.disconnect();
        return;
      }

      if (insertAdminWidget()) {
        observer.disconnect();
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (isAuthenticatedSearchPage) {
    runPendingAuthenticatedSearch();
  }

  scheduleAutoOpen();
})();
