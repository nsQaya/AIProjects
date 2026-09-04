import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AccountShareDTO } from "@defterx/contracts";

import { AccountShareDialog } from "./AccountShareDialog";

const existingShare: AccountShareDTO = {
  id: "share-1",
  accountId: "account-1",
  granteeUserId: "user-2",
  granteeEmail: "ortak@example.com",
  granteeDisplayName: "Ortak Kişi",
  permission: "VIEW",
  status: "ACTIVE",
  version: 1,
};

function sharingApi(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    listShares: vi.fn(() => Promise.resolve([existingShare] as readonly AccountShareDTO[])),
    shareAccount: vi.fn(() => Promise.resolve(undefined)),
    updateShare: vi.fn(() => Promise.resolve(undefined)),
    revokeShare: vi.fn(() => Promise.resolve(undefined)),
    ...overrides,
  };
}

describe("AccountShareDialog", () => {
  it("lists current grantees and shares with a new user by email", async () => {
    const user = userEvent.setup();
    const sharing = sharingApi();
    render(
      <AccountShareDialog
        account={{ id: "account-1", name: "Ortak Banka" }}
        sharing={sharing}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("Ortak Kişi")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Kişi e-postası"), "yeni@example.com");
    await user.selectOptions(screen.getByLabelText("Yetki"), "OPERATE");
    await user.click(screen.getByRole("button", { name: "Paylaş" }));

    await waitFor(() => {
      expect(sharing.shareAccount).toHaveBeenCalledWith("account-1", {
        email: "yeni@example.com",
        permission: "OPERATE",
      });
    });
    // Reloads the list after a successful mutation.
    expect(sharing.listShares).toHaveBeenCalledTimes(2);
  });

  it("changes a grantee's permission and revokes a share", async () => {
    const user = userEvent.setup();
    const sharing = sharingApi();
    render(
      <AccountShareDialog
        account={{ id: "account-1", name: "Ortak Banka" }}
        sharing={sharing}
        onClose={vi.fn()}
      />,
    );

    const row = (await screen.findByText("Ortak Kişi")).closest("li") as HTMLElement;
    await user.selectOptions(within(row).getByRole("combobox"), "OPERATE");
    await waitFor(() => {
      expect(sharing.updateShare).toHaveBeenCalledWith("account-1", "share-1", {
        permission: "OPERATE",
        version: 1,
      });
    });

    await user.click(within(row).getByRole("button", { name: "Kaldır" }));
    await waitFor(() => {
      expect(sharing.revokeShare).toHaveBeenCalledWith("account-1", "share-1");
    });
  });
});
