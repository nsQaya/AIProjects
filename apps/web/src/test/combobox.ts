import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

/**
 * Picks an option from a {@link SearchableSelect} the way a user would: focus the
 * combobox, then click the matching option in the listbox. `field` is either the
 * accessible name (label text) or the combobox element itself.
 */
export async function chooseComboboxOption(
  user: UserEvent,
  field: string | HTMLElement,
  optionName: string | RegExp,
): Promise<void> {
  const combobox =
    typeof field === "string" ? screen.getByLabelText(field) : field;
  await user.click(combobox);
  await user.click(await screen.findByRole("option", { name: optionName }));
}
