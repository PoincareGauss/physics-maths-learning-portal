/* Persistence layer: browser localStorage first, optional host storage second. */
const TrickbankStorage = (() => {
  const prefix = 'trickbank-v2:';
  const hasLocal = (() => {
    try { const k='__tb_test__'; localStorage.setItem(k,'1'); localStorage.removeItem(k); return true; }
    catch (_) { return false; }
  })();

  async function get(key, fallback) {
    try {
      if (window.storage?.get) {
        const result = await window.storage.get(key, false);
        if (result?.value != null) return JSON.parse(result.value);
      }
    } catch (_) {}
    if (hasLocal) {
      try {
        const raw = localStorage.getItem(prefix + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (_) {}
    }
    return fallback;
  }

  async function set(key, value) {
    try {
      const serialized = JSON.stringify(value);
      if (window.storage?.set) await window.storage.set(key, serialized, false);
      if (hasLocal) localStorage.setItem(prefix + key, serialized);
    } catch (_) {}
  }

  return { get, set };
})();
