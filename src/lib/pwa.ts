/* Register the offline shell. Only meaningful when the page is served over
   http(s) — a file:// open has no service worker scope, and registration
   would throw on every load. */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "http:" && location.protocol !== "https:") return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* offline is a bonus, not a requirement */
    });
  });
}
