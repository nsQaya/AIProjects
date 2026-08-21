import { useEffect, useState, type FormEvent } from "react";
import type {
  AccountTypeDTO,
  CategoryDTO,
  CostCenterDTO,
  CurrencyDTO,
  InvestmentAssetTypeDTO,
  InvestmentInstrumentDTO,
  MarketSymbolDTO,
} from "@defterx/contracts";

import {
  Button,
  Dialog,
  DialogActions,
  DialogCancelButton,
  DialogFeedback,
  DialogHeader,
} from "../../components/ui";
import { isoAtLocalNoon, today } from "../../lib/date";
import { errorMessage } from "../../lib/error-message";
import { decimalString } from "../../lib/format";
import type {
  SaveAccountTypeInput,
  SaveCategoryInput,
  SaveCostCenterInput,
  SaveInstrumentInput,
  SaveInstrumentPriceInput,
  SaveInvestmentTypeInput,
} from "./settings-types";

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "İşlem tamamlanamadı.";
}

function formString(values: FormData, name: string): string {
  const value = values.get(name);
  return typeof value === "string" ? value : "";
}

interface MutationDialogProps<T> {
  onClose: () => void;
  onSave: (input: T) => Promise<void>;
}

interface PasswordChangeDialogProps {
  onClose: () => void;
  onSave: (input: { currentPassword: string; newPassword: string }) => Promise<void>;
}

export function PasswordChangeDialog({ onClose, onSave }: PasswordChangeDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const currentPassword = formString(values, "currentPassword");
    const newPassword = formString(values, "newPassword");

    if (newPassword !== formString(values, "newPasswordConfirmation")) {
      setError("Yeni şifre ve tekrarı eşleşmiyor.");
      return;
    }

    setError(null);
    setBusy(true);
    void onSave({ currentPassword, newPassword })
      .then(onClose)
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog
      id="password-change-dialog"
      className="compact-dialog"
      dismissible={!busy}
      open
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} aria-busy={busy || undefined}>
        <DialogHeader eyebrow="Profil güvenliği" title="Şifreyi değiştir">
          <p>Mevcut şifrenizi doğrulayarak yeni bir şifre belirleyin.</p>
        </DialogHeader>
        <div className="form-grid dialog-form-grid">
          <label className="full-field">
            <span>Mevcut şifre</span>
            <input
              name="currentPassword"
              type="password"
              maxLength={128}
              autoComplete="current-password"
              disabled={busy}
              required
            />
          </label>
          <label className="full-field">
            <span>Yeni şifre</span>
            <input
              name="newPassword"
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              disabled={busy}
              required
            />
          </label>
          <label className="full-field">
            <span>Yeni şifre tekrarı</span>
            <input
              name="newPasswordConfirmation"
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              disabled={busy}
              required
            />
          </label>
        </div>
        <DialogFeedback message={error} />
        <DialogActions>
          <DialogCancelButton disabled={busy}>Vazgeç</DialogCancelButton>
          <Button type="submit" variant="primary" loading={busy}>
            Şifreyi güncelle
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

interface CategoryDialogProps extends MutationDialogProps<SaveCategoryInput> {
  category: CategoryDTO | null;
}

export function CategoryDialog({ category, onClose, onSave }: CategoryDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = formString(values, "name").trim();
    const sortOrder = Number(formString(values, "sortOrder")) || 0;
    const input: SaveCategoryInput = category
      ? {
          mode: "update",
          id: category.id,
          name,
          sortOrder,
          version: category.version,
        }
      : {
          mode: "create",
          categoryType: formString(values, "categoryType") === "INCOME" ? "INCOME" : "EXPENSE",
          name,
          sortOrder,
        };

    setError(null);
    setBusy(true);
    void onSave(input)
      .then(onClose)
      .catch((reason: unknown) => setError(mutationErrorMessage(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog
      id="category-dialog"
      className="compact-dialog"
      open
      onClose={onClose}
    >
      <form id="category-form" onSubmit={handleSubmit} aria-busy={busy || undefined}>
        <input type="hidden" name="categoryId" value={category?.id ?? ""} />
        <input type="hidden" name="version" value={category?.version ?? ""} />
        <DialogHeader eyebrow="Ayarlar" title="Kategori" />
        <div className="form-grid dialog-form-grid">
          <label className="full-field">
            <span>Ad</span>
            <input
              name="name"
              maxLength={120}
              defaultValue={category?.name ?? ""}
              disabled={busy}
              required
            />
          </label>
          <label>
            <span>Tür</span>
            <select
              name="categoryType"
              defaultValue={category?.categoryType ?? "EXPENSE"}
              disabled={busy || category !== null}
            >
              <option value="EXPENSE">Gider</option>
              <option value="INCOME">Gelir</option>
            </select>
          </label>
          <label>
            <span>Sıra</span>
            <input
              name="sortOrder"
              type="number"
              defaultValue={category?.sortOrder ?? 0}
              disabled={busy}
            />
          </label>
        </div>
        <DialogFeedback message={error} />
        <DialogActions>
          <DialogCancelButton disabled={busy}>Vazgeç</DialogCancelButton>
          <Button type="submit" variant="primary" loading={busy}>
            Kaydet
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

interface CostCenterDialogProps extends MutationDialogProps<SaveCostCenterInput> {
  costCenter: CostCenterDTO | null;
}

export function CostCenterDialog({ costCenter, onClose, onSave }: CostCenterDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const description = formString(values, "description").trim();
    const common = {
      name: formString(values, "name").trim(),
      description: description || null,
      sortOrder: Number(formString(values, "sortOrder")) || 0,
    };
    const input: SaveCostCenterInput = costCenter
      ? {
          mode: "update",
          id: costCenter.id,
          version: costCenter.version,
          ...common,
        }
      : { mode: "create", ...common };

    setError(null);
    setBusy(true);
    void onSave(input)
      .then(onClose)
      .catch((reason: unknown) => setError(mutationErrorMessage(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog id="cost-center-dialog" className="compact-dialog" open onClose={onClose}>
      <form id="cost-center-form" onSubmit={handleSubmit} aria-busy={busy || undefined}>
        <input type="hidden" name="costCenterId" value={costCenter?.id ?? ""} />
        <input type="hidden" name="version" value={costCenter?.version ?? ""} />
        <DialogHeader eyebrow="İşlem kırılımı" title="Masraf merkezi" />
        <div className="form-grid dialog-form-grid">
          <label className="full-field">
            <span>Ad</span>
            <input
              name="name"
              maxLength={120}
              defaultValue={costCenter?.name ?? ""}
              disabled={busy}
              placeholder="Örn. Aile arabası, Anne, Baba"
              required
            />
          </label>
          <label className="full-field">
            <span>Açıklama</span>
            <input
              name="description"
              maxLength={300}
              defaultValue={costCenter?.description ?? ""}
              disabled={busy}
              placeholder="İsteğe bağlı"
            />
          </label>
          <label>
            <span>Sıra</span>
            <input
              name="sortOrder"
              type="number"
              defaultValue={costCenter?.sortOrder ?? 0}
              disabled={busy}
            />
          </label>
        </div>
        <DialogFeedback message={error} />
        <DialogActions>
          <DialogCancelButton disabled={busy}>Vazgeç</DialogCancelButton>
          <Button type="submit" variant="primary" loading={busy}>
            Kaydet
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

interface InvestmentTypeDialogProps extends MutationDialogProps<SaveInvestmentTypeInput> {
  investmentType: InvestmentAssetTypeDTO | null;
}

export function InvestmentTypeDialog({
  investmentType,
  onClose,
  onSave,
}: InvestmentTypeDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = formString(values, "name").trim();
    const sortOrder = Number(formString(values, "sortOrder")) || 0;
    const input: SaveInvestmentTypeInput = investmentType
      ? {
          mode: "update",
          id: investmentType.id,
          name,
          sortOrder,
          version: investmentType.version,
        }
      : { mode: "create", name, sortOrder };

    setError(null);
    setBusy(true);
    void onSave(input)
      .then(onClose)
      .catch((reason: unknown) => setError(mutationErrorMessage(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog
      id="asset-type-dialog"
      className="compact-dialog"
      open
      onClose={onClose}
    >
      <form id="asset-type-form" onSubmit={handleSubmit} aria-busy={busy || undefined}>
        <input type="hidden" name="assetTypeId" value={investmentType?.id ?? ""} />
        <input type="hidden" name="version" value={investmentType?.version ?? ""} />
        <DialogHeader eyebrow="Birikim ayarı" title="Varlık türü" />
        <div className="form-grid dialog-form-grid">
          <label className="full-field">
            <span>Tür adı</span>
            <input
              name="name"
              maxLength={80}
              defaultValue={investmentType?.name ?? ""}
              disabled={busy}
              required
            />
          </label>
          <label>
            <span>Sıra</span>
            <input
              name="sortOrder"
              type="number"
              defaultValue={investmentType?.sortOrder ?? 0}
              disabled={busy}
            />
          </label>
        </div>
        <DialogFeedback message={error} />
        <DialogActions>
          <DialogCancelButton disabled={busy}>Vazgeç</DialogCancelButton>
          <Button type="submit" variant="primary" loading={busy}>
            Kaydet
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

interface AccountTypeDialogProps extends MutationDialogProps<SaveAccountTypeInput> {
  accountType: AccountTypeDTO | null;
}

export function AccountTypeDialog({
  accountType,
  onClose,
  onSave,
}: AccountTypeDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const balanceLocked = accountType?.purpose != null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = formString(values, "name").trim();
    const normalBalance = (balanceLocked
      ? accountType?.normalBalance
      : formString(values, "normalBalance")) as "DEBIT" | "CREDIT";
    const defaultAllowNegativeBalance = values.has("defaultAllowNegativeBalance");
    const sortOrder = Number(formString(values, "sortOrder")) || 0;
    const input: SaveAccountTypeInput = accountType
      ? {
          mode: "update",
          id: accountType.id,
          name,
          normalBalance,
          defaultAllowNegativeBalance,
          sortOrder,
          version: accountType.version,
        }
      : { mode: "create", name, normalBalance, defaultAllowNegativeBalance, sortOrder };

    setError(null);
    setBusy(true);
    void onSave(input)
      .then(onClose)
      .catch((reason: unknown) => setError(mutationErrorMessage(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog
      id="account-type-dialog"
      className="compact-dialog"
      open
      onClose={onClose}
    >
      <form id="account-type-form" onSubmit={handleSubmit} aria-busy={busy || undefined}>
        <input type="hidden" name="accountTypeId" value={accountType?.id ?? ""} />
        <input type="hidden" name="version" value={accountType?.version ?? ""} />
        <DialogHeader eyebrow="Hesap ayarı" title="Hesap türü" />
        <div className="form-grid dialog-form-grid">
          <label className="full-field">
            <span>Tür adı</span>
            <input
              name="name"
              maxLength={80}
              defaultValue={accountType?.name ?? ""}
              disabled={busy}
              required
            />
          </label>
          <label>
            <span>Bakiye yönü</span>
            <select
              name="normalBalance"
              defaultValue={accountType?.normalBalance ?? "DEBIT"}
              disabled={busy || balanceLocked}
            >
              <option value="DEBIT">Borç (varlık)</option>
              <option value="CREDIT">Alacak (borç/kaynak)</option>
            </select>
          </label>
          <label className="checkbox-field full-field">
            <input
              name="defaultAllowNegativeBalance"
              type="checkbox"
              defaultChecked={accountType?.defaultAllowNegativeBalance ?? false}
              disabled={busy}
            />
            <span>Yeni hesaplarda eksi bakiyeye varsayılan olarak izin ver</span>
          </label>
          <label>
            <span>Sıra</span>
            <input
              name="sortOrder"
              type="number"
              defaultValue={accountType?.sortOrder ?? 0}
              disabled={busy}
            />
          </label>
        </div>
        {balanceLocked ? (
          <p style={{ color: "var(--muted)", fontSize: 11 }}>
            Bu tür sistem tarafından kullanılıyor; bakiye yönü değiştirilemez.
          </p>
        ) : null}
        <DialogFeedback message={error} />
        <DialogActions>
          <DialogCancelButton disabled={busy}>Vazgeç</DialogCancelButton>
          <Button type="submit" variant="primary" loading={busy}>
            Kaydet
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

interface InstrumentDialogProps extends MutationDialogProps<SaveInstrumentInput> {
  currencies: readonly CurrencyDTO[];
  instrument: InvestmentInstrumentDTO | null;
  investmentTypes: readonly InvestmentAssetTypeDTO[];
  onSearchMarketSymbols: (query:string,market?:"BIST"|"US")=>Promise<readonly MarketSymbolDTO[]>;
}

export function InstrumentDialog({
  currencies,
  instrument,
  investmentTypes,
  onSearchMarketSymbols,
  onClose,
  onSave,
}: InstrumentDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [market,setMarket]=useState<""|"BIST"|"US">(instrument?.providerSymbol?.endsWith(".IS")?"BIST":instrument?.marketSymbolId?"US":"");
  const [marketQuery,setMarketQuery]=useState(instrument?.providerSymbol??"");
  const [marketSymbols,setMarketSymbols]=useState<readonly MarketSymbolDTO[]>([]);
  const [marketSymbolId,setMarketSymbolId]=useState(instrument?.marketSymbolId??"");
  const [symbol,setSymbol]=useState(instrument?.symbol??"");
  const [name,setName]=useState(instrument?.name??"");
  const [currencyCode,setCurrencyCode]=useState(instrument?.currencyCode??"TRY");
  const selectableTypes = investmentTypes.filter(
    (item) => item.isActive || item.id === instrument?.assetTypeId,
  );
  const selectableCurrencies = currencies.filter(
    (item) => item.isEnabled || item.code === instrument?.currencyCode,
  );

  useEffect(()=>{
    let active=true;
    const timer=window.setTimeout(()=>{
      void onSearchMarketSymbols(marketQuery,market||undefined)
        .then(items=>{if(active)setMarketSymbols(items);})
        .catch(reason=>{if(active)setError(mutationErrorMessage(reason));});
    },250);
    return()=>{active=false;window.clearTimeout(timer);};
  },[market,marketQuery,onSearchMarketSymbols]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const symbol = formString(values, "symbol").trim();
    const common = {
      assetTypeId: formString(values, "assetTypeId"),
      name: formString(values, "name").trim(),
      symbol: symbol || null,
      marketSymbolId: formString(values,"marketSymbolId")||null,
      currencyCode: formString(values,"currencyCode")||"TRY",
    };
    const input: SaveInstrumentInput = instrument
      ? {
          mode: "update",
          id: instrument.id,
          version: instrument.version,
          ...common,
        }
      : { mode: "create", ...common };

    setError(null);
    setBusy(true);
    void onSave(input)
      .then(onClose)
      .catch((reason: unknown) => setError(mutationErrorMessage(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog
      id="instrument-dialog"
      className="compact-dialog"
      open
      onClose={onClose}
    >
      <form id="instrument-form" onSubmit={handleSubmit} aria-busy={busy || undefined}>
        <input type="hidden" name="instrumentId" value={instrument?.id ?? ""} />
        <input type="hidden" name="version" value={instrument?.version ?? ""} />
        <DialogHeader eyebrow="Birikim ayarı" title="Yatırım aracı" />
        <div className="form-grid dialog-form-grid">
          <label>
            <span>Tür</span>
            <select
              name="assetTypeId"
              defaultValue={instrument?.assetTypeId ?? ""}
              disabled={busy}
              required
            >
              <option value="">Tür seçin</option>
              {selectableTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Sembol</span>
            <input
              name="symbol"
              maxLength={40}
              value={symbol}
              onChange={event=>setSymbol(event.target.value.toUpperCase())}
              readOnly={Boolean(marketSymbolId)}
              disabled={busy}
            />
          </label>
          <label>
            <span>Para birimi</span>
            <select
              name="currencyCode"
              value={currencyCode}
              disabled={busy||Boolean(marketSymbolId)}
              onChange={event=>setCurrencyCode(event.target.value)}
            >
              {selectableCurrencies.map(item=>(
                <option key={item.code} value={item.code}>{item.code} · {item.nameTr}</option>
              ))}
            </select>
            {marketSymbolId
              ? <small>Yahoo Finance koduna bağlı araçlarda para birimi otomatik belirlenir.</small>
              : selectableCurrencies.length<=1
                ? <small>Dolar, euro gibi başka para birimi eklemek için Ayarlar'daki Para Birimleri bölümünü kullanın.</small>
                : null}
          </label>
          <label>
            <span>Piyasa</span>
            <select value={market} disabled={busy} onChange={event=>{
              setMarket(event.target.value as ""|"BIST"|"US");
              setMarketSymbolId("");
            }}>
              <option value="">Tümü</option>
              <option value="BIST">Borsa İstanbul</option>
              <option value="US">ABD borsaları</option>
            </select>
          </label>
          <label className="full-field">
            <span>Borsa kodu ara</span>
            <input
              value={marketQuery}
              onChange={event=>setMarketQuery(event.target.value)}
              placeholder="Örn. THYAO, AAPL veya fon adı"
              disabled={busy}
            />
          </label>
          <label className="full-field">
            <span>Yahoo Finance kodu (otomatik fiyat)</span>
            <select
              name="marketSymbolId"
              value={marketSymbolId}
              disabled={busy}
              onChange={event=>{
                const id=event.target.value;
                setMarketSymbolId(id);
                const selected=marketSymbols.find(item=>item.id===id);
                if(selected){setSymbol(selected.providerSymbol);setName(selected.name);}
              }}
            >
              <option value="">Otomatik fiyat kullanma</option>
              {instrument?.marketSymbolId&&!marketSymbols.some(item=>item.id===instrument.marketSymbolId)?(
                <option value={instrument.marketSymbolId}>{instrument.providerSymbol??instrument.symbol} · {instrument.name}</option>
              ):null}
              {marketSymbols.map(item=>(
                <option key={item.id} value={item.id}>
                  {item.providerSymbol} · {item.name} · {item.exchangeCode}
                </option>
              ))}
            </select>
            <small>Kod seçildiğinde kapanış fiyatları günlük olarak otomatik güncellenir.</small>
          </label>
          <label className="full-field">
            <span>Ad</span>
            <input
              name="name"
              maxLength={120}
              value={name}
              onChange={event=>setName(event.target.value)}
              disabled={busy}
              required
            />
          </label>
        </div>
        <DialogFeedback message={error} />
        <DialogActions>
          <DialogCancelButton disabled={busy}>Vazgeç</DialogCancelButton>
          <Button type="submit" variant="primary" loading={busy}>
            Kaydet
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

interface InstrumentPriceDialogProps extends MutationDialogProps<SaveInstrumentPriceInput> {
  instrument: InvestmentInstrumentDTO;
}

export function InstrumentPriceDialog({
  instrument,
  onClose,
  onSave,
}: InstrumentPriceDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const price = decimalString(formString(values, "price"));
    if (price === null) {
      setError("Sıfırdan büyük bir fiyat girin.");
      return;
    }

    const input: SaveInstrumentPriceInput = {
      instrumentId: instrument.id,
      price,
      pricedAt: isoAtLocalNoon(formString(values, "pricedAt")),
    };

    setError(null);
    setBusy(true);
    void onSave(input)
      .then(onClose)
      .catch((reason: unknown) => setError(mutationErrorMessage(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog id="price-dialog" className="compact-dialog" open onClose={onClose}>
      <form id="price-form" onSubmit={handleSubmit} aria-busy={busy || undefined}>
        <input type="hidden" name="instrumentId" value={instrument.id} />
        <DialogHeader eyebrow="Güncel değer" title="Son fiyat gir">
          <p id="price-instrument-name">{instrument.name}</p>
        </DialogHeader>
        <div className="form-grid dialog-form-grid">
          <label>
            <span>Fiyat</span>
            <input name="price" inputMode="decimal" disabled={busy} required />
          </label>
          <label>
            <span>Fiyat tarihi</span>
            <input
              name="pricedAt"
              type="date"
              defaultValue={today()}
              disabled={busy}
              required
            />
          </label>
        </div>
        <DialogFeedback message={error} />
        <DialogActions>
          <DialogCancelButton disabled={busy}>Vazgeç</DialogCancelButton>
          <Button type="submit" variant="primary" loading={busy}>
            Kaydet
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
