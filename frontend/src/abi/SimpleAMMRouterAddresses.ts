/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const SimpleAMMRouterAddresses = {
  "5042002": {
    chainId: 5042002,
    chainName: "arc",
    address: "0x5682AD3307a634F9cfD8a5e00C386ae822fd9A26" as const,
    factory: "0xf0C6f25922eCc7938Bcaf106e12Ed734928930A0" as const
  }
} as const;

export function getRouterAddress(chainId: number): `0x${string}` {
  const chain = SimpleAMMRouterAddresses[chainId.toString() as keyof typeof SimpleAMMRouterAddresses];
  if (!chain) {
    throw new Error(`SimpleAMMRouter not deployed on chain ${chainId}`);
  }
  return chain.address;
}
