// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OutgoingStreamsList from "../OutgoingStreamsList";
import { ScheduleData, NATIVE_TOKEN } from "@/lib/stellar";

const mockSetStream = vi.fn();
const mockSqueezeStream = vi.fn();
const mockClaimVested = vi.fn();

vi.mock("@/lib/stellar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stellar")>();
  return {
    ...actual,
    setStream: (...args: any[]) => mockSetStream(...args),
    squeezeStream: (...args: any[]) => mockSqueezeStream(...args),
    claimVested: (...args: any[]) => mockClaimVested(...args),
  };
});

describe("OutgoingStreamsList (#1040, #1042, #1043)", () => {
  const myPublicKey = "GAAAGRANTOR1111111111111111111111111111111111111111111111";
  const beneficiaryA = "GBBBRECEIVER222222222222222222222222222222222222222222222";

  const schedule1: ScheduleData = {
    id: 10,
    grantor: myPublicKey,
    beneficiary: beneficiaryA,
    token: NATIVE_TOKEN,
    total_amount: 100_000_0000000n,
    claimed: 10_000_0000000n,
    start_time: 1700000000,
    duration: 86400 * 30,
    cliff_duration: 0,
    lockup_duration: 0,
    kind: "Linear",
    revocable: true,
    revoked: false,
  };

  const scheduleUSDC: ScheduleData = {
    id: 11,
    grantor: myPublicKey,
    beneficiary: beneficiaryA,
    token: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA", // USDC
    total_amount: 50_000_0000000n,
    claimed: 0n,
    start_time: 1700000000,
    duration: 86400 * 10,
    cliff_duration: 0,
    lockup_duration: 0,
    kind: "Linear",
    revocable: true,
    revoked: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Issue #1040: displays token icons in stream rows for XLM and USDC", () => {
    render(
      <OutgoingStreamsList
        schedules={[schedule1, scheduleUSDC]}
        publicKey={myPublicKey}
        claimableMap={new Map()}
        vestedMap={new Map()}
      />
    );

    const tokenIcons = screen.getAllByTestId("token-icon");
    expect(tokenIcons.length).toBeGreaterThan(0);

    // Verify decorative alt="" on all icons
    tokenIcons.forEach((icon) => {
      expect(icon).toHaveAttribute("alt", "");
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });

    // Check XLM and USDC icons present
    const xlmIcons = screen.getAllByTestId("token-icon").filter(
      (icon) => icon.getAttribute("data-token") === "XLM"
    );
    const usdcIcons = screen.getAllByTestId("token-icon").filter(
      (icon) => icon.getAttribute("data-token") === "USDC"
    );
    expect(xlmIcons.length).toBeGreaterThan(0);
    expect(usdcIcons.length).toBeGreaterThan(0);
  });

  it("Issue #1042: opens stream detail drawer on row click", () => {
    render(
      <OutgoingStreamsList
        schedules={[schedule1]}
        publicKey={myPublicKey}
        claimableMap={new Map()}
        vestedMap={new Map()}
      />
    );

    const row = screen.getByTestId("stream-row-10");
    expect(row).toBeInTheDocument();

    // Before clicking, drawer is not open
    expect(screen.queryByTestId("stream-detail-drawer")).not.toBeInTheDocument();

    // Click on row
    fireEvent.click(row);

    // Drawer should open and display schedule details
    const drawer = screen.getByTestId("stream-detail-drawer");
    expect(drawer).toBeInTheDocument();
    expect(drawer).toHaveTextContent("Schedule #10");
  });

  it("Issue #1043: shows spinner during set_stream submission, disables interactive elements, and clears on confirm", async () => {
    let resolveTx: (val: any) => void;
    mockSetStream.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTx = resolve;
        })
    );

    render(
      <OutgoingStreamsList
        schedules={[schedule1]}
        publicKey={myPublicKey}
        claimableMap={new Map()}
        vestedMap={new Map()}
      />
    );

    const stopButton = screen.getByRole("button", { name: "Stop stream" });
    const editButton = screen.getByRole("button", { name: "Edit" });

    // Click stop stream to trigger set_stream
    fireEvent.click(stopButton);

    // Spinner should appear on the row being modified
    expect(await screen.findByTestId("row-pending-spinner-10")).toBeInTheDocument();
    expect(screen.getByText("Updating stream…")).toBeInTheDocument();

    // Row interactive elements should be disabled during pending state
    expect(stopButton).toBeDisabled();
    expect(editButton).toBeDisabled();

    // Confirm transaction
    resolveTx!("TX_HASH_SUCCESS");

    // Spinner removed on tx confirm
    await waitFor(() => {
      expect(screen.queryByTestId("row-pending-spinner-10")).not.toBeInTheDocument();
    });

    // Interactive elements re-enabled
    expect(stopButton).not.toBeDisabled();
    expect(editButton).not.toBeDisabled();
  });

  it("Issue #1043: removes spinner and shows inline error if tx fails", async () => {
    mockSetStream.mockRejectedValue(new Error("Soroban simulation failed"));

    render(
      <OutgoingStreamsList
        schedules={[schedule1]}
        publicKey={myPublicKey}
        claimableMap={new Map()}
        vestedMap={new Map()}
      />
    );

    const stopButton = screen.getByRole("button", { name: "Stop stream" });
    fireEvent.click(stopButton);

    // Wait for failure
    await waitFor(() => {
      expect(screen.queryByTestId("row-pending-spinner-10")).not.toBeInTheDocument();
    });

    // Error state shown inline on the row
    const errorAlert = screen.getByTestId("row-tx-error-10");
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent("Soroban simulation failed");

    // Interactive elements re-enabled
    expect(stopButton).not.toBeDisabled();
  });

  it("Issue #1043: shows pending spinner on collect action and disables row", async () => {
    // Schedule where current user is beneficiary and has claimable balance
    const claimableSchedule: ScheduleData = {
      ...schedule1,
      id: 20,
      beneficiary: myPublicKey,
    };

    let resolveCollect: (val: any) => void;
    mockSqueezeStream.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCollect = resolve;
        })
    );

    render(
      <OutgoingStreamsList
        schedules={[claimableSchedule]}
        publicKey={myPublicKey}
        claimableMap={new Map([[20, 50000000n]])}
        vestedMap={new Map([[20, 50000000n]])}
      />
    );

    const collectButton = screen.getByRole("button", { name: /Collect/i });
    expect(collectButton).toBeInTheDocument();

    fireEvent.click(collectButton);

    // Spinner shown on the row
    expect(await screen.findByTestId("row-pending-spinner-20")).toBeInTheDocument();
    expect(screen.getByText("Collecting…")).toBeInTheDocument();
    expect(collectButton).toBeDisabled();

    // Resolve collect
    resolveCollect!("TX_SUCCESS");

    await waitFor(() => {
      expect(screen.queryByTestId("row-pending-spinner-20")).not.toBeInTheDocument();
    });
  });
});
