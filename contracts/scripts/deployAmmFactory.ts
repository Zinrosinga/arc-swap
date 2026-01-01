import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import type { HardhatEthersHelpers } from "@nomicfoundation/hardhat-ethers/types";

type HardhatEthers = typeof import("ethers") & HardhatEthersHelpers;
const hardhatEthers = (hre as typeof hre & { ethers: HardhatEthers }).ethers;

async function main() {
  const [deployer] = await hardhatEthers.getSigners();
  console.log("Deploying SimpleAMMFactory with:", deployer.address);

  const Factory = await hardhatEthers.getContractFactory("SimpleAMMFactory");
  const factory = await Factory.deploy(deployer.address);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`✅ SimpleAMMFactory deployed to: ${factoryAddress}`);

  const network = await hardhatEthers.provider.getNetwork();
  const chainId = Number(network.chainId);

  const outDir = path.join(__dirname, "../deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, "amm-factory.json");

  const factoryArtifact = await hre.artifacts.readArtifact("SimpleAMMFactory");

  const payload = {
    chainId,
    chainName: network.name,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      SimpleAMMFactory: {
        address: factoryAddress,
        owner: deployer.address,
      },
    },
    abis: {
      SimpleAMMFactory: factoryArtifact.abi,
    },
  };

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  console.log("\n📝 Deployment info saved to deployments/amm-factory.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

