import React from "react";
import { NATIVE_TOKEN } from "@/lib/stellar";

export const USDC_TESTNET_TOKEN = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

// 16x16 SVG data URLs for static icon map
const XLM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="8" fill="#14B6EB"/><path d="M8 2.5L9.3 6.7L13.5 8L9.3 9.3L8 13.5L6.7 9.3L2.5 8L6.7 6.7Z" fill="white"/></svg>`;
const USDC_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="8" fill="#2775CA"/><text x="8" y="11.5" font-family="system-ui, sans-serif" font-size="10" font-weight="bold" fill="white" text-anchor="middle">$</text></svg>`;
const GENERIC_COIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="7.5" fill="#3F3F46" stroke="#71717A" stroke-width="1"/><circle cx="8" cy="8" r="5" fill="none" stroke="#A1A1AA" stroke-width="0.75" stroke-dasharray="1 1"/><circle cx="8" cy="8" r="2.5" fill="#D4D4D8"/></svg>`;

export const TOKEN_ICON_MAP: Record<string, string> = {
  XLM: `data:image/svg+xml;utf8,${encodeURIComponent(XLM_SVG)}`,
  USDC: `data:image/svg+xml;utf8,${encodeURIComponent(USDC_SVG)}`,
};

export const GENERIC_COIN_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(GENERIC_COIN_SVG)}`;

export function resolveTokenSymbol(tokenOrSymbol?: string | null): string {
  if (!tokenOrSymbol) return "XLM";
  const trimmed = tokenOrSymbol.trim();
  if (
    trimmed === NATIVE_TOKEN ||
    trimmed === "native" ||
    trimmed.toUpperCase() === "XLM"
  ) {
    return "XLM";
  }
  if (
    trimmed.toUpperCase() === "USDC" ||
    trimmed === USDC_TESTNET_TOKEN ||
    trimmed.toLowerCase().includes("usdc")
  ) {
    return "USDC";
  }
  return trimmed;
}

export function getTokenIconSrc(tokenOrSymbol?: string | null): string {
  const sym = resolveTokenSymbol(tokenOrSymbol).toUpperCase();
  return TOKEN_ICON_MAP[sym] ?? GENERIC_COIN_ICON;
}

export interface TokenIconProps {
  token?: string | null;
  symbol?: string | null;
  size?: number;
  className?: string;
}

export default function TokenIcon({
  token,
  symbol,
  size = 16,
  className = "",
}: TokenIconProps) {
  const resolved = resolveTokenSymbol(symbol || token);
  const src = getTokenIconSrc(symbol || token);

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      data-testid="token-icon"
      data-token={resolved}
      className={`inline-block shrink-0 rounded-full align-middle ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}
