import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

/**
 * Finds a {@link SearchableSelect}'s toggle button from its input (or accessible
 * name). The toggle, not the input, is what opens the menu — `SearchableSelect` sets
 * `menuTrigger="manual"` so focusing/typing never opens it implicitly (that reflex is
 * what caused the menu to reopen right after a mouse/touch selection). The button sits
 * right next to the input inside the same `.searchable-select` wrapper, and its
 * accessible name is shared by every field on the page, so it's found relative to this
 * one combobox rather than by role+name alone.
 */
function findComboboxToggle(field: string | HTMLElement): HTMLButtonElement {
  const combobox = typeof field === "string" ? screen.getByLabelText(field) : field;
  const toggle = combobox
    .closest(".searchable-select")
    ?.querySelector<HTMLButtonElement>(".searchable-select-toggle");
  if (!toggle) {
    throw new Error("SearchableSelect: couldn't find its toggle button");
  }
  return toggle;
}

/** Opens a {@link SearchableSelect}'s menu via its toggle button, without picking anything. */
export async function openCombobox(user: UserEvent, field: string | HTMLElement): Promise<void> {
  await user.click(findComboboxToggle(field));
}

/**
 * Picks an option from a {@link SearchableSelect} the way a user would: open it via
 * its toggle button, then click the matching option in the listbox. `field` is either
 * the accessible name (label text) or the combobox input element itself.
 */
export async function chooseComboboxOption(
  user: UserEvent,
  field: string | HTMLElement,
  optionName: string | RegExp,
): Promise<void> {
  await openCombobox(user, field);
  await user.click(await screen.findByRole("option", { name: optionName }));
}
