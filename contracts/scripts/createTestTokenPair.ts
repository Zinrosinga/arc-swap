import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import type { HardhatEthersHelpers } from "@nomicfoundation/hardhat-ethers/types";

type HardhatEthers = typeof import("ethers") & HardhatEthersHelpers;
const hardhatEthers = (hre as typeof hre & { ethers: HardhatEthers }).ethers;

// Pair to create: NBC/SDR
const TOKEN_A_SYMBOL = "NBC";
const TOKEN_B_SYMBOL = "SDR";

async function main() {
  const [deployer] = await hardhatEthers.getSigners();
  console.log("Creating test token pair with owner:", deployer.address);

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

  const tokenAInfo = testTokensJson.contracts?.[TOKEN_A_SYMBOL];
  const tokenBInfo = testTokensJson.contracts?.[TOKEN_B_SYMBOL];
  
  if (!tokenAInfo) {
    throw new Error(`Token ${TOKEN_A_SYMBOL} not found in test-tokens.json`);
  }
  if (!tokenBInfo) {
    throw new Error(`Token ${TOKEN_B_SYMBOL} not found in test-tokens.json`);
  }

  const tokenAAddress = tokenAInfo.address;
  const tokenBAddress = tokenBInfo.address;

  console.log(`\nCreating pair ${TOKEN_A_SYMBOL}/${TOKEN_B_SYMBOL}...`);
  console.log(`  ${TOKEN_A_SYMBOL}: ${tokenAAddress}`);
  console.log(`  ${TOKEN_B_SYMBOL}: ${tokenBAddress}`);

  const factory = await hardhatEthers.getContractAt("SimpleAMMFactory", factoryAddress, deployer);
  
  let pairAddress = await factory.getPair(tokenAAddress, tokenBAddress);
  if (pairAddress === hardhatEthers.ZeroAddress) {
    const tx = await factory.createPair(tokenAAddress, tokenBAddress);
    const receipt = await tx.wait();
    pairAddress = await factory.getPair(tokenAAddress, tokenBAddress);
    console.log(`✅ Pair created (tx: ${receipt?.hash ?? "unknown"}): ${pairAddress}`);
  } else {
    console.log(`ℹ️  Pair already exists at ${pairAddress}, skipping create`);
  }

  // Update amm-pairs.json
  const pairsPath = path.join(deploymentsDir, "amm-pairs.json");
  let pairsJson: any = {};
  if (fs.existsSync(pairsPath)) {
    try {
      pairsJson = JSON.parse(fs.readFileSync(pairsPath, "utf-8"));
    } catch {
      console.warn("Warning: existing amm-pairs.json is not valid JSON.");
    }
  }

  const pairKey = `${TOKEN_A_SYMBOL}/${TOKEN_B_SYMBOL}`;
  pairsJson.pairs = pairsJson.pairs || {};
  pairsJson.pairs[pairKey] = {
    tokenSymbol: TOKEN_A_SYMBOL,
    tokenAddress: tokenAAddress,
    quoteAddress: tokenBAddress,
    pairAddress: pairAddress,
  };

  pairsJson.lastUpdatedAt = new Date().toISOString();

  fs.writeFileSync(pairsPath, JSON.stringify(pairsJson, null, 2));
  console.log(`\n📝 Pair info saved to deployments/amm-pairs.json`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

