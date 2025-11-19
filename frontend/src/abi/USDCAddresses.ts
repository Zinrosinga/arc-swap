/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const USDCAddresses = {
  "5042002": {
    chainId: 5042002,
    chainName: "arc",
    address: "0x3600000000000000000000000000000000000000" as const,
    decimals: 6,
    name: "USDC",
    symbol: "USDC"
  }
} as const;

export function getUSDCAddress(chainId: number): `0x${string}` {
  const chain = USDCAddresses[chainId.toString() as keyof typeof USDCAddresses];
  if (!chain) {
    throw new Error(`USDC not deployed on chain ${chainId}`);
  }
  return chain.address;
}
