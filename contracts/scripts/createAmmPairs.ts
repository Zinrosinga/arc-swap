import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import type { HardhatEthersHelpers } from "@nomicfoundation/hardhat-ethers/types";

type HardhatEthers = typeof import("ethers") & HardhatEthersHelpers;
const hardhatEthers = (hre as typeof hre & { ethers: HardhatEthers }).ethers;

// Quote tokens config (both EURC and USDC - 6 decimals)
const QUOTE_TOKENS = [
  { symbol: "EURC", address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" },
  { symbol: "USDC", address: "0x3600000000000000000000000000000000000000" },
];
const TOKEN_SYMBOLS = ["NBC", "SDR", "PHL", "QBT"];

async function main() {
  const [deployer] = await hardhatEthers.getSigners();
  console.log("Creating AMM pairs with owner:", deployer.address);

  const deploymentsDir = path.join(__dirname, "../deployments");
  const testTokensPath = path.join(deploymentsDir, "test-tokens.json");
  const factoryPath = path.join(deploymentsDir, "amm-factory.json");

  if (!fs.existsSync(testTokensPath)) {
    throw new Error("test-tokens.json not found. Please deploy test tokens first.");
  }
  if (!fs.existsSync(factoryPath)) {
    throw new Error("amm-factory.json not found. Please deploy the factory first.");
  }

  const testTokensJson = JSON.parse(fs.readFileSync(testTokensPath, "utf-8"));
  const factoryJson = JSON.parse(fs.readFileSync(factoryPath, "utf-8"));

  const factoryAddress = factoryJson.contracts?.SimpleAMMFactory?.address;
  if (!factoryAddress) {
    throw new Error("Factory address missing in amm-factory.json");
  }

  const factory = await hardhatEthers.getContractAt("SimpleAMMFactory", factoryAddress, deployer);
  const pairs: Record<
    string,
    {
      tokenSymbol: string;
      tokenAddress: string;
      quoteAddress: string;
      pairAddress: string;
    }
  > = {};

  // Loop through all quote tokens (EURC and USDC)
  for (const quoteToken of QUOTE_TOKENS) {
    console.log(`\n📌 Processing pairs with ${quoteToken.symbol} as quote token...`);
    
    for (const symbol of TOKEN_SYMBOLS) {
      const tokenInfo = testTokensJson.contracts?.[symbol];
      if (!tokenInfo) {
        throw new Error(`Token ${symbol} not found in test-tokens.json`);
      }

      console.log(`\nProcessing pair ${symbol}/${quoteToken.symbol}...`);
      const tokenAddress = tokenInfo.address;

      let pairAddress = await factory.getPair(tokenAddress, quoteToken.address);
      if (pairAddress === hardhatEthers.ZeroAddress) {
        const tx = await factory.createPair(tokenAddress, quoteToken.address);
        const receipt = await tx.wait();
        pairAddress = await factory.getPair(tokenAddress, quoteToken.address);
        console.log(`✅ Pair created (tx: ${receipt?.hash ?? "unknown"}): ${pairAddress}`);
      } else {
        console.log(`ℹ️  Pair already exists at ${pairAddress}, skipping create`);
      }

      pairs[`${symbol}/${quoteToken.symbol}`] = {
        tokenSymbol: symbol,
        tokenAddress,
        quoteAddress: quoteToken.address,
        pairAddress,
      };
    }
  }

  const network = await hardhatEthers.provider.getNetwork();
  const chainId = Number(network.chainId);

  // Merge mode: if amm-pairs.json exists, merge existing pairs, keep existing metadata
  const outPath = path.join(deploymentsDir, "amm-pairs.json");
  let existing: any = {};
  if (fs.existsSync(outPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(outPath, "utf-8"));
    } catch {
      console.warn("Warning: existing amm-pairs.json is not valid JSON. A new file will be created.");
      existing = {};
    }
  }

  const mergedPairs = {
    ...(existing.pairs ?? {}),
    ...pairs,
  };

  const output = {
    chainId: existing.chainId ?? chainId,
    chainName: existing.chainName ?? network.name,
    deployedAt: existing.deployedAt ?? new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    deployer: deployer.address,
    factoryAddress: existing.factoryAddress ?? factoryAddress,
    // Keep existing quoteToken to avoid flipping between USDC/EURC;
    // pairs section will contain both USDC-* and EURC-* entries.
    quoteToken: existing.quoteToken ?? QUOTE_TOKENS[0].address,
    pairs: mergedPairs,
    abis: {
      ...(existing.abis ?? {}),
      SimpleAMMPair: (await hre.artifacts.readArtifact("SimpleAMMPair")).abi,
    },
  };

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\n📝 Pair info saved to deployments/amm-pairs.json`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

