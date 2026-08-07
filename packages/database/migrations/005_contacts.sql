CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id),
  contact_type TEXT NOT NULL CHECK (contact_type IN ('CUSTOMER', 'SUPPLIER', 'PERSON', 'EMPLOYEE', 'OTHER')),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  company_name TEXT,
  phone TEXT,
  email TEXT,
  tax_number TEXT,
  tax_office TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX contacts_book_idx ON contacts(book_id, name) WHERE deleted_at IS NULL;
ALTER TABLE accounts ADD CONSTRAINT accounts_contact_fk FOREIGN KEY(contact_id) REFERENCES contacts(id);

