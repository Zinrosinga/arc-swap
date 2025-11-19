/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const AMMPairs = {
  "NBC/EURC": {
    tokenSymbol: "NBC",
    tokenAddress: "0x886dC8c87279E54DD5dA4067c8aF1C82c347f00F",
    quoteAddress: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    pairAddress: "0xEC12cb24c65bd9860E5218a3BCC2Cc3285ea91f0"
  },
  "SDR/EURC": {
    tokenSymbol: "SDR",
    tokenAddress: "0xC5fa3de685C794ef54805171C035b903C5dda818",
    quoteAddress: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    pairAddress: "0xF8619246ee781e8e692eA21Ab4f4126D4Dea6491"
  },
  "PHL/EURC": {
    tokenSymbol: "PHL",
    tokenAddress: "0x7dcd7E817cEef6Cd6a499Ff81A6cA6667710F3E4",
    quoteAddress: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    pairAddress: "0x995F2094DCf2cC44ea1A192bfe2F7597F4fA61a4"
  },
  "QBT/EURC": {
    tokenSymbol: "QBT",
    tokenAddress: "0x6D8136FF55D6aB192709F61B8cDb91a3293ccf6d",
    quoteAddress: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    pairAddress: "0x8cD91ACE8a0654CE42379D1aB6f882D47dAb6e72"
  },
  "NBC/USDC": {
    tokenSymbol: "NBC",
    tokenAddress: "0x886dC8c87279E54DD5dA4067c8aF1C82c347f00F",
    quoteAddress: "0x3600000000000000000000000000000000000000",
    pairAddress: "0x245aa8dEff2C4C7E3395eb4F3221078b55f32192"
  },
  "SDR/USDC": {
    tokenSymbol: "SDR",
    tokenAddress: "0xC5fa3de685C794ef54805171C035b903C5dda818",
    quoteAddress: "0x3600000000000000000000000000000000000000",
    pairAddress: "0x825Fad8E028e1857Ec3Fa517341133EC936F949E"
  },
  "PHL/USDC": {
    tokenSymbol: "PHL",
    tokenAddress: "0x7dcd7E817cEef6Cd6a499Ff81A6cA6667710F3E4",
    quoteAddress: "0x3600000000000000000000000000000000000000",
    pairAddress: "0xa6572490E624B568f990BBB2e22f41a97B8d30DC"
  },
  "QBT/USDC": {
    tokenSymbol: "QBT",
    tokenAddress: "0x6D8136FF55D6aB192709F61B8cDb91a3293ccf6d",
    quoteAddress: "0x3600000000000000000000000000000000000000",
    pairAddress: "0x4D65BB493e1a8634c932FD854f32CF4C0d796840"
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
