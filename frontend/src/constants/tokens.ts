/**
 * Token and Contract Addresses (Arc Testnet)
 * Centralized configuration for all token addresses and DEX contracts
 * All addresses are imported from abi files (auto-generated)
 */

import { getUSDCAddress } from "@/abi/USDCAddresses";
import { getEURCAddress } from "@/abi/EURCAddresses";
import { getRouterAddress, SimpleAMMRouterAddresses } from "@/abi/SimpleAMMRouterAddresses";
import { AMMPairs } from "@/abi/AMMPairs";

// Chain ID
export const ARC_CHAIN_ID = 5042002;

// DEX Contract Addresses (from abi files)
export const ROUTER_ADDRESS = getRouterAddress(ARC_CHAIN_ID);
export const FACTORY_ADDRESS = SimpleAMMRouterAddresses[ARC_CHAIN_ID.toString() as keyof typeof SimpleAMMRouterAddresses]?.factory as `0x${string}`;

// Quote Token (EURC) - from abi file
export const QUOTE_SYMBOL = "EURC";
export const QUOTE_ADDRESS = getEURCAddress(ARC_CHAIN_ID);
export const QUOTE_DECIMALS = 6;

// Token Addresses (from abi files)
export const USDC_ADDRESS = getUSDCAddress(ARC_CHAIN_ID);
export const EURC_ADDRESS = getEURCAddress(ARC_CHAIN_ID);

// Test Tokens (NBC, SDR, PHL, QBT) - from AMMPairs
export const NBC_ADDRESS = AMMPairs["NBC/EURC"].tokenAddress as `0x${string}`;
export const SDR_ADDRESS = AMMPairs["SDR/EURC"].tokenAddress as `0x${string}`;
export const PHL_ADDRESS = AMMPairs["PHL/EURC"].tokenAddress as `0x${string}`;
export const QBT_ADDRESS = AMMPairs["QBT/EURC"].tokenAddress as `0x${string}`;

// Token Configurations
export interface TokenConfig {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  icon: string;
}

// Quote Token Config
export const QUOTE_TOKEN: TokenConfig = {
  symbol: QUOTE_SYMBOL,
  name: "Euro Coin",
  address: QUOTE_ADDRESS,
  decimals: QUOTE_DECIMALS,
  icon: "/eurc.svg",
};

// All Tokens for Faucet
export const TOKENS: TokenConfig[] = [
  {
    symbol: "USDC",
    name: "USD Coin",
    address: USDC_ADDRESS,
    decimals: 6,
    icon: "/usdc.svg",
  },
  {
    symbol: "EURC",
    name: "Euro Coin",
    address: EURC_ADDRESS,
    decimals: 6,
    icon: "/eurc.svg",
  },
  {
    symbol: "NBC",
    name: "Nebula Coin",
    address: NBC_ADDRESS,
    decimals: 18,
    icon: "/nbc.svg",
  },
  {
    symbol: "SDR",
    name: "Solar Drift",
    address: SDR_ADDRESS,
    decimals: 18,
    icon: "/sdr.svg",
  },
  {
    symbol: "PHL",
    name: "Phantom Liquid",
    address: PHL_ADDRESS,
    decimals: 18,
    icon: "/phl.svg",
  },
  {
    symbol: "QBT",
    name: "Quantum Byte",
    address: QBT_ADDRESS,
    decimals: 18,
    icon: "/qbt.svg",
  },
] as const;

// DEX Token Options (for Swap/Liquidity)
export const DEX_TOKEN_OPTIONS: TokenConfig[] = [
  {
    symbol: "NBC",
    name: "Nebula Coin",
    address: NBC_ADDRESS,
    decimals: 18,
    icon: "/nbc.svg",
  },
  {
    symbol: "SDR",
    name: "Solar Drift",
    address: SDR_ADDRESS,
    decimals: 18,
    icon: "/sdr.svg",
  },
  {
    symbol: "PHL",
    name: "Phantom Liquid",
    address: PHL_ADDRESS,
    decimals: 18,
    icon: "/phl.svg",
  },
  {
    symbol: "QBT",
    name: "Quantum Byte",
    address: QBT_ADDRESS,
    decimals: 18,
    icon: "/qbt.svg",
  },
] as const;

// Token Address Map (for quick lookup)
export const TOKEN_ADDRESSES = {
  USDC: USDC_ADDRESS,
  EURC: EURC_ADDRESS,
  NBC: NBC_ADDRESS,
  SDR: SDR_ADDRESS,
  PHL: PHL_ADDRESS,
  QBT: QBT_ADDRESS,
} as const;

// Helper function to get token config by symbol
export function getTokenConfig(symbol: string): TokenConfig | undefined {
  return TOKENS.find((token) => token.symbol === symbol);
}

// Helper function to get token config by address
export function getTokenConfigByAddress(address: string): TokenConfig | undefined {
  return TOKENS.find(
    (token) => token.address.toLowerCase() === address.toLowerCase()
  );
}

// Get pair address from AMMPairs
export function getPairAddress(tokenSymbol: string): `0x${string}` | undefined {
  const pairKey = `${tokenSymbol}/${QUOTE_SYMBOL}` as keyof typeof AMMPairs;
  return AMMPairs[pairKey]?.pairAddress as `0x${string}` | undefined;
}

