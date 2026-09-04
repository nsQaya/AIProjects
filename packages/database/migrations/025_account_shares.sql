-- Hesap paylaşımı: bir hesabın sahibi, o hesabı başka bir kullanıcıyla iki yetki
-- seviyesinden biriyle paylaşabilir. Defter üyeliğinden (book_members) farkı,
-- paylaşımın tek tek hesap bazında olması ve alıcının yalnızca o hesaba erişmesidir.
--   VIEW    -> hesabı, bakiyesini ve hareketlerini salt-okunur görür
--   OPERATE -> ek olarak hesaba gelir/gider işlemi ekler, kendi eklediklerini geri alır
-- İşlemler hesabın SAHİBİNİN defterine yazılır; sync/iOS kapsam dışıdır.
CREATE TABLE account_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  book_id UUID NOT NULL REFERENCES books(id),
  grantee_user_id UUID NOT NULL REFERENCES users(id),
  granted_by_user_id UUID NOT NULL REFERENCES users(id),
  permission TEXT NOT NULL CHECK (permission IN ('VIEW','OPERATE')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX account_shares_unique
  ON account_shares(account_id, grantee_user_id) WHERE deleted_at IS NULL;
CREATE INDEX account_shares_grantee_idx
  ON account_shares(grantee_user_id) WHERE deleted_at IS NULL AND status = 'ACTIVE';
CREATE INDEX account_shares_account_idx
  ON account_shares(account_id) WHERE deleted_at IS NULL;
