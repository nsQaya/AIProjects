-- Ürün turu: bir kullanıcı turu tamamlayana (veya kapatana) kadar NULL kalır,
-- ilk girişte web uygulaması menüleri tanıtan bir tur gösterir.
ALTER TABLE users ADD COLUMN onboarding_completed_at TIMESTAMPTZ;
