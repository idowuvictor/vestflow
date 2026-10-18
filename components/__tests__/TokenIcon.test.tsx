// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TokenIcon, {
  resolveTokenSymbol,
  getTokenIconSrc,
  TOKEN_ICON_MAP,
  GENERIC_COIN_ICON,
  USDC_TESTNET_TOKEN,
} from "../TokenIcon";
import { NATIVE_TOKEN } from "@/lib/stellar";

describe("TokenIcon Component (#1040)", () => {
  it("renders XLM icon for native token, 'XLM', and empty input", () => {
    const { unmount } = render(<TokenIcon token="XLM" />);
    const icon1 = screen.getByTestId("token-icon");
    expect(icon1).toBeInTheDocument();
    expect(icon1).toHaveAttribute("src", TOKEN_ICON_MAP.XLM);
    expect(icon1).toHaveAttribute("alt", "");
    expect(icon1).toHaveAttribute("aria-hidden", "true");
    expect(icon1).toHaveAttribute("width", "16");
    expect(icon1).toHaveAttribute("height", "16");
    unmount();

    render(<TokenIcon token={NATIVE_TOKEN} />);
    const icon2 = screen.getByTestId("token-icon");
    expect(icon2).toHaveAttribute("src", TOKEN_ICON_MAP.XLM);
  });

  it("renders USDC icon for USDC symbol and testnet address", () => {
    const { unmount } = render(<TokenIcon symbol="USDC" />);
    const icon1 = screen.getByTestId("token-icon");
    expect(icon1).toHaveAttribute("src", TOKEN_ICON_MAP.USDC);
    expect(icon1).toHaveAttribute("alt", "");
    expect(icon1).toHaveAttribute("aria-hidden", "true");
    unmount();

    render(<TokenIcon token={USDC_TESTNET_TOKEN} />);
    const icon2 = screen.getByTestId("token-icon");
    expect(icon2).toHaveAttribute("src", TOKEN_ICON_MAP.USDC);
  });

  it("renders generic coin icon for unknown tokens", () => {
    render(<TokenIcon token="CUNKNOWN123456789" />);
    const icon = screen.getByTestId("token-icon");
    expect(icon).toHaveAttribute("src", GENERIC_COIN_ICON);
    expect(icon).toHaveAttribute("alt", "");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("width", "16");
    expect(icon).toHaveAttribute("height", "16");
  });

  it("is sized consistently at 16px by default", () => {
    render(<TokenIcon token="XLM" />);
    const icon = screen.getByTestId("token-icon");
    expect(icon).toHaveStyle({ width: "16px", height: "16px" });
  });

  it("supports custom size while preserving empty decorative alt", () => {
    render(<TokenIcon token="USDC" size={24} />);
    const icon = screen.getByTestId("token-icon");
    expect(icon).toHaveAttribute("alt", "");
    expect(icon).toHaveAttribute("width", "24");
    expect(icon).toHaveAttribute("height", "24");
    expect(icon).toHaveStyle({ width: "24px", height: "24px" });
  });

  it("resolveTokenSymbol correctly resolves XLM, USDC and others", () => {
    expect(resolveTokenSymbol()).toBe("XLM");
    expect(resolveTokenSymbol(null)).toBe("XLM");
    expect(resolveTokenSymbol("native")).toBe("XLM");
    expect(resolveTokenSymbol(NATIVE_TOKEN)).toBe("XLM");
    expect(resolveTokenSymbol("xlm")).toBe("XLM");
    expect(resolveTokenSymbol("usdc")).toBe("USDC");
    expect(resolveTokenSymbol(USDC_TESTNET_TOKEN)).toBe("USDC");
    expect(resolveTokenSymbol("UNKNOWN")).toBe("UNKNOWN");
  });
});
