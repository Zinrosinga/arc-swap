import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import type { HardhatEthersHelpers } from "@nomicfoundation/hardhat-ethers/types";

type HardhatEthers = typeof import("ethers") & HardhatEthersHelpers;
const hardhatEthers = (hre as typeof hre & { ethers: HardhatEthers }).ethers;

async function main() {
  const [deployer] = await hardhatEthers.getSigners();
  console.log("Deploying test tokens with:", deployer.address);

  const configs = [
    {
      name: "Nebula Coin",
      symbol: "NBC",
      supply: hardhatEthers.parseUnits("1000000", 18), // 1M
      faucet: hardhatEthers.parseUnits("1000", 18),
    },
    {
      name: "Solar Drift",
      symbol: "SDR",
      supply: hardhatEthers.parseUnits("1000000", 18), // 1M
      faucet: hardhatEthers.parseUnits("1000", 18),
    },
    {
      name: "Phantom Liquid",
      symbol: "PHL",
      supply: hardhatEthers.parseUnits("1000000", 18), // 1M
      faucet: hardhatEthers.parseUnits("1000", 18),
    },
    {
      name: "Quantum Byte",
      symbol: "QBT",
      supply: hardhatEthers.parseUnits("1000000", 18), // 1M
      faucet: hardhatEthers.parseUnits("1000", 18),
    },
  ];

  const deployedTokens: {
    name: string;
    symbol: string;
    address: string;
    faucet: string;
    decimals: number;
    initialSupply: string;
  }[] = [];

  for (const cfg of configs) {
    console.log(`\nDeploying ${cfg.name} (${cfg.symbol})...`);
    const Token = await hardhatEthers.getContractFactory("TestToken");
    const token = await Token.deploy(cfg.name, cfg.symbol, 18, deployer.address, cfg.supply);
    await token.waitForDeployment();
    const address = await token.getAddress();
    console.log(`✅ ${cfg.symbol} deployed to: ${address}`);

    const tx = await token.setFaucetAmount(cfg.faucet);
    await tx.wait();
    console.log(
      `   Faucet amount set to ${hardhatEthers.formatUnits(cfg.faucet, 18)} ${cfg.symbol} (one-time per user)`
    );

    deployedTokens.push({
      name: cfg.name,
      symbol: cfg.symbol,
      address,
      faucet: hardhatEthers.formatUnits(cfg.faucet, 18),
      decimals: 18,
      initialSupply: hardhatEthers.formatUnits(cfg.supply, 18),
    });
  }

  const network = await hardhatEthers.provider.getNetwork();
  const chainId = Number(network.chainId);

  const outDir = path.join(__dirname, "../deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, "test-tokens.json");

  const contracts = deployedTokens.reduce(
    (acc, token) => {
      acc[token.symbol] = {
        name: token.name,
        symbol: token.symbol,
        address: token.address,
        decimals: token.decimals,
        initialSupply: token.initialSupply,
        faucetAmount: token.faucet,
      };
      return acc;
    },
    {} as Record<string, any>
  );

  const testTokenArtifact = await hre.artifacts.readArtifact("TestToken");

  const payload = {
    chainId,
    chainName: network.name,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts,
    abis: {
      TestToken: testTokenArtifact.abi,
    },
  };

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  console.log(`\n📝 Deployment info saved to deployments/test-tokens.json`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

