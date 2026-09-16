import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchableSelect, type SearchableOption } from "./SearchableSelect";

const options: readonly SearchableOption[] = [
  { value: "tr", label: "Türk Lirası", hint: "TRY" },
  { value: "us", label: "ABD Doları", hint: "USD" },
  { value: "eu", label: "Euro", hint: "EUR" },
];

function Harness({
  onChange = vi.fn(),
  onSearchChange,
}: {
  onChange?: (value: string) => void;
  onSearchChange?: (query: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <label>
      <span>Para birimi</span>
      <SearchableSelect
        name="currency"
        value={value}
        placeholder="Para birimi seçin"
        options={options}
        onSearchChange={onSearchChange}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    </label>
  );
}

/**
 * `menuTrigger="manual"` means focusing or typing into the field never opens
 * it by itself — only this toggle button (or ArrowDown/ArrowUp) does. See
 * the component's own comment for why: react-aria's open-on-focus/open-on-
 * type reflexes drive an internal "reopen if still focused and the text
 * changed" effect that a plain mouse/touch selection doesn't fully settle
 * before closing, so the menu would pop right back open after every pick.
 */
function openMenu(user: ReturnType<typeof userEvent.setup>) {
  return user.click(screen.getByRole("button", { name: "Seçenekleri göster" }));
}

describe("SearchableSelect", () => {
  it("opens via the toggle button and selects an option with the mouse", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const combobox = screen.getByLabelText("Para birimi");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await openMenu(user);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /ABD Doları/ }));

    expect(onChange).toHaveBeenCalledWith("us");
    expect(combobox).toHaveValue("ABD Doları");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("filters the list as the user types", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await openMenu(user);
    await user.type(screen.getByLabelText("Para birimi"), "eur");

    const list = screen.getByRole("listbox");
    expect(within(list).getAllByRole("option")).toHaveLength(1);
    expect(within(list).getByRole("option", { name: /Euro/ })).toBeInTheDocument();
  });

  it("selects the highlighted option with the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const combobox = screen.getByLabelText("Para birimi");
    await openMenu(user);
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("eu");
    expect(combobox).toHaveValue("Euro");
  });

  it("exposes the selected value through a hidden input for FormData", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await openMenu(user);
    await user.click(screen.getByRole("option", { name: /Türk Lirası/ }));

    expect(container.querySelector('input[name="currency"]')).toHaveValue("tr");
  });

  it("closes on an outside click without changing the value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <Harness onChange={onChange} />
        <button type="button">dışarısı</button>
      </>,
    );
    // Grabbed before the combobox opens: react-aria correctly hides the rest
    // of the page from assistive tech while suggestions are showing (an
    // aria-hidden-only hide, not `inert` — a real tap still reaches it fine),
    // so an accessible-name lookup for it wouldn't find it once open.
    const outsideButton = screen.getByRole("button", { name: "dışarısı" });

    await openMenu(user);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.click(outsideButton);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("never moves real DOM focus off the input while browsing options", async () => {
    // The hand-rolled version of this component this replaced kept failing
    // on mobile Safari because the input actually blurred (with a null
    // `relatedTarget`, as iOS reports it) the instant a tap landed on an
    // option, closing the menu and unmounting the option before its own
    // click could commit. react-aria-components' ListBox uses "virtual
    // focus" for its options instead: they're never real DOM focus targets
    // (`aria-activedescendant` tracks the highlighted one), so a tap on one
    // never blurs the input in the first place — this is what actually
    // closes off that whole bug class, rather than racing to out-guess it.
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const combobox = screen.getByLabelText("Para birimi");
    await openMenu(user);
    expect(combobox).toHaveFocus();

    const option = screen.getByRole("option", { name: /Euro/ });
    fireEvent.pointerDown(option);
    expect(combobox).toHaveFocus(); // still focused: nothing to blur away from

    await user.click(option);

    expect(onChange).toHaveBeenCalledWith("eu");
    expect(combobox).toHaveValue("Euro");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("reopens via the toggle button after selecting an option", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await openMenu(user);
    await user.click(screen.getByRole("option", { name: /Euro/ }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await openMenu(user);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("shows every option again on reopen, ignoring whatever was typed before", async () => {
    // The toggle button always opens with react-aria's "manual" trigger
    // reason, which is what makes it show the full list regardless of a
    // stale filter — the same thing tapping a native <select> guarantees.
    const user = userEvent.setup();
    render(<Harness />);

    await openMenu(user);
    await user.type(screen.getByLabelText("Para birimi"), "eur");
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(1);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await openMenu(user);
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(3);
  });

  it("reports every keystroke through onSearchChange", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<Harness onSearchChange={onSearchChange} />);

    await openMenu(user);
    await user.type(screen.getByLabelText("Para birimi"), "do");

    expect(onSearchChange).toHaveBeenLastCalledWith("do");
  });
});
