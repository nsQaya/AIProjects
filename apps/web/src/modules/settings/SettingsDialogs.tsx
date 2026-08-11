import { useState, type FormEvent } from "react";
import type {
  CategoryDTO,
  CostCenterDTO,
  InvestmentAssetTypeDTO,
  InvestmentInstrumentDTO,
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
import { decimalString } from "../../lib/format";
import type {
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

interface InstrumentDialogProps extends MutationDialogProps<SaveInstrumentInput> {
  instrument: InvestmentInstrumentDTO | null;
  investmentTypes: readonly InvestmentAssetTypeDTO[];
}

export function InstrumentDialog({
  instrument,
  investmentTypes,
  onClose,
  onSave,
}: InstrumentDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectableTypes = investmentTypes.filter(
    (item) => item.isActive || item.id === instrument?.assetTypeId,
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const symbol = formString(values, "symbol").trim();
    const common = {
      assetTypeId: formString(values, "assetTypeId"),
      name: formString(values, "name").trim(),
      symbol: symbol || null,
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
              maxLength={30}
              defaultValue={instrument?.symbol ?? ""}
              disabled={busy}
            />
          </label>
          <label className="full-field">
            <span>Ad</span>
            <input
              name="name"
              maxLength={120}
              defaultValue={instrument?.name ?? ""}
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
