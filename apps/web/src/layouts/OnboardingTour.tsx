import { Tour, type TourStep } from "./Tour";

const NAV_TOUR_STEPS: readonly TourStep[] = [
  {
    selector: null,
    title: "DefterX'e hoş geldiniz",
    body: "Finans alanınızı birkaç adımda tanıtalım. İstediğiniz an turu kapatabilirsiniz.",
  },
  {
    selector: '[data-route="transactions"]',
    title: "İşlemler",
    body: "Gelir, gider ve transferlerinizi buradan girip listelersiniz.",
  },
  {
    selector: '[data-route="accounts"]',
    title: "Hesaplar",
    body: "Banka, kasa, kredi kartı gibi tüm hesaplarınızı buradan yönetirsiniz.",
  },
  {
    selector: '[data-route="savings"]',
    title: "Birikimler",
    body: "Yatırım araçlarınızı ve birikim hesaplarınızı buradan takip edersiniz.",
  },
  {
    selector: '[data-route="upcoming"]',
    title: "Yaklaşan",
    body: "Planlanan ve tekrarlayan işlemlerinizi buradan görürsünüz.",
  },
  {
    selector: '[data-route="reports"]',
    title: "Raporlar",
    body: "Gelir-gider analizlerinizi ve grafiklerinizi buradan inceleyebilirsiniz.",
  },
  {
    selector: '[data-route="settings"]',
    title: "Ayarlar",
    body: "Kategoriler, hesap türleri ve diğer tercihlerinizi buradan düzenlersiniz.",
  },
];

export interface OnboardingTourProps {
  active: boolean;
  onFinish: () => void;
}

/**
 * First-run product tour: a handful of steps spotlighting the main nav items,
 * dismissible at any point. Shown once per account (server-tracked via
 * `onboardingCompletedAt`), driven by the parent through `active`. Each nav
 * item also gets its own follow-up content tour once this one is done — see
 * PageTour.tsx.
 */
export function OnboardingTour({ active, onFinish }: OnboardingTourProps) {
  return <Tour active={active} steps={NAV_TOUR_STEPS} onFinish={onFinish} />;
}
