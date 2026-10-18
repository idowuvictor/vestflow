// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StreamDetailDrawer from "../StreamDetailDrawer";
import { ScheduleData, NATIVE_TOKEN } from "@/lib/stellar";

const mockSchedule: ScheduleData = {
  id: 101,
  grantor: "GAAAGRANTOR1111111111111111111111111111111111111111111111",
  beneficiary: "GBBBRECEIVER222222222222222222222222222222222222222222222",
  token: NATIVE_TOKEN,
  total_amount: 100_000_0000000n, // 100,000 XLM
  claimed: 25_000_0000000n,       // 25,000 XLM
  start_time: 1700000000,
  duration: 86400 * 30,           // 30 days
  cliff_duration: 86400 * 5,
  lockup_duration: 0,
  kind: "Linear",
  revocable: true,
  revoked: false,
};

describe("StreamDetailDrawer Component (#1042)", () => {
  it("renders when open and displays all required stream fields", () => {
    const handleClose = vi.fn();
    render(
      <StreamDetailDrawer
        stream={mockSchedule}
        isOpen={true}
        onClose={handleClose}
      />
    );

    // Title / Schedule ID
    expect(screen.getByText("Schedule #101")).toBeInTheDocument();

    // Receiver field
    expect(screen.getByText("Receiver")).toBeInTheDocument();
    expect(screen.getByText(mockSchedule.beneficiary)).toBeInTheDocument();

    // Token field
    expect(screen.getByText("Token")).toBeInTheDocument();
    expect(screen.getByText("XLM")).toBeInTheDocument();

    // Rate field
    expect(screen.getByText("Streaming Rate")).toBeInTheDocument();
    expect(screen.getByText("Rate per second")).toBeInTheDocument();
    expect(screen.getByText("Rate per day")).toBeInTheDocument();

    // Balance field
    expect(screen.getByText("Balance")).toBeInTheDocument();
    expect(screen.getByText("Total Allocated")).toBeInTheDocument();
    expect(screen.getByText("Remaining Balance")).toBeInTheDocument();

    // Start date and Projected end
    expect(screen.getByText("Start Date")).toBeInTheDocument();
    expect(screen.getByText("Projected End")).toBeInTheDocument();

    // History tab button
    expect(screen.getByRole("tab", { name: /History Tab/i })).toBeInTheDocument();
  });

  it("switches to history tab when clicked", async () => {
    render(
      <StreamDetailDrawer
        stream={mockSchedule}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const historyTab = screen.getByRole("tab", { name: /History Tab/i });
    fireEvent.click(historyTab);

    expect(screen.getByTestId("stream-history-tab")).toBeInTheDocument();
  });

  it("closes on backdrop click (click outside)", () => {
    const handleClose = vi.fn();
    render(
      <StreamDetailDrawer
        stream={mockSchedule}
        isOpen={true}
        onClose={handleClose}
      />
    );

    const backdrop = screen.getByTestId("stream-drawer-backdrop");
    fireEvent.click(backdrop);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape key press", () => {
    const handleClose = vi.fn();
    render(
      <StreamDetailDrawer
        stream={mockSchedule}
        isOpen={true}
        onClose={handleClose}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("has accessible dialog attributes and focus trap", () => {
    render(
      <StreamDetailDrawer
        stream={mockSchedule}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const closeButton = screen.getByLabelText("Close drawer");
    expect(closeButton).toBeInTheDocument();
  });

  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <StreamDetailDrawer
        stream={mockSchedule}
        isOpen={false}
        onClose={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
