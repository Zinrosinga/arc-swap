import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import type { HardhatEthersHelpers } from "@nomicfoundation/hardhat-ethers/types";

type HardhatEthers = typeof import("ethers") & HardhatEthersHelpers;
const hardhatEthers = (hre as typeof hre & { ethers: HardhatEthers }).ethers;

async function main() {
  const [deployer] = await hardhatEthers.getSigners();
  console.log("Deploying SimpleAMMRouter with:", deployer.address);

  const deploymentsDir = path.join(__dirname, "../deployments");
  const factoryPath = path.join(deploymentsDir, "amm-factory.json");

  if (!fs.existsSync(factoryPath)) {
    throw new Error("amm-factory.json not found. Please deploy the factory first.");
  }

  const factoryJson = JSON.parse(fs.readFileSync(factoryPath, "utf-8"));
  const factoryAddress = factoryJson.contracts?.SimpleAMMFactory?.address;
  if (!factoryAddress) {
    throw new Error("Factory address missing in amm-factory.json");
  }

  const Router = await hardhatEthers.getContractFactory("SimpleAMMRouter");
  const router = await Router.deploy(factoryAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log(`✅ SimpleAMMRouter deployed to: ${routerAddress}`);

  const network = await hardhatEthers.provider.getNetwork();
  const chainId = Number(network.chainId);

  const outPath = path.join(deploymentsDir, "amm-router.json");
  const routerArtifact = await hre.artifacts.readArtifact("SimpleAMMRouter");

  const payload = {
    chainId,
    chainName: network.name,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      SimpleAMMRouter: {
        address: routerAddress,
        factory: factoryAddress,
      },
    },
    abis: {
      SimpleAMMRouter: routerArtifact.abi,
    },
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log("\n📝 Deployment info saved to deployments/amm-router.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

