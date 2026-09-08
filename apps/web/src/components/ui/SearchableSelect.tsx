import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export interface SearchableOption {
  value: string;
  label: string;
  /** Secondary text shown after the label and included in the search. */
  hint?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  options: readonly SearchableOption[];
  /** Renders a hidden input so `new FormData(form)` keeps seeing the value. */
  name?: string;
  /** Controlled value. */
  value?: string;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Fires on every keystroke in the search box — wire this for live/server search. */
  onSearchChange?: (query: string) => void;
  disabled?: boolean;
  required?: boolean;
  /** Shown when nothing is selected (like the empty `<option>`). */
  placeholder?: string;
  emptyMessage?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

interface MenuAnchor {
  top: number;
  left: number;
  width: number;
}

function normalize(text: string): string {
  return text.toLocaleLowerCase("tr").trim();
}

/**
 * Editable-combobox replacement for a native `<select>` on long option lists.
 * The single visible `<input role="combobox">` both shows the selection and
 * filters the list, so a wrapping `<label>` keeps naming it for assistive tech.
 * The menu renders in a portal so it never widens or is clipped by its dialog.
 */
export function SearchableSelect({
  options,
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  onSearchChange,
  disabled = false,
  required = false,
  placeholder = "Seçin",
  emptyMessage = "Sonuç yok",
  id,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: SearchableSelectProps) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const value = isControlled ? controlledValue : internalValue;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  /** The menu portals into its own `<dialog>` (to stay in the top layer) or `<body>`. */
  const [menuHost, setMenuHost] = useState<Element | null>(null);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLUListElement | null>(null);
  /**
   * Selecting an option lives inside the field's `<label>`, so the browser
   * forwards a second click to the input right after — this ref swallows that
   * echo so the menu does not immediately reopen.
   */
  const reopenGuardRef = useRef(false);
  const listboxId = useId();
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const visibleOptions = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter((option) =>
      normalize(`${option.label} ${option.hint ?? ""}`).includes(q),
    );
  }, [options, query]);

  const measure = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (rect) setAnchor({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);

  const commit = useCallback(
    (next: string) => {
      if (!isControlled) setInternalValue(next);
      onChange?.(next);
      setOpen(false);
      setQuery("");
      reopenGuardRef.current = true;
      window.setTimeout(() => {
        reopenGuardRef.current = false;
      }, 0);
    },
    [isControlled, onChange],
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const openMenu = useCallback(() => {
    if (disabled || open || reopenGuardRef.current) return;
    measure();
    setQuery("");
    const selectedIndex = options.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }, [disabled, open, measure, options, value]);

  const isInside = useCallback((node: EventTarget | null) => {
    if (!(node instanceof Node)) return false;
    return Boolean(wrapperRef.current?.contains(node) || menuRef.current?.contains(node));
  }, []);

  // Clamp so a shrunken filtered list never highlights a missing row.
  const clampedActiveIndex = Math.min(activeIndex, Math.max(0, visibleOptions.length - 1));

  useLayoutEffect(() => {
    if (!open) return;
    setMenuHost(wrapperRef.current?.closest("dialog") ?? document.body);
    measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: MouseEvent) => {
      if (!isInside(event.target)) close();
    };
    const reposition = () => measure();
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, close, isInside, measure]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) openMenu();
        else setActiveIndex(Math.min(visibleOptions.length - 1, clampedActiveIndex + 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        if (!open) openMenu();
        else setActiveIndex(Math.max(0, clampedActiveIndex - 1));
        return;
      case "Enter": {
        if (!open) return;
        event.preventDefault();
        const option = visibleOptions[clampedActiveIndex];
        if (option && !option.disabled) commit(option.value);
        return;
      }
      case "Escape":
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
        return;
      case "Tab":
        if (open) close();
        return;
      default:
        return;
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setQuery(next);
    setActiveIndex(0);
    if (!open) {
      measure();
      setOpen(true);
    }
    onSearchChange?.(next);
  };

  const handleBlur = (event: ReactFocusEvent<HTMLInputElement>) => {
    if (isInside(event.relatedTarget)) return;
    close();
  };

  const activeDescendant =
    open && visibleOptions[clampedActiveIndex]
      ? `${listboxId}-${clampedActiveIndex}`
      : undefined;

  return (
    <div
      ref={wrapperRef}
      className={["searchable-select", className].filter(Boolean).join(" ")}
      data-open={open || undefined}
    >
      <input
        id={fieldId}
        className="searchable-select-input"
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-required={required || undefined}
        aria-activedescendant={activeDescendant}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        disabled={disabled}
        placeholder={selectedOption ? selectedOption.label : placeholder}
        value={open ? query : selectedOption?.label ?? ""}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={openMenu}
        onClick={openMenu}
        onBlur={handleBlur}
      />
      {name ? <input type="hidden" name={name} value={value} /> : null}
      {open && menuHost
        ? createPortal(
            <ul
              ref={menuRef}
              className="searchable-select-menu"
              id={listboxId}
              role="listbox"
              style={
                anchor
                  ? { position: "fixed", top: anchor.top, left: anchor.left, width: anchor.width }
                  : undefined
              }
              onMouseDown={(event) => event.preventDefault()}
            >
              {visibleOptions.length === 0 ? (
                <li className="searchable-select-empty">{emptyMessage}</li>
              ) : (
                visibleOptions.map((option, index) => (
                  <li
                    key={option.value}
                    id={`${listboxId}-${index}`}
                    role="option"
                    aria-selected={option.value === value}
                    aria-disabled={option.disabled || undefined}
                    className={[
                      "searchable-select-option",
                      index === clampedActiveIndex ? "is-active" : "",
                      option.disabled ? "is-disabled" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      if (!option.disabled) commit(option.value);
                    }}
                  >
                    <span className="searchable-select-option-label">{option.label}</span>
                    {option.hint ? (
                      <span className="searchable-select-option-hint">{option.hint}</span>
                    ) : null}
                  </li>
                ))
              )}
            </ul>,
            menuHost,
          )
        : null}
    </div>
  );
}
