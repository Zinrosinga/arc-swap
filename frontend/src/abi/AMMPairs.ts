/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const AMMPairs = {
  "NBC/EURC": {
    tokenSymbol: "NBC",
    tokenAddress: "0x886dC8c87279E54DD5dA4067c8aF1C82c347f00F",
    quoteAddress: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    pairAddress: "0x1eDa3e7A3aDa7f34Eef5D81d236F67FA3A0368e8"
  },
  "SDR/EURC": {
    tokenSymbol: "SDR",
    tokenAddress: "0xC5fa3de685C794ef54805171C035b903C5dda818",
    quoteAddress: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    pairAddress: "0xC09047BD81B8400C12B136aFCCF7289607D1e2F2"
  },
  "PHL/EURC": {
    tokenSymbol: "PHL",
    tokenAddress: "0x7dcd7E817cEef6Cd6a499Ff81A6cA6667710F3E4",
    quoteAddress: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    pairAddress: "0x45CEF97d0291b59176fD4123f79c010a2519B04f"
  },
  "QBT/EURC": {
    tokenSymbol: "QBT",
    tokenAddress: "0x6D8136FF55D6aB192709F61B8cDb91a3293ccf6d",
    quoteAddress: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    pairAddress: "0xF89766C2B6206169ca173B4a9f169bF95eC24196"
  },
  "NBC/USDC": {
    tokenSymbol: "NBC",
    tokenAddress: "0x886dC8c87279E54DD5dA4067c8aF1C82c347f00F",
    quoteAddress: "0x3600000000000000000000000000000000000000",
    pairAddress: "0xDE553FdAe635B88Ee2a734FbDa2A15B28A916c62"
  },
  "SDR/USDC": {
    tokenSymbol: "SDR",
    tokenAddress: "0xC5fa3de685C794ef54805171C035b903C5dda818",
    quoteAddress: "0x3600000000000000000000000000000000000000",
    pairAddress: "0xD9b347d1AacBeAe66b5FE69e0F7a8aE56a4fc043"
  },
  "PHL/USDC": {
    tokenSymbol: "PHL",
    tokenAddress: "0x7dcd7E817cEef6Cd6a499Ff81A6cA6667710F3E4",
    quoteAddress: "0x3600000000000000000000000000000000000000",
    pairAddress: "0x1707Fb2740a18F636bf2BdEb73179ec335d99039"
  },
  "QBT/USDC": {
    tokenSymbol: "QBT",
    tokenAddress: "0x6D8136FF55D6aB192709F61B8cDb91a3293ccf6d",
    quoteAddress: "0x3600000000000000000000000000000000000000",
    pairAddress: "0x09Bc3d77885A1b3945C4dEF8Ca02eC9323CBae83"
  },
  "NBC/SDR": {
    tokenSymbol: "NBC",
    tokenAddress: "0xD8F7c841cF2Bc2c54B96C3C51fadfFfA6649E49d",
    quoteAddress: "0x951f3101088f3efCB25B5Ef1DF6aEC8FA8Ed40d3",
    pairAddress: "0x9f8e72A7ED04559a349eaD80544098f577daA2e8"
  }
} as const;

export function getPairKey(symbolA: string, symbolB: string) {
  const direct = `${symbolA}/${symbolB}`;
  const inverse = `${symbolB}/${symbolA}`;
  if (direct in AMMPairs) return direct as keyof typeof AMMPairs;
  if (inverse in AMMPairs) return inverse as keyof typeof AMMPairs;
  throw new Error(`Pair not found: ${symbolA}/${symbolB}`);
}
