import type { TourStep } from "./Tour";

// Selectors here target real, stable elements already in each page's JSX
// (verified against the current source, not guessed). A page render always
// completes before its PageTour can become active — the nav tour has to
// finish first, and by then the surrounding FinanceProvider snapshot is
// already "ready" — so these elements are present in the DOM by the time the
// tour's spotlight goes looking for them.

export const TRANSACTIONS_PAGE_TOUR: readonly TourStep[] = [
  {
    selector: ".transaction-filters",
    title: "Filtreler",
    body: "İşlemleri türüne, kategoriye, hesaba ve tarihe göre daraltabilirsiniz.",
  },
  {
    selector: "#all-transactions",
    title: "İşlem listesi",
    body: "Tüm gelir, gider ve transferleriniz burada listelenir.",
  },
  {
    selector: "#export-transactions",
    title: "Dışa aktarın",
    body: "Listeyi Excel veya PDF olarak indirebilirsiniz.",
  },
];

export const ACCOUNTS_PAGE_TOUR: readonly TourStep[] = [
  {
    selector: ".section-intro",
    title: "Net varlığınız",
    body: "Tüm hesaplarınızın toplam bakiyesini burada görürsünüz.",
  },
  {
    selector: "#open-account-dialog",
    title: "Hesap ekleyin",
    body: "Banka, kasa, kredi kartı gibi yeni bir hesap eklemek için buraya tıklayın.",
  },
  {
    selector: ".account-grid",
    title: "Hesaplarınız",
    body: "Tüm hesaplarınız kart olarak burada listelenir; bir karta tıklayarak detaylarını görebilirsiniz.",
  },
];

export const SAVINGS_PAGE_TOUR: readonly TourStep[] = [
  {
    selector: ".intro-actions",
    title: "Birikim işlemleri",
    body: "Döviz alım/satım, birikim alım/satım ve sermaye artırımı işlemlerini buradan başlatabilirsiniz.",
  },
  {
    selector: ".report-main-panel",
    title: "Portföy değeri",
    body: "Portföyünüzün zaman içindeki değişimini buradan izleyebilirsiniz.",
  },
  {
    selector: "#investment-lots-panel",
    title: "Alımlarınız",
    body: "Yaptığınız alımlar ve sermaye artışları burada listelenir.",
  },
];

export const UPCOMING_PAGE_TOUR: readonly TourStep[] = [
  {
    selector: ".upcoming-filters",
    title: "Filtreler",
    body: "Ödemeleri tarihe, türe ve duruma göre filtreleyebilirsiniz.",
  },
  {
    selector: "#open-scheduled-dialog",
    title: "Planlı işlem ekleyin",
    body: "Tekrarlayan veya ileri tarihli bir ödeme/tahsilat eklemek için buraya tıklayın.",
  },
  {
    selector: ".status-filter",
    title: "Durum sekmeleri",
    body: "Gerçekleşmemiş, gerçekleşmiş ya da tüm kayıtları buradan filtreleyebilirsiniz.",
  },
  {
    selector: ".schedule-list",
    title: "Yaklaşan liste",
    body: "Tüm planlı ödeme ve tahsilatlarınız burada listelenir.",
  },
];

export const REPORTS_PAGE_TOUR: readonly TourStep[] = [
  {
    selector: ".report-filter-panel",
    title: "Filtreler",
    body: "Tarih aralığını, hesapları ve zaman gruplamasını burada ayarlarsınız.",
  },
  {
    selector: ".report-tabs",
    title: "Rapor türleri",
    body: "Farklı rapor görünümleri arasında buradan geçiş yapabilirsiniz.",
  },
  {
    selector: ".report-metrics",
    title: "Özet rakamlar",
    body: "Seçili raporun özet değerleri burada gösterilir.",
  },
  {
    selector: ".report-main-panel",
    title: "Detaylı görünüm",
    body: "Seçili raporun grafiği veya tablosu burada yer alır.",
  },
];

export const SETTINGS_PAGE_TOUR: readonly TourStep[] = [
  {
    selector: ".settings-grid",
    title: "Hesap ve güvenlik",
    body: "Canlı ortam durumunuzu ve profil/güvenlik ayarlarınızı burada bulursunuz.",
  },
  {
    selector: "#settings-group-kategoriler",
    title: "Kategoriler",
    body: "Gelir ve gider kategorilerinizi buradan yönetirsiniz.",
  },
  {
    selector: "#settings-group-hesap-turleri",
    title: "Hesap türleri",
    body: "Hesaplarınız için kullanılan türleri buradan özelleştirebilirsiniz.",
  },
  {
    selector: "#settings-group-araclar",
    title: "Yatırım araçları",
    body: "Takip ettiğiniz yatırım araçlarını ve otomatik fiyat güncellemelerini buradan yönetirsiniz.",
  },
];
