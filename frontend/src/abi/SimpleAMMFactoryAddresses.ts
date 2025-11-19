/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const SimpleAMMFactoryAddresses = {
  "5042002": {
    chainId: 5042002,
    chainName: "arc",
    address: "0xfd4D139C593C5a0126bD9e63Ec9B7052F4EB9Da3" as const,
    owner: "0xafE6d8dD18003a7471ddFBAf4cfcb6CB1Bb62b66" as const
  }
} as const;

export function getFactoryAddress(chainId: number): `0x${string}` {
  const chain = SimpleAMMFactoryAddresses[chainId.toString() as keyof typeof SimpleAMMFactoryAddresses];
  if (!chain) {
    throw new Error(`SimpleAMMFactory not deployed on chain ${chainId}`);
  }
  return chain.address;
}
