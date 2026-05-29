(function () {
  "use strict";

  const ROOT_ID = "sipac-protocolo-rapido";
  const LAST_SEARCH_KEY = "sipacProtocoloRapido:lastSearch";
  const AUTO_OPEN_WINDOW_MS = 15000;

  const isSipacPage = location.hostname === "sipac.ufba.br";
  const isPortalPage =
    isSipacPage && (location.pathname === "/" || location.pathname === "/public/jsp/portal.jsf");

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

  function setLastSearch(protocol) {
    try {
      sessionStorage.setItem(
        LAST_SEARCH_KEY,
        JSON.stringify({ protocol, digits: onlyDigits(protocol), at: Date.now() })
      );
    } catch (_error) {
      // The extension still works without sessionStorage.
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

  function submitOfficialSearch(parts, root) {
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
    setLastSearch(protocol);

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

  function handleSearch(root) {
    const input = root.querySelector("[data-sipac-input]");
    const parts = parseProtocol(input.value);

    if (!parts) {
      setStatus(root, "Cole um protocolo no formato 23066.000000/2026-00.", "error");
      input.focus();
      return;
    }

    submitOfficialSearch(parts, root);
  }

  function createWidget() {
    const container = document.createElement("div");
    container.id = ROOT_ID;
    container.innerHTML = [
      '<label class="sipac-pr-label" for="sipac-pr-input">Consulta rápida de protocolo</label>',
      '<div class="sipac-pr-row">',
      '<input id="sipac-pr-input" data-sipac-input type="text" inputmode="numeric" autocomplete="off" placeholder="23066.000000/2026-00" />',
      '<button type="button" data-sipac-submit>Consultar</button>',
      "</div>",
      '<div class="sipac-pr-status" data-sipac-status data-kind="info">Cole o número do protocolo para abrir o processo.</div>'
    ].join("");

    container.querySelector("[data-sipac-submit]").addEventListener("click", () => {
      handleSearch(container);
    });

    container.querySelector("[data-sipac-input]").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleSearch(container);
      }
    });

    container.querySelector("[data-sipac-input]").addEventListener("paste", () => {
      window.setTimeout(() => handleSearch(container), 50);
    });

    return container;
  }

  function insertWidget() {
    const editaisBox = document.querySelector("#p-comunicados div.editais");
    const editaisTitle = editaisBox && editaisBox.querySelector("h3");

    if (!editaisBox || !editaisTitle) {
      return false;
    }

    editaisTitle.insertAdjacentElement("afterend", createWidget());
    return true;
  }

  function visibleText(element) {
    return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
  }

  function isActionableProcessLink(link) {
    const text = visibleText(link);
    const href = link.getAttribute("href") || "";
    const onclick = link.getAttribute("onclick") || "";
    const haystack = `${text} ${href} ${onclick}`;

    if (/listaEditais|portal\.jsf|javascript:void/i.test(haystack)) {
      return false;
    }

    return /visuali[sz]ar|detalhar|processo|protocolo|jsfcljs|public/i.test(haystack);
  }

  function findProcessLink(protocolDigits) {
    const rows = Array.from(document.querySelectorAll("#corpo tr, #corpo .listagem li, #corpo dl"));

    for (const row of rows) {
      if (!onlyDigits(visibleText(row)).includes(protocolDigits)) {
        continue;
      }

      const links = Array.from(row.querySelectorAll("a")).filter(isActionableProcessLink);
      if (links.length === 1) {
        return links[0];
      }

      const preferred = links.find((link) => /visuali[sz]ar|detalhar/i.test(visibleText(link)));
      if (preferred) {
        return preferred;
      }
    }

    const linksWithProtocol = Array.from(document.querySelectorAll("#corpo a")).filter((link) => {
      const haystack = `${visibleText(link)} ${link.getAttribute("href") || ""} ${
        link.getAttribute("onclick") || ""
      }`;
      return onlyDigits(haystack).includes(protocolDigits) && isActionableProcessLink(link);
    });

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
    const link = protocolWasRendered ? findProcessLink(lastSearch.digits) : null;

    if (!link) {
      if (/nenhum|não encontrado|nao encontrado/i.test(pageText)) {
        clearLastSearch();
        return true;
      }

      return false;
    }

    clearLastSearch();
    link.click();
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

  if (isPortalPage && !document.getElementById(ROOT_ID) && !insertWidget()) {
    const observer = new MutationObserver(() => {
      if (document.getElementById(ROOT_ID)) {
        observer.disconnect();
        return;
      }

      if (insertWidget()) {
        observer.disconnect();
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  scheduleAutoOpen();
})();
