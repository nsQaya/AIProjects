import { useMemo, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { Button, Icon, IconButton, type IconName } from "../components/ui";
import type { HealthStatus } from "../platform/api/api-client";
import type { AuthUser } from "../platform/auth/auth-schemas";
import { routeForPath, routes } from "../application/route-meta";

interface AppLayoutProps {
  apiStatus: HealthStatus | null;
  bookName: string;
  busy?: boolean;
  children: ReactNode;
  onLogout: () => Promise<void>;
  onNewTransaction: () => void;
  onSync: () => Promise<void>;
  transactionDialog?: ReactNode;
  user: AuthUser;
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}` : value.slice(0, 2))
    .toLocaleUpperCase("tr-TR");
}

export function AppLayout({
  apiStatus,
  bookName,
  busy = false,
  children,
  onLogout,
  onNewTransaction,
  onSync,
  transactionDialog,
  user,
}: AppLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const current = routeForPath(location.pathname);
  const primaryRoutes = routes.filter((route) => route.key !== "settings");
  const settingRoute = routes.find((route) => route.key === "settings");
  const profileInitials = useMemo(() => initials(user.displayName || user.email), [user]);

  return (
    <>
      <div className="app-shell" id="app-shell">
        <aside className={`sidebar${menuOpen ? " open" : ""}`}>
          <NavLink className="brand" to="/dashboard" onClick={() => setMenuOpen(false)}>
            <span className="brand-mark">D</span>
            <span>
              <strong>DefterX</strong>
              <small>Canlı finans alanı</small>
            </span>
          </NavLink>

          <div className="book-switcher">
            <span className="book-icon">{initials(bookName)}</span>
            <span>
              <small>Aktif defter</small>
              <strong id="active-book-name">{bookName}</strong>
            </span>
          </div>

          <nav className="primary-nav" aria-label="Ana menü">
            {primaryRoutes.map((route) => (
              <NavLink
                key={route.key}
                to={route.path}
                data-route={route.key}
                className={({ isActive }) => (isActive ? "active" : undefined)}
                onClick={() => setMenuOpen(false)}
              >
                <Icon name={route.icon as IconName} />
                {route.title}
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            {settingRoute ? (
              <NavLink
                to={settingRoute.path}
                data-route={settingRoute.key}
                className={({ isActive }) => (isActive ? "active" : undefined)}
                onClick={() => setMenuOpen(false)}
              >
                <Icon name="settings" />
                Ayarlar
              </NavLink>
            ) : null}
            <button className="sidebar-logout" id="sidebar-logout" type="button" onClick={() => void onLogout()}>
              Çıkış yap
            </button>
            <div className="profile">
              <span className="avatar" id="profile-avatar">{profileInitials}</span>
              <span>
                <strong id="profile-name">{user.displayName || "DefterX"}</strong>
                <small id="profile-email">{user.email}</small>
              </span>
            </div>
          </div>
        </aside>

        <main className="workspace">
          <header className="topbar">
            <IconButton aria-label="Menüyü aç" className="mobile-menu" id="mobile-menu" onClick={() => setMenuOpen((open) => !open)}>
              <Icon name="menu" />
            </IconButton>
            <div>
              <p className="eyebrow" id="page-eyebrow">
                {apiStatus?.online ? "Canlı finans alanı" : "Bağlantı kontrol ediliyor"}
              </p>
              <h1 id="page-title">{current.title}</h1>
            </div>
            <div className="top-actions">
              <IconButton aria-label="Yenile" id="sync-button" loading={busy} onClick={() => void onSync()}>
                <Icon name="sync" />
              </IconButton>
              <Button variant="primary" data-open-entry onClick={onNewTransaction}>
                <Icon name="plus" />
                Yeni işlem
              </Button>
            </div>
          </header>
          <div id="app-loading" className="loading-state" hidden={!busy} role="status" aria-live="polite">
            Canlı veriler yükleniyor…
          </div>
          <div id="app-content" tabIndex={-1}>{children}</div>
        </main>
      </div>

      <Button className="mobile-fab" variant="primary" data-open-entry aria-label="Yeni işlem" onClick={onNewTransaction}>
        <Icon name="plus" />
      </Button>
      {transactionDialog}
    </>
  );
}
