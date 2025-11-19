/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const EURCAddresses = {
  "5042002": {
    chainId: 5042002,
    chainName: "arc",
    address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as const,
    decimals: 6,
    name: "EURC",
    symbol: "EURC"
  }
} as const;

export function getEURCAddress(chainId: number): `0x${string}` {
  const chain = EURCAddresses[chainId.toString() as keyof typeof EURCAddresses];
  if (!chain) {
    throw new Error(`EURC not deployed on chain ${chainId}`);
  }
  return chain.address;
}

