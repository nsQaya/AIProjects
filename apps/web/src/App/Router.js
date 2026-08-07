export class Router {
  constructor(onChange) {
    this.onChange = onChange;
    this.routes = new Set(["dashboard", "transactions", "accounts", "savings", "upcoming", "reports", "settings"]);
  }
  current() {
    const route = location.hash.replace(/^#\/?/, "").split("/")[0];
    return this.routes.has(route) ? route : "dashboard";
  }
  start() {
    addEventListener("hashchange", () => this.onChange(this.current()));
    if (!location.hash) history.replaceState(null, "", "#/dashboard");
    this.onChange(this.current());
  }
}
