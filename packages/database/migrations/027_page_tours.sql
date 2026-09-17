-- Sayfa turları: ana menü turundan (onboarding_completed_at) ayrı olarak, her
-- sayfaya ilk girişte o sayfaya özel içerik turunun gösterilip gösterilmediğini
-- izler. Sayfa anahtarları (örn. "transactions", "reports") API tarafında
-- sabit bir listeye karşı doğrulanır.
ALTER TABLE users ADD COLUMN onboarding_pages_completed TEXT[] NOT NULL DEFAULT '{}';
