// ตั้งค่าธีมก่อนแสดงผล เพื่อไม่ให้หน้าจอกะพริบ (ต้องเป็นไฟล์แยกเพราะ CSP ไม่อนุญาต inline script)
(function () {
  try {
    var get = function (k) {
      return JSON.parse(localStorage.getItem(k) || "null");
    };
    var cfg = get("br.cfg.appearance") || {};
    var mode = get("br.theme") || cfg.defaultThemeMode || "auto";
    var dark =
      mode === "dark" ||
      (mode === "auto" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    var root = document.documentElement;
    root.setAttribute("data-theme", dark ? "dark" : "light");
    if (cfg.themeColor) root.setAttribute("data-brand", cfg.themeColor);
    var motion = get("br.motion") || cfg.motionLevel;
    if (motion) root.setAttribute("data-motion", motion);
  } catch (e) {
    /* ignore */
  }
})();
