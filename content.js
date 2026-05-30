(function () {
  "use strict";

  const ROOT_ID = "sipac-protocolo-rapido";
  const LAST_SEARCH_KEY = "sipacProtocoloRapido:lastSearch";
  const PENDING_AUTH_SEARCH_KEY = "sipacProtocoloRapido:pendingAuthSearch";
  const DOCUMENT_ID_CACHE_KEY = "sipacProtocoloRapido:documentIdCache";
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
  const isDocumentInfoPage =
    isSipacPage && location.pathname === "/sipac/protocolo/consulta/info_documento.jsf";

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

  function setCachedDocumentId(protocol, idDoc) {
    const digits = onlyDigits(protocol);
    if (!digits || !idDoc) {
      return;
    }

    try {
      const cache = getDocumentIdCache();
      cache[digits] = {
        idDoc: String(idDoc),
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

    if (mode === "authenticated") {
      submitAuthenticatedSearch(parts, root, target, { directOpen: target === "document" });
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

  function removeSearchChrome(target, preserveElement) {
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

      Array.from(form.children).forEach((child) => {
        if (child !== resultsTable && !child.contains(resultsTable)) {
          child.remove();
        }
      });

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
        const infoUrl = protocolWasRendered ? findDocumentInfoUrl(lastSearch.digits) : null;

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
    const link = protocolWasRendered ? findProcessLink(lastSearch.digits, lastSearch.target) : null;

    if (!link) {
      if (/nenhum|não encontrado|nao encontrado/i.test(pageText)) {
        removeSearchChrome(lastSearch.target);
        clearLastSearch();
        return true;
      }

      return false;
    }

    removeSearchChrome(lastSearch.target, link);
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

  function findDocumentInfoUrl(protocolDigits) {
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
        setCachedDocumentId(protocolDigits, idDoc);
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
        ? `<div class="sipac-pr-protocol"><span class="sipac-pr-protocol-label">Protocolo:</span> <span class="sipac-pr-protocol-number">${escapeHtml(protocol)}</span><button class="sipac-pr-copy-button fa fa-copy" type="button" data-sipac-copy-protocol="${escapeAttribute(protocol)}" title="Copiar número do protocolo" aria-label="Copiar número do protocolo"></button></div>`
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

    const copyButton = summary.querySelector("[data-sipac-copy-protocol]");
    if (copyButton) {
      copyButton.addEventListener("click", () => {
        copyTextToClipboard(copyButton.dataset.sipacCopyProtocol)
          .then(() => {
            copyButton.classList.add("sipac-pr-copied");
            copyButton.setAttribute("title", "Copiado");
            window.setTimeout(() => {
              copyButton.classList.remove("sipac-pr-copied");
              copyButton.setAttribute("title", "Copiar número do protocolo");
            }, 1400);
          })
          .catch(() => {
            copyButton.classList.add("sipac-pr-copy-error");
            copyButton.setAttribute("title", "Erro ao copiar");
            window.setTimeout(() => {
              copyButton.classList.remove("sipac-pr-copy-error");
              copyButton.setAttribute("title", "Copiar número do protocolo");
            }, 1400);
          });
      });
    }
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
  enhanceDocumentInfoPage();
  watchDocumentEnhancements();
  scheduleAutoOpen();
})();
