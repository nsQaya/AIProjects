export const routes = [
  { path: "/dashboard", key: "dashboard", title: "Ana Sayfa", icon: "home" },
  { path: "/transactions", key: "transactions", title: "İşlemler", icon: "transactions" },
  { path: "/accounts", key: "accounts", title: "Hesaplar", icon: "wallet" },
  { path: "/savings", key: "savings", title: "Birikimler", icon: "chart" },
  { path: "/upcoming", key: "upcoming", title: "Yaklaşan", icon: "calendar" },
  { path: "/reports", key: "reports", title: "Raporlar", icon: "chart" },
  { path: "/settings", key: "settings", title: "Ayarlar", icon: "settings" },
] as const;

export type RouteKey = (typeof routes)[number]["key"];

export function routeForPath(pathname: string) {
  return routes.find((route) => pathname.startsWith(route.path)) ?? routes[0];
}
