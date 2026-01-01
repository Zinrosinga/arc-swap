/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const SimpleAMMFactoryAddresses = {
  "5042002": {
    chainId: 5042002,
    chainName: "arc",
    address: "0xf0C6f25922eCc7938Bcaf106e12Ed734928930A0" as const,
    owner: "0x0Ee56E2eAE57C190CD8F04e06A21d2BfF46661dA" as const
  }
} as const;

export function getFactoryAddress(chainId: number): `0x${string}` {
  const chain = SimpleAMMFactoryAddresses[chainId.toString() as keyof typeof SimpleAMMFactoryAddresses];
  if (!chain) {
    throw new Error(`SimpleAMMFactory not deployed on chain ${chainId}`);
  }
  return chain.address;
}
