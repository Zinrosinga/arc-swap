/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const SimpleAMMRouterAddresses = {
  "5042002": {
    chainId: 5042002,
    chainName: "arc",
    address: "0xE35d0314E78438D5620ae4391b85F1E8935fc09E" as const,
    factory: "0xfd4D139C593C5a0126bD9e63Ec9B7052F4EB9Da3" as const
  }
} as const;

export function getRouterAddress(chainId: number): `0x${string}` {
  const chain = SimpleAMMRouterAddresses[chainId.toString() as keyof typeof SimpleAMMRouterAddresses];
  if (!chain) {
    throw new Error(`SimpleAMMRouter not deployed on chain ${chainId}`);
  }
  return chain.address;
}
