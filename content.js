(function () {
  "use strict";

  const ROOT_ID = "sipac-protocolo-rapido";
  const LAST_SEARCH_KEY = "sipacProtocoloRapido:lastSearch";
  const PENDING_AUTH_SEARCH_KEY = "sipacProtocoloRapido:pendingAuthSearch";
  const DOCUMENT_ID_CACHE_KEY = "sipacProtocoloRapido:documentIdCache";
  const PUBLIC_PROCESS_ID_CACHE_KEY = "sipacProtocoloRapido:publicProcessIdCache";
  const CONSULTATION_HISTORY_KEY = "sipacProtocoloRapido:consultationHistory";
  const HISTORY_LIMIT = 10;
  const AUTO_OPEN_WINDOW_MS = 15000;
  const ADMIN_PORTAL_URL = "/sipac/portal_administrativo/index.jsf";
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
  const isDocumentInfoPage =
    isSipacPage && location.pathname === "/sipac/protocolo/consulta/info_documento.jsf";
  const isPublicProcessDetailPage =
    isSipacPage && location.pathname === "/public/jsp/processos/processo_detalhado.jsf";

  if (!isSipacPage) {
    return;
  }

  function onlyDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function getLastSearch() {
    try {
      const raw = sessionStorage.getItem(LAST_SEARCH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function setLastSearch(protocol, target, options) {
    try {
      sessionStorage.setItem(
        LAST_SEARCH_KEY,
        JSON.stringify({
          protocol,
          target: target || "process",
          directOpen: Boolean(options && options.directOpen),
          digits: onlyDigits(protocol),
          at: Date.now()
        })
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

  function setPendingAuthSearch(parts, target, options) {
    try {
      sessionStorage.setItem(
        PENDING_AUTH_SEARCH_KEY,
        JSON.stringify({
          parts,
          target,
          directOpen: Boolean(options && options.directOpen),
          protocol: formatProtocol(parts),
          at: Date.now()
        })
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

  function getDocumentIdCache() {
    try {
      const raw = localStorage.getItem(DOCUMENT_ID_CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_error) {
      return {};
    }
  }

  function getCachedDocumentId(protocol) {
    const digits = onlyDigits(protocol);
    if (!digits) {
      return null;
    }

    const cached = getDocumentIdCache()[digits];
    return cached && cached.idDoc ? String(cached.idDoc) : null;
  }

  function setCachedDocumentId(protocol, idDoc, options) {
    const digits = onlyDigits(protocol);
    if (!digits || !idDoc) {
      return;
    }

    try {
      const cache = getDocumentIdCache();
      const previous = cache[digits] || {};
      cache[digits] = {
        idDoc: String(idDoc),
        detailedSubject:
          options && options.detailedSubject
            ? String(options.detailedSubject)
            : previous.detailedSubject || "",
        at: Date.now()
      };
      localStorage.setItem(DOCUMENT_ID_CACHE_KEY, JSON.stringify(cache));
    } catch (_error) {
      // Cache is only an optimization; direct search still works without it.
    }
  }

  function getDocumentInfoUrlById(idDoc) {
    return `/sipac/protocolo/consulta/info_documento.jsf?idDoc=${encodeURIComponent(idDoc)}`;
  }

  function getCachedDocumentDetailedSubject(protocol) {
    const cached = getDocumentIdCache()[onlyDigits(protocol)];
    return cached && cached.detailedSubject ? String(cached.detailedSubject) : "";
  }

  function getPublicProcessIdCache() {
    try {
      const raw = localStorage.getItem(PUBLIC_PROCESS_ID_CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_error) {
      return {};
    }
  }

  function getCachedPublicProcessId(protocol) {
    const digits = onlyDigits(protocol);
    if (!digits) {
      return null;
    }

    const cached = getPublicProcessIdCache()[digits];
    return cached && cached.idProcesso ? String(cached.idProcesso) : null;
  }

  function setCachedPublicProcessId(protocol, idProcesso, options) {
    const digits = onlyDigits(protocol);
    if (!digits || !idProcesso) {
      return;
    }

    try {
      const cache = getPublicProcessIdCache();
      const previous = cache[digits] || {};
      cache[digits] = {
        idProcesso: String(idProcesso),
        detailedSubject:
          options && options.detailedSubject
            ? String(options.detailedSubject)
            : previous.detailedSubject || "",
        at: Date.now()
      };
      localStorage.setItem(PUBLIC_PROCESS_ID_CACHE_KEY, JSON.stringify(cache));
    } catch (_error) {
      // Cache is only an optimization; direct search still works without it.
    }
  }

  function getPublicProcessDetailUrlById(idProcesso) {
    return `/public/jsp/processos/processo_detalhado.jsf?id=${encodeURIComponent(idProcesso)}`;
  }

  function getCachedPublicProcessDetailedSubject(protocol) {
    const cached = getPublicProcessIdCache()[onlyDigits(protocol)];
    return cached && cached.detailedSubject ? String(cached.detailedSubject) : "";
  }

  function getConsultationHistory() {
    try {
      const raw = localStorage.getItem(CONSULTATION_HISTORY_KEY);
      const history = raw ? JSON.parse(raw) : {};

      return {
        document: Array.isArray(history.document) ? history.document : [],
        process: Array.isArray(history.process) ? history.process : []
      };
    } catch (_error) {
      return { document: [], process: [] };
    }
  }

  function getProtocolFromText(value) {
    const match = String(value || "").match(/\d{5,7}\.\d{1,8}\/\d{4}-\d{2}/);
    return match ? match[0] : String(value || "").trim();
  }

  function recordConsultation(target, protocol, detailedSubject, options) {
    const normalizedProtocol = getProtocolFromText(protocol);
    if (!normalizedProtocol || !detailedSubject || !["document", "process"].includes(target)) {
      return;
    }

    try {
      const history = getConsultationHistory();
      const previous =
        history[target].find(
          (item) => onlyDigits(item.protocol) === onlyDigits(normalizedProtocol)
        ) || {};
      const entry = {
        protocol: normalizedProtocol,
        detailedSubject: String(detailedSubject).trim(),
        idDoc: options && options.idDoc ? String(options.idDoc) : previous.idDoc || "",
        idProcesso:
          options && options.idProcesso ? String(options.idProcesso) : previous.idProcesso || "",
        at: Date.now()
      };

      history[target] = [
        entry,
        ...history[target].filter((item) => onlyDigits(item.protocol) !== onlyDigits(normalizedProtocol))
      ].slice(0, HISTORY_LIMIT);

      localStorage.setItem(CONSULTATION_HISTORY_KEY, JSON.stringify(history));
      renderConsultationHistory();
    } catch (_error) {
      // History is a convenience feature; navigation still works without it.
    }
  }

  function getHistoryItemUrl(target, item) {
    if (target === "document" && item.idDoc) {
      return getDocumentInfoUrlById(item.idDoc);
    }

    if (target === "process") {
      const publicIdProcesso = item.idProcesso || getCachedPublicProcessId(item.protocol);
      if (publicIdProcesso) {
        return getPublicProcessDetailUrlById(publicIdProcesso);
      }
    }

    const url = new URL(ADMIN_PORTAL_URL, location.origin);
    url.searchParams.set(target === "document" ? "doc" : "proc", item.protocol);
    return url.href;
  }

  function getHistoryItemDetailedSubject(target, item) {
    const cachedSubject =
      target === "document"
        ? getCachedDocumentDetailedSubject(item.protocol)
        : getCachedPublicProcessDetailedSubject(item.protocol);
    const savedSubject = String(item.detailedSubject || "").trim();

    if (cachedSubject && (!savedSubject || /não informado|nao informado/i.test(savedSubject))) {
      return cachedSubject;
    }

    return savedSubject || "Assunto detalhado não informado";
  }

  function createHistoryList(target, items) {
    const section = document.createElement("section");
    section.className = "sipac-pr-history-section";

    const title = document.createElement("h3");
    title.textContent = target === "document" ? "Documentos recentes" : "Processos recentes";
    section.appendChild(title);

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "sipac-pr-history-empty";
      empty.textContent = "Nenhuma consulta registrada.";
      section.appendChild(empty);
      return section;
    }

    const list = document.createElement("ul");
    items.forEach((item) => {
      const listItem = document.createElement("li");
      const link = document.createElement("a");
      link.href = getHistoryItemUrl(target, item);
      link.textContent = item.protocol;
      const subject = document.createElement("div");
      subject.textContent = getHistoryItemDetailedSubject(target, item);
      listItem.append(link, subject);
      list.appendChild(listItem);
    });
    section.appendChild(list);
    return section;
  }

  function renderConsultationHistory(widget, options) {
    const container =
      document.getElementById("sipac-pr-consultation-history") ||
      (widget && document.createElement("section"));

    if (!container) {
      return;
    }

    if (!container.id) {
      container.id = "sipac-pr-consultation-history";
      if (options && options.insideWidget) {
        widget.appendChild(container);
      } else {
        widget.insertAdjacentElement("afterend", container);
      }
    }

    const history = getConsultationHistory();
    container.replaceChildren(
      createHistoryList("document", history.document),
      createHistoryList("process", history.process)
    );
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
    setLastSearch(protocol, "document", { directOpen: true });
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

  function submitAuthenticatedSearch(parts, root, target, options) {
    const searchUrl = AUTH_SEARCH_URLS[target];
    const isDocument = target === "document";
    const form = isDocument ? getDocumentForm() : getProcessForm();
    const expectedField = isDocument ? '[name="docsForm:radical"]' : '[name="processoForm:radical"]';

    if (!form || !form.querySelector(expectedField)) {
      setPendingAuthSearch(parts, target, options);
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
    setLastSearch(formatProtocol(parts), target, options);
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

    if (mode === "authenticated" && target === "document") {
      const cachedIdDoc = getCachedDocumentId(formatProtocol(parts));
      if (cachedIdDoc) {
        location.assign(getDocumentInfoUrlById(cachedIdDoc));
        return;
      }
    }

    if (mode === "authenticated") {
      submitAuthenticatedSearch(parts, root, target, { directOpen: target === "document" });
      return;
    }

    if (target === "document") {
      const protocol = formatProtocol(parts);
      const cachedIdDoc = getCachedDocumentId(protocol);
      if (cachedIdDoc) {
        recordConsultation("document", protocol, getCachedDocumentDetailedSubject(protocol), {
          idDoc: cachedIdDoc
        });
        location.assign(getDocumentInfoUrlById(cachedIdDoc));
        return;
      }
    }

    if (target === "process") {
      const protocol = formatProtocol(parts);
      const cachedIdProcesso = getCachedPublicProcessId(protocol);
      if (cachedIdProcesso) {
        recordConsultation("process", protocol, getCachedPublicProcessDetailedSubject(protocol), {
          idProcesso: cachedIdProcesso
        });
        location.assign(getPublicProcessDetailUrlById(cachedIdProcesso));
        return;
      }
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

  function isAuthenticatedAdminPortalResponse(response, html) {
    const finalUrl = new URL(response.url);
    const hasAdminPortalMarker =
      /id=["']formmenuadm["']/i.test(html) ||
      /portal_administrativo\/include\/portal_administrativo\.css/i.test(html);

    return (
      response.ok &&
      hasAdminPortalMarker &&
      finalUrl.hostname === location.hostname &&
      (finalUrl.pathname === ADMIN_PORTAL_URL ||
        finalUrl.pathname === "/sipac/menuUnidade.do" ||
        finalUrl.pathname.startsWith("/sipac/portal_administrativo/"))
    );
  }

  function insertPortalAccessButton(widget, isAuthenticated) {
    if (!widget || document.querySelector("[data-sipac-portal-access-link]")) {
      return;
    }

    const link = document.createElement("a");
    link.className = "sipac-pr-portal-access-link";
    link.dataset.sipacPortalAccessLink = "true";
    link.href = isAuthenticated ? ADMIN_PORTAL_URL : "/sipac/";
    link.textContent = isAuthenticated ? "Acessar Portal Administrativo" : "Entrar no sistema";
    widget.insertAdjacentElement("afterend", link);
  }

  async function insertPortalAccessButtonForSession(widget) {
    try {
      const response = await fetch(ADMIN_PORTAL_URL, {
        credentials: "include",
        cache: "no-store"
      });
      const html = await response.text();

      insertPortalAccessButton(widget, isAuthenticatedAdminPortalResponse(response, html));
    } catch (_error) {
      insertPortalAccessButton(widget, false);
    }
  }

  function ensurePublicConsultationHistory(widget) {
    if (!widget || !widget.isConnected || document.getElementById("sipac-pr-consultation-history")) {
      return;
    }

    renderConsultationHistory(widget, { insideWidget: true });
    const history = document.getElementById("sipac-pr-consultation-history");
    if (history) {
      history.classList.add("sipac-pr-public-history");
    }
  }

  function insertPublicWidget() {
    const editaisBox = document.querySelector("#p-comunicados div.editais");
    const editaisTitle = editaisBox && editaisBox.querySelector("h3");

    if (!editaisBox || !editaisTitle) {
      return false;
    }

    const widget = createWidget("public");
    editaisTitle.insertAdjacentElement("afterend", widget);
    ensurePublicConsultationHistory(widget);
    insertPortalAccessButtonForSession(widget).then(() => ensurePublicConsultationHistory(widget));

    const observer = new MutationObserver(() => ensurePublicConsultationHistory(widget));
    observer.observe(editaisBox, { childList: true, subtree: true });
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

    renderConsultationHistory(widget);
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

  function extractPublicProcessIdFromLink(link) {
    const haystack = `${link.getAttribute("href") || ""} ${link.getAttribute("onclick") || ""}`;
    const match =
      haystack.match(/processo_detalhado\.jsf\?[^"' ]*?\bid=([0-9]+)/i) ||
      haystack.match(/(?:[?&]id|idProcesso)=([0-9]+)/i) ||
      haystack.match(/['"]idProcesso['"]\s*:\s*['"]?([0-9]+)/i);

    return match ? match[1] : null;
  }

  function findPublicProcessResult(protocolDigits) {
    const rows = Array.from(
      document.querySelectorAll("#corpo tr, #corpo .listagem li, #corpo dl, #conteudo tr, #conteudo .listagem li, #conteudo dl")
    );

    for (const row of rows) {
      if (!onlyDigits(visibleText(row)).includes(protocolDigits)) {
        continue;
      }

      for (const link of row.querySelectorAll("a")) {
        const idProcesso = extractPublicProcessIdFromLink(link);
        if (idProcesso) {
          return { idProcesso, row };
        }
      }
    }

    return null;
  }

  function getResultCellMap(table, row) {
    const headers = Array.from(table.querySelectorAll("thead th, tr:first-child th")).map((header) =>
      visibleText(header)
    );
    const cells = Array.from(row.cells || []);

    return cells.map((cell, index) => ({
      label: headers[index] || `Campo ${index + 1}`,
      value: visibleText(cell),
      cell
    }));
  }

  function findProcessResultRow(table, protocolDigits) {
    return Array.from(table.querySelectorAll("tbody tr, tr")).find((row) => {
      if (row.querySelector("th")) {
        return false;
      }

      return onlyDigits(visibleText(row)).includes(protocolDigits);
    });
  }

  function pickProcessField(fields, pattern) {
    return fields.find((field) => pattern.test(field.label)) ||
      fields.find((field) => pattern.test(field.value));
  }

  function getProcessLabeledValue(scope, labelPattern) {
    const label = Array.from(scope.querySelectorAll("b, strong, th, dt, .rotulo")).find((element) =>
      labelPattern.test(visibleText(element).replace(/:$/, "").trim())
    );

    if (!label) {
      return "";
    }

    const parts = [];
    let node = label.nextSibling;

    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE && /^(B|STRONG)$/i.test(node.tagName)) {
        break;
      }

      if (!(node.nodeType === Node.ELEMENT_NODE && /^BR$/i.test(node.tagName))) {
        parts.push(node.nodeType === Node.TEXT_NODE ? node.textContent || "" : visibleText(node));
      }
      node = node.nextSibling;
    }

    const siblingValue = parts.join(" ").replace(/\s+/g, " ").trim();
    if (siblingValue) {
      return siblingValue;
    }

    const labelCell = label.closest("th, td");
    const row = label.closest("tr");
    const cells = row ? Array.from(row.cells || []) : [];
    const labelCellIndex = cells.indexOf(labelCell);
    if (labelCellIndex >= 0) {
      const cellValue = cells
        .slice(labelCellIndex + 1)
        .map((cell) => visibleText(cell))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (cellValue) {
        return cellValue;
      }
    }

    const parentText = label.parentElement ? visibleText(label.parentElement) : "";
    const labelText = visibleText(label);
    return parentText.startsWith(labelText) ? parentText.slice(labelText.length).trim() : "";
  }

  function getProcessDetailedSubject(row, fields, table) {
    const labeledDetailedSubject =
      getProcessLabeledValue(row, /^assunto\s+detalhado$/i) ||
      (table ? getProcessLabeledValue(table, /^assunto\s+detalhado$/i) : "");
    if (labeledDetailedSubject) {
      return labeledDetailedSubject;
    }

    const detailField = pickProcessField(fields, /assunto\s+detalhado/i);
    return detailField ? detailField.value : "";
  }

  function getProcessSubject(row, fields, table) {
    const labeledSubject =
      getProcessLabeledValue(row, /^assunto\s+do\s+processo$/i) ||
      (table ? getProcessLabeledValue(table, /^assunto\s+do\s+processo$/i) : "");
    if (labeledSubject) {
      return labeledSubject;
    }

    const subjectField =
      fields.find((field) => /assunto/i.test(field.label)) ||
      fields.find((field) => /classifica/i.test(field.label));
    return subjectField ? subjectField.value : "";
  }

  function recordPublicProcessDetailConsultation() {
    if (!isPublicProcessDetailPage) {
      return;
    }

    const pageText = visibleText(document.body);
    const protocol = getProtocolFromText(pageText);
    const idProcesso = new URLSearchParams(location.search).get("id");
    const detailedSubject = getProcessLabeledValue(document.body, /^assunto\s+detalhado$/i);

    if (!protocol || !idProcesso || !detailedSubject) {
      return;
    }

    setCachedPublicProcessId(protocol, idProcesso, { detailedSubject });
    recordConsultation("process", protocol, detailedSubject, { idProcesso });
  }

  function findProcessPdfLink(row) {
    return Array.from(row.querySelectorAll("a")).find((link) =>
      /gerar\s*pdf|pdf/i.test(getLinkHaystack(link))
    );
  }

  function getActionLabel(link, fallback) {
    const text = visibleText(link);
    const image = link.querySelector("img");
    return (
      text ||
      (image && (image.getAttribute("title") || image.getAttribute("alt"))) ||
      link.getAttribute("title") ||
      fallback
    );
  }

  function createActionButton(label, className, link) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", () => link.click());
    return button;
  }

  function setupSharePopover(scope) {
    const shareToggle = scope.querySelector("[data-sipac-share-toggle]");
    const sharePopover = scope.querySelector("[data-sipac-share-popover]");
    if (!shareToggle || !sharePopover) {
      return;
    }

    const closeSharePopover = () => {
      sharePopover.hidden = true;
      shareToggle.setAttribute("aria-expanded", "false");
    };

    shareToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      sharePopover.hidden = !sharePopover.hidden;
      shareToggle.setAttribute("aria-expanded", String(!sharePopover.hidden));
    });

    sharePopover.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    scope.querySelectorAll("[data-sipac-copy-value]").forEach((button) => {
      button.addEventListener("click", () => {
        const originalText = button.textContent;
        copyTextToClipboard(button.dataset.sipacCopyValue)
          .then(() => {
            button.textContent = "Copiado";
            window.setTimeout(() => {
              button.textContent = originalText;
              closeSharePopover();
            }, 1400);
          })
          .catch(() => {
            button.textContent = "Erro ao copiar";
            window.setTimeout(() => {
              button.textContent = originalText;
            }, 1400);
          });
      });
    });

    document.addEventListener("click", closeSharePopover);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSharePopover();
      }
    });
  }

  function createProcessResultSummary(table, protocolDigits, searchedProtocol) {
    if (document.getElementById("sipac-pr-process-result")) {
      return document.getElementById("sipac-pr-process-result");
    }

    const row = findProcessResultRow(table, protocolDigits);
    if (!row) {
      return null;
    }

    const fields = getResultCellMap(table, row).filter((field) => field.value);
    const labeledDetailedSubject = getProcessDetailedSubject(row, fields, table);
    const labeledSubject = getProcessSubject(row, fields, table);
    const detailField =
      (labeledDetailedSubject
        ? { label: "Assunto Detalhado", value: labeledDetailedSubject, cell: row }
        : null) ||
      pickProcessField(fields, /assunto\s+detalhado/i);
    const protocolField =
      (searchedProtocol ? { label: "Processo", value: searchedProtocol, cell: row } : null) ||
      pickProcessField(fields, /protocolo|processo/i);
    const subjectField =
      (labeledSubject ? { label: "Assunto do Processo", value: labeledSubject, cell: row } : null) ||
      fields.find((field) => /assunto/i.test(field.label) && field !== detailField) ||
      fields.find((field) => /classifica/i.test(field.label));
    const detailLink = findProcessLink(protocolDigits, "process");
    const pdfLink = findProcessPdfLink(row);
    const actionLinks = new Set([detailLink, pdfLink].filter(Boolean));
    const otherLinks = Array.from(row.querySelectorAll("a")).filter((link) => !actionLinks.has(link));
    const selectedFields = new Set([detailField, protocolField, subjectField].filter(Boolean));
    const otherFields = fields.filter((field) => {
      if (selectedFields.has(field)) {
        return false;
      }

      return !field.cell.querySelector("a") && field.value;
    });

    const summary = document.createElement("section");
    summary.id = "sipac-pr-process-result";

    if (searchedProtocol && detailField && detailField.value) {
      recordConsultation("process", searchedProtocol, detailField.value);
    }

    const title = document.createElement("div");
    title.className = "sipac-pr-process-detail";
    title.textContent = detailField && detailField.value ? detailField.value : "Processo encontrado";
    summary.appendChild(title);

    if (protocolField && protocolField.value) {
      const protocol = document.createElement("div");
      protocol.className = "sipac-pr-protocol";
      const processSearchUrl = new URL(ADMIN_PORTAL_URL, location.origin);
      processSearchUrl.searchParams.set("proc", protocolField.value);
      protocol.innerHTML = `<span class="sipac-pr-protocol-label">Processo:</span> <span class="sipac-pr-protocol-number">${escapeHtml(protocolField.value)}</span><span class="sipac-pr-share-wrapper"><button class="sipac-pr-copy-button fa fa-share-alt" type="button" data-sipac-share-toggle title="Compartilhar" aria-label="Compartilhar" aria-expanded="false"></button><span class="sipac-pr-share-popover" data-sipac-share-popover hidden><button type="button" data-sipac-copy-value="${escapeAttribute(protocolField.value)}"><span class="fa fa-copy" aria-hidden="true"></span> Copiar número do processo</button><button type="button" data-sipac-copy-value="${escapeAttribute(processSearchUrl.href)}"><span class="fa fa-link" aria-hidden="true"></span> Copiar link para busca do processo</button></span></span>`;
      summary.appendChild(protocol);
      setupSharePopover(protocol);
    }

    if (subjectField && subjectField.value) {
      const subject = document.createElement("div");
      subject.className = "sipac-pr-process-subject";
      subject.textContent = subjectField.value;
      summary.appendChild(subject);
    }

    const actionRow = document.createElement("div");
    actionRow.className = "sipac-pr-action-row";

    if (detailLink) {
      actionRow.appendChild(createActionButton("Exibir Processo", "sipac-pr-download-button", detailLink));
    }

    if (pdfLink) {
      actionRow.appendChild(createActionButton("Baixar PDF", "sipac-pr-download-button sipac-pr-secondary-button", pdfLink));
    }

    if (actionRow.children.length) {
      summary.appendChild(actionRow);
    }

    if (otherFields.length) {
      const details = document.createElement("dl");
      details.className = "sipac-pr-process-fields";
      otherFields.forEach((field) => {
        const term = document.createElement("dt");
        term.textContent = field.label;
        const description = document.createElement("dd");
        description.textContent = field.value;
        details.append(term, description);
      });
      summary.appendChild(details);
    }

    if (otherLinks.length) {
      const secondaryActions = document.createElement("div");
      secondaryActions.className = "sipac-pr-secondary-actions";
      otherLinks.forEach((link, index) => {
        secondaryActions.appendChild(
          createActionButton(getActionLabel(link, `Ação ${index + 1}`), "sipac-pr-muted-action", link)
        );
      });
      summary.appendChild(secondaryActions);
    }

    return summary;
  }

  function removeSearchChrome(target, preserveElement, protocolDigits, searchedProtocol) {
    document.querySelectorAll("div.descricaoOperacao").forEach((element) => element.remove());

    const form = target === "document" ? getDocumentForm() : getProcessForm();
    if (!form) {
      return;
    }

    if (target === "process") {
      const resultsTable = form.querySelector("#processoForm\\:tabelaProcessos");
      if (!resultsTable) {
        return;
      }

      const resultRow = findProcessResultRow(resultsTable, protocolDigits);
      if (resultRow && searchedProtocol) {
        const fields = getResultCellMap(resultsTable, resultRow).filter((field) => field.value);
        const detailedSubject =
          getProcessDetailedSubject(resultRow, fields, resultsTable) ||
          "Assunto detalhado não informado";
        recordConsultation("process", searchedProtocol, detailedSubject);
      }

      const summary = createProcessResultSummary(resultsTable, protocolDigits, searchedProtocol);
      if (summary && !summary.isConnected) {
        resultsTable.insertAdjacentElement("beforebegin", summary);
      }

      Array.from(form.children).forEach((child) => {
        const shouldShow =
          child === resultsTable ||
          child === summary ||
          child.contains(resultsTable);

        if (!shouldShow) {
          child.hidden = true;
        }
      });

      resultsTable.hidden = true;
      return;
    }

    Array.from(form.querySelectorAll("table")).forEach((table) => {
      if (preserveElement && table.contains(preserveElement)) {
        return;
      }

      const tableText = visibleText(table);
      const hasSearchInputs = table.querySelector("input, select, textarea");
      const looksLikeResult = /encontrad|resultado|processos?|documentos?/i.test(tableText) &&
        /lupa|visuali[sz]ar|detalh|protocolo/i.test(tableText);

      if (hasSearchInputs && !looksLikeResult) {
        table.remove();
      }
    });

    Array.from(form.querySelectorAll('input[type="submit"], input[type="button"], button')).forEach((button) => {
      if (preserveElement && button.contains(preserveElement)) {
        return;
      }

      if (/buscar|consultar|cancelar/i.test(button.value || button.textContent || "")) {
        button.remove();
      }
    });
  }

  function tryAutoOpenResult() {
    const lastSearch = getLastSearch();

    if (!lastSearch || Date.now() - lastSearch.at > AUTO_OPEN_WINDOW_MS) {
      clearLastSearch();
      return true;
    }

    if (lastSearch.target === "document") {
      if (lastSearch.directOpen) {
        const pageText = visibleText(document.body);
        const protocolWasRendered = onlyDigits(pageText).includes(lastSearch.digits);
        const infoUrl = protocolWasRendered
          ? findDocumentInfoUrl(lastSearch.digits, lastSearch.protocol)
          : null;

        if (infoUrl) {
          clearLastSearch();
          location.assign(infoUrl);
          return true;
        }

        if (/nenhum|não encontrado|nao encontrado/i.test(pageText)) {
          clearLastSearch();
          return true;
        }

        return false;
      }

      clearLastSearch();
      return true;
    }

    const pageText = visibleText(document.body);
    const protocolWasRendered = onlyDigits(pageText).includes(lastSearch.digits);

    if (isPortalPage) {
      const result = protocolWasRendered ? findPublicProcessResult(lastSearch.digits) : null;

      if (result) {
        const table = result.row.closest("table");
        const fields = table ? getResultCellMap(table, result.row) : [];
        const detailedSubject =
          getProcessDetailedSubject(result.row, fields, table) ||
          "Assunto detalhado não informado";
        setCachedPublicProcessId(lastSearch.protocol, result.idProcesso, { detailedSubject });
        recordConsultation("process", lastSearch.protocol, detailedSubject, {
          idProcesso: result.idProcesso
        });
        clearLastSearch();
        location.assign(getPublicProcessDetailUrlById(result.idProcesso));
        return true;
      }

      if (/nenhum|não encontrado|nao encontrado/i.test(pageText)) {
        clearLastSearch();
        return true;
      }

      return false;
    }

    const link = protocolWasRendered ? findProcessLink(lastSearch.digits, lastSearch.target) : null;

    if (!link) {
      if (/nenhum|não encontrado|nao encontrado/i.test(pageText)) {
        removeSearchChrome(lastSearch.target, null, lastSearch.digits, lastSearch.protocol);
        clearLastSearch();
        return true;
      }

      return false;
    }

    removeSearchChrome(lastSearch.target, link, lastSearch.digits, lastSearch.protocol);
    clearLastSearch();
    return true;
  }

  function findDocumentDetailLink(row) {
    const links = Array.from(row.querySelectorAll("a"));
    return (
      links.find((link) => isDetailLink(link, "document")) ||
      links.find((link) => /lupa\.gif|visuali[sz]ar|exibir|detalh/i.test(getLinkHaystack(link)))
    );
  }

  function extractDocumentIdFromLink(link) {
    const haystack = `${link.getAttribute("onclick") || ""} ${link.getAttribute("href") || ""}`;
    const idDocMatch = haystack.match(/(?:idDoc|idDocumento)=([0-9]+)/i);
    if (idDocMatch) {
      return idDocMatch[1];
    }

    const functionMatch = haystack.match(/(?:infoDocumento|visualizarDocumento|verDocumento|documento)[^0-9]{0,40}([0-9]{4,})/i);
    return functionMatch ? functionMatch[1] : null;
  }

  function findDocumentInfoUrl(protocolDigits, searchedProtocol) {
    const rows = Array.from(
      document.querySelectorAll("#corpo tr, #corpo .listagem li, #corpo dl, #conteudo tr, #conteudo .listagem li, #conteudo dl")
    );

    for (const row of rows) {
      if (!onlyDigits(visibleText(row)).includes(protocolDigits)) {
        continue;
      }

      const link = findDocumentDetailLink(row);
      const idDoc = link && extractDocumentIdFromLink(link);
      if (idDoc) {
        const table = row.closest("table");
        const fields = table ? getResultCellMap(table, row) : [];
        const detailedSubject =
          getProcessLabeledValue(row, /^assunto\s+detalhado$/i) ||
          (table ? getProcessLabeledValue(table, /^assunto\s+detalhado$/i) : "") ||
          (pickProcessField(fields, /assunto\s+detalhado/i) || {}).value ||
          "Assunto detalhado não informado";
        const protocol = searchedProtocol || protocolDigits;
        setCachedDocumentId(protocol, idDoc, { detailedSubject });
        recordConsultation("document", protocol, detailedSubject, { idDoc });
        return getDocumentInfoUrlById(idDoc);
      }
    }

    return null;
  }

  function getWindowOpenUrl(element) {
    const onclick = element && (element.getAttribute("onclick") || element.getAttribute("onClick") || "");
    const match = onclick.match(/window\.open\s*\(\s*['"]([^'"]+)['"]/i);
    return match ? new URL(match[1], location.href).href : null;
  }

  function getTableByCaption(pattern) {
    return Array.from(document.querySelectorAll("table")).find((table) => {
      const caption = table.querySelector("caption");
      return caption && pattern.test(visibleText(caption));
    });
  }

  function getDocumentField(label) {
    const documentTable = getTableByCaption(/^documento$/i);
    if (!documentTable) {
      return "";
    }

    const row = Array.from(documentTable.querySelectorAll("tr")).find((candidate) => {
      const header = candidate.querySelector("th.rotulo, th");
      return header && visibleText(header).replace(/:$/, "").trim().toLowerCase() === label.toLowerCase();
    });

    if (!row) {
      return "";
    }

    const header = row.querySelector("th.rotulo, th");
    const cells = Array.from(row.children);
    const headerIndex = cells.indexOf(header);
    const valueCell = cells.slice(headerIndex + 1).find((cell) => cell.tagName === "TD");
    return valueCell ? visibleText(valueCell) : "";
  }

  function getDocumentFileLink() {
    const documentTable = getTableByCaption(/^documento$/i);
    if (!documentTable) {
      return null;
    }

    const row = Array.from(documentTable.querySelectorAll("tr")).find((candidate) => {
      const header = candidate.querySelector("th.rotulo, th");
      return header && /^arquivo:?$/i.test(visibleText(header));
    });
    const link = row && row.querySelector("a");

    if (!link) {
      return null;
    }

    const directUrl = getWindowOpenUrl(link);
    const href = link.getAttribute("href");

    return {
      href: directUrl || (href && href !== "#" ? new URL(href, location.href).href : null),
      label: visibleText(link) || "Baixar arquivo"
    };
  }

  function getDocumentViewLink() {
    const links = Array.from(document.querySelectorAll("a"));
    const link = links.find((candidate) => /visualizar\s+documento/i.test(visibleText(candidate))) ||
      links.find((candidate) => /visualizar\s+documento/i.test(getLinkHaystack(candidate)));

    if (!link) {
      return null;
    }

    const directUrl = getWindowOpenUrl(link);
    const href = link.getAttribute("href");

    return {
      href: directUrl || (href && href !== "#" && !/^javascript:/i.test(href) ? new URL(href, location.href).href : null),
      label: "Exibir documento"
    };
  }

  function getDocumentIdFromLocation() {
    return new URLSearchParams(location.search).get("idDoc") || "";
  }

  function getDocumentPdfLink() {
    const idDoc = getDocumentIdFromLocation();
    if (!idDoc) {
      return null;
    }

    return {
      href: new URL(`/sipac/protocolo/documento/documento_visualizacao.jsf?imprimir=true&idDoc=${encodeURIComponent(idDoc)}`, location.origin).href,
      label: "Baixar PDF"
    };
  }

  function copyTextToClipboard(value) {
    const text = String(value || "").trim();
    if (!text) {
      return Promise.reject(new Error("Texto vazio"));
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      return navigator.clipboard.writeText(text);
    }

    return new Promise((resolve, reject) => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();

      try {
        document.execCommand("copy") ? resolve() : reject(new Error("Falha ao copiar"));
      } catch (error) {
        reject(error);
      } finally {
        textarea.remove();
      }
    });
  }

  function parseSipacDate(value) {
    const match = String(value || "").match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
    if (!match) {
      return 0;
    }

    return new Date(
      Number(match[3]),
      Number(match[2]) - 1,
      Number(match[1]),
      Number(match[4] || 0),
      Number(match[5] || 0)
    ).getTime();
  }

  function getSignatureSummary() {
    const table = getTableByCaption(/assinaturas\s+do\s+documento/i);
    const rows = table ? Array.from(table.querySelectorAll("tbody tr")) : [];
    const signatures = rows
      .map((row) => {
        const cells = Array.from(row.cells || []);
        if (cells.length < 4) {
          return null;
        }

        return {
          name: cleanSignerName(visibleText(cells[1] || "")),
          status: visibleText(cells[3] || "")
        };
      })
      .filter((signature) => signature && signature.name && /assinado|não assinado|nao assinado/i.test(signature.status));

    const signedCount = signatures.filter((signature) => /assinado\s+em/i.test(signature.status)).length;
    const pending = signatures.filter((signature) => !/assinado\s+em/i.test(signature.status));

    return {
      signedCount,
      totalCount: signatures.length,
      pendingNames: pending.map((signature) => toPortugueseTitleCase(signature.name))
    };
  }

  function cleanSignerName(value) {
    return String(value || "")
      .replace(/\([^)]*\)/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function toPortugueseTitleCase(value) {
    const lowerCaseWords = new Set(["a", "as", "e", "o", "os", "de", "da", "das", "do", "dos"]);

    return String(value || "")
      .toLocaleLowerCase("pt-BR")
      .split(/\s+/)
      .filter(Boolean)
      .map((word, index) => {
        if (index > 0 && lowerCaseWords.has(word)) {
          return word;
        }

        return word
          .split("-")
          .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1))
          .join("-");
      })
      .join(" ");
  }

  function getCurrentDestination() {
    const table = getTableByCaption(/movimenta[çc][õo]es\s+do\s+documento/i);
    const rows = table ? Array.from(table.querySelectorAll("tbody tr")) : [];
    let selected = null;

    rows.forEach((row) => {
      const cells = Array.from(row.cells || []);
      const destination = visibleText(cells[0] || "");
      const sentAt = visibleText(cells[1] || "");
      const receivedAt = visibleText(cells[3] || "");
      const timestamp = Math.max(parseSipacDate(sentAt), parseSipacDate(receivedAt));

      if (destination && (!selected || timestamp >= selected.timestamp)) {
        selected = { destination, timestamp };
      }
    });

    return selected ? selected.destination : "";
  }

  function enhanceDocumentInfoPage() {
    if (!isDocumentInfoPage || document.getElementById("sipac-pr-document-summary")) {
      return;
    }

    document.body.classList.add("sipac-pr-document-info-page");

    const content = document.querySelector("#conteudo") || document.body;
    const title = content.querySelector("h2.title");
    const protocol = getDocumentField("Protocolo");
    const detailedSubject = getDocumentField("Assunto Detalhado");
    const subject = getDocumentField("Assunto");
    const file = getDocumentFileLink();
    const primaryAction = file || getDocumentViewLink();
    const primaryActionLabel = file ? "Baixar arquivo" : "Exibir documento";
    const pdfAction = file ? null : getDocumentPdfLink();
    const signatures = getSignatureSummary();
    const destination = getCurrentDestination();

    if (!protocol && !detailedSubject && !subject && !primaryAction && !pdfAction && !signatures.totalCount && !destination) {
      return;
    }

    if (protocol && detailedSubject) {
      setCachedDocumentId(protocol, getDocumentIdFromLocation(), { detailedSubject });
      recordConsultation("document", protocol, detailedSubject, {
        idDoc: getDocumentIdFromLocation()
      });
    }

    const summary = document.createElement("section");
    summary.id = "sipac-pr-document-summary";

    const pendingList = signatures.pendingNames.length
      ? `<ul class="sipac-pr-pending-list">${signatures.pendingNames
          .map((name) => `<li>${escapeHtml(name)}</li>`)
          .join("")}</ul>`
      : '<div class="sipac-pr-muted">Nenhuma assinatura pendente.</div>';

    const actionButtons = [
      primaryAction && primaryAction.href
        ? `<a class="sipac-pr-download-button" href="${escapeAttribute(primaryAction.href)}">${primaryActionLabel}</a>`
        : "",
      pdfAction && pdfAction.href
        ? `<a class="sipac-pr-download-button sipac-pr-secondary-button" href="${escapeAttribute(pdfAction.href)}">${escapeHtml(pdfAction.label)}</a>`
        : ""
    ].filter(Boolean);

    summary.innerHTML = [
      `<div class="sipac-pr-doc-detail">${escapeHtml(detailedSubject || "Documento sem assunto detalhado")}</div>`,
      protocol
        ? `<div class="sipac-pr-protocol"><span class="sipac-pr-protocol-label">Protocolo:</span> <span class="sipac-pr-protocol-number">${escapeHtml(protocol)}</span><span class="sipac-pr-share-wrapper"><button class="sipac-pr-copy-button fa fa-share-alt" type="button" data-sipac-share-toggle title="Compartilhar" aria-label="Compartilhar" aria-expanded="false"></button><span class="sipac-pr-share-popover" data-sipac-share-popover hidden><button type="button" data-sipac-copy-value="${escapeAttribute(protocol)}"><span class="fa fa-copy" aria-hidden="true"></span> Copiar número do processo</button><button type="button" data-sipac-copy-value="${escapeAttribute(location.href)}"><span class="fa fa-link" aria-hidden="true"></span> Copiar link para a página de detalhamento do processo</button></span></span></div>`
        : "",
      `<div class="sipac-pr-doc-subject">${escapeHtml(subject || "Assunto não informado")}</div>`,
      actionButtons.length
        ? `<div class="sipac-pr-action-row">${actionButtons.join("")}</div>`
        : '<div class="sipac-pr-muted">Documento principal não encontrado.</div>',
      '<div class="sipac-pr-summary-grid">',
      '<div class="sipac-pr-summary-panel">',
      '<div class="sipac-pr-summary-label">Assinaturas</div>',
      `<div class="sipac-pr-signature-count">${signatures.signedCount}/${signatures.totalCount}</div>`,
      '<div class="sipac-pr-summary-label">Pendentes</div>',
      pendingList,
      "</div>",
      '<div class="sipac-pr-summary-panel">',
      '<div class="sipac-pr-summary-label">Último destino</div>',
      `<div class="sipac-pr-destination">${escapeHtml(destination || "Destino não encontrado")}</div>`,
      "</div>",
      "</div>"
    ].join("");

    if (title) {
      title.insertAdjacentElement("afterend", summary);
    } else {
      content.insertAdjacentElement("afterbegin", summary);
    }

    setupSharePopover(summary);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function watchDocumentEnhancements() {
    const observer = new MutationObserver(() => {
      enhanceDocumentInfoPage();
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
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
    submitAuthenticatedSearch(pending.parts, hiddenRoot, pending.target || "process", {
      directOpen: Boolean(pending.directOpen)
    });
  }

  function handleDirectProtocolUrl() {
    if (!isAdminPortalPage) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const documentProtocol = params.get("doc");
    const processProtocol = params.get("proc");
    const protocol = documentProtocol || processProtocol;
    const target = documentProtocol ? "document" : "process";

    if (!protocol) {
      return;
    }

    const parts = parseProtocol(protocol);
    if (!parts) {
      return;
    }

    const cachedIdDoc = target === "document" ? getCachedDocumentId(protocol) : null;
    if (target === "document" && cachedIdDoc) {
      location.replace(getDocumentInfoUrlById(cachedIdDoc));
      return;
    }

    const cleanUrl = new URL(location.href);
    cleanUrl.searchParams.delete(documentProtocol ? "doc" : "proc");
    history.replaceState(null, "", cleanUrl.href);

    const hiddenRoot = document.createElement("div");
    hiddenRoot.innerHTML = '<span data-sipac-status></span>';
    submitAuthenticatedSearch(parts, hiddenRoot, target, { directOpen: target === "document" });
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

  handleDirectProtocolUrl();
  recordPublicProcessDetailConsultation();
  enhanceDocumentInfoPage();
  watchDocumentEnhancements();
  scheduleAutoOpen();
})();
