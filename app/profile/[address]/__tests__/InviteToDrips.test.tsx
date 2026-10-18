// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProfileView from "../ProfileView";

let mockConnectedPublicKey: string | null = null;

vi.mock("@/components/Navbar", () => ({
  default: () => null,
}));

vi.mock("@/lib/WalletContext", () => ({
  useWallet: () => ({ publicKey: mockConnectedPublicKey }),
}));

vi.mock("@/lib/stellar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stellar")>()),
  getGrantorScheduleIds: vi.fn().mockResolvedValue([]),
  getBeneficiaryScheduleIds: vi.fn().mockResolvedValue([]),
  getScheduleBatch: vi.fn().mockResolvedValue([]),
}));

describe("Invite to Drips Button (#1041)", () => {
  const targetAddress = "GBBBRECEIVER222222222222222222222222222222222222222222222";

  beforeEach(() => {
    mockConnectedPublicKey = null;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/api/splits")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ receivers: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ outgoing_streams: [], drips_lists: [], gives: { records: [] } }),
      });
    }));
  });

  it("renders 'Invite to Drips' button on someone else's public profile", async () => {
    mockConnectedPublicKey = "GOTHERUSER1111111111111111111111111111111111111111111111";

    render(<ProfileView address={targetAddress} />);

    const inviteBtn = await screen.findByTestId("invite-to-drips-btn");
    expect(inviteBtn).toBeInTheDocument();
    expect(inviteBtn).toHaveTextContent("Invite to Drips");

    const href = inviteBtn.getAttribute("href") || "";
    expect(href.startsWith("mailto:")).toBe(true);

    const url = new URL(href);
    const params = new URLSearchParams(url.search);

    // Subject: 'Check out [address] on Drips'
    expect(params.get("subject")).toBe(`Check out ${targetAddress} on Drips`);

    // Body includes profile URL
    const body = params.get("body") || "";
    expect(body).toContain(targetAddress);
    expect(body).toContain(window.location.href);
  });

  it("renders 'Invite to Drips' button when disconnected visitor views profile", async () => {
    mockConnectedPublicKey = null;

    render(<ProfileView address={targetAddress} />);

    const inviteBtn = await screen.findByTestId("invite-to-drips-btn");
    expect(inviteBtn).toBeInTheDocument();
  });

  it("is hidden when user views their own profile", async () => {
    // Connected wallet is the same as profile address
    mockConnectedPublicKey = targetAddress;

    render(<ProfileView address={targetAddress} />);

    // Wait for render
    await screen.findByText(targetAddress.slice(0, 2));

    const inviteBtn = screen.queryByTestId("invite-to-drips-btn");
    expect(inviteBtn).not.toBeInTheDocument();
  });
});
