import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
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

describe("SearchableSelect", () => {
  it("opens on click and selects an option with the mouse", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const combobox = screen.getByLabelText("Para birimi");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.click(combobox);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /ABD Doları/ }));

    expect(onChange).toHaveBeenCalledWith("us");
    expect(combobox).toHaveValue("ABD Doları");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("filters the list as the user types", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByLabelText("Para birimi"));
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
    await user.click(combobox);
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("eu");
    expect(combobox).toHaveValue("Euro");
  });

  it("exposes the selected value through a hidden input for FormData", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.click(screen.getByLabelText("Para birimi"));
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

    await user.click(screen.getByLabelText("Para birimi"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "dışarısı" }));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports every keystroke through onSearchChange", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<Harness onSearchChange={onSearchChange} />);

    await user.click(screen.getByLabelText("Para birimi"));
    await user.type(screen.getByLabelText("Para birimi"), "do");

    expect(onSearchChange).toHaveBeenLastCalledWith("do");
  });
});
