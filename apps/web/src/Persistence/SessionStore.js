const key = "defterx.live.session";

export class SessionStore {
  load() {
    try { return JSON.parse(localStorage.getItem(key) || "null"); }
    catch { return null; }
  }
  save(session) { localStorage.setItem(key, JSON.stringify(session)); }
  clear() { localStorage.removeItem(key); }
}
