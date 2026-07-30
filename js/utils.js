(() => {
  "use strict";

  const root = window.VesselM = window.VesselM || {};

  const pressureToMPa = {
    Pa: 1e-6,
    kPa: 0.001,
    MPa: 1,
    bar: 0.1,
    kgf_per_cm2: 0.0980665,
    psi: 0.006894757293168,
    ksi: 6.894757293168
  };

  const lengthToMM = {
    mm: 1,
    cm: 10,
    m: 1000,
    in: 25.4
  };

  function numberOrNull(value) {
    if (value === "" || value === null || value === undefined) return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function round(value, decimals = 3) {
    if (!Number.isFinite(value)) return null;
    const p = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * p) / p;
  }

  function formatNumber(value, decimals = 2) {
    // Calculations retain their full precision; this only limits displayed values.
    const displayDecimals = Math.min(2, Math.max(0, Math.floor(Number(decimals) || 0)));
    if (!Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: displayDecimals,
      minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(displayDecimals, 1)
    }).format(value);
  }

  function convertTemperature(value, from, to) {
    const n = numberOrNull(value);
    if (n === null) return null;
    let c;
    if (from === "degC") c = n;
    else if (from === "degF") c = (n - 32) * 5 / 9;
    else return null;

    if (to === "degC") return c;
    if (to === "degF") return c * 9 / 5 + 32;
    return null;
  }

  function convertPressure(value, from, to) {
    const n = numberOrNull(value);
    if (n === null || !pressureToMPa[from] || !pressureToMPa[to]) return null;
    return n * pressureToMPa[from] / pressureToMPa[to];
  }

  function convertLength(value, from, to) {
    const n = numberOrNull(value);
    if (n === null || !lengthToMM[from] || !lengthToMM[to]) return null;
    return n * lengthToMM[from] / lengthToMM[to];
  }

  function dateStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function timestamp() {
    return new Date().toISOString();
  }

  function safeFilename(value) {
    return String(value || "VesselM")
      .trim()
      .replace(/[^a-z0-9_-]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 90) || "VesselM";
  }

  function downloadText(filename, content, mime = "text/plain") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function downloadJson(filename, data) {
    downloadText(filename, JSON.stringify(data, null, 2), "application/json");
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const box = document.createElement("textarea");
    box.value = text;
    box.style.position = "fixed";
    box.style.opacity = "0";
    document.body.appendChild(box);
    box.select();
    document.execCommand("copy");
    box.remove();
  }

  function getPath(path) {
    return window.VESSELM_DATA?.[path] ?? null;
  }

  function unique(items) {
    return [...new Set(items)];
  }

  function severityRank(severity) {
    return ({ blocking: 4, fail: 4, review: 3, warning: 3, information: 1, pass: 0 })[severity] ?? 2;
  }

  function worstSeverity(items) {
    return items.reduce((worst, item) => {
      const current = typeof item === "string" ? item : item.severity;
      return severityRank(current) > severityRank(worst) ? current : worst;
    }, "pass");
  }

  function debounce(fn, delay = 180) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  root.Utils = {
    pressureToMPa,
    lengthToMM,
    numberOrNull,
    escapeHtml,
    round,
    formatNumber,
    convertTemperature,
    convertPressure,
    convertLength,
    dateStamp,
    timestamp,
    safeFilename,
    downloadText,
    downloadJson,
    copyText,
    getPath,
    unique,
    severityRank,
    worstSeverity,
    debounce
  };
})();
