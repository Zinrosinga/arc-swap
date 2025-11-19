import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path: từ frontend/scripts lên arc-00, vào contracts
const contractsDir = path.resolve(__dirname, "../../contracts");
const deploymentsDir = path.join(contractsDir, "deployments");

// Output: frontend/src/abi
const outdir = path.resolve(__dirname, "../src/abi");

if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir, { recursive: true });
}

const line = "\n===================================================================\n";

console.log("🔄 Generating ABIs for DEX (SimpleAMM)...");

// ===================== AMM Factory =====================
const factoryFile = path.join(deploymentsDir, "amm-factory.json");
if (!fs.existsSync(factoryFile)) {
  console.error(`${line}amm-factory.json not found at ${factoryFile}${line}`);
  process.exit(1);
}
const factoryData = JSON.parse(fs.readFileSync(factoryFile, "utf-8"));
console.log(`✅ Loaded amm-factory.json`);

// ===================== AMM Router =====================
const routerFile = path.join(deploymentsDir, "amm-router.json");
if (!fs.existsSync(routerFile)) {
  console.error(`${line}amm-router.json not found at ${routerFile}${line}`);
  process.exit(1);
}
const routerData = JSON.parse(fs.readFileSync(routerFile, "utf-8"));
console.log(`✅ Loaded amm-router.json`);

// ===================== AMM Pairs =====================
const pairsFile = path.join(deploymentsDir, "amm-pairs.json");
if (!fs.existsSync(pairsFile)) {
  console.error(`${line}amm-pairs.json not found at ${pairsFile}${line}`);
  process.exit(1);
}
const pairsData = JSON.parse(fs.readFileSync(pairsFile, "utf-8"));
console.log(`✅ Loaded amm-pairs.json`);

// ===================== Generate SimpleAMMFactory ABI/Addresses =====================
console.log("\n📝 Generating SimpleAMMFactory...");

const factoryABI = `/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const SimpleAMMFactoryABI = ${JSON.stringify({ abi: factoryData.abis.SimpleAMMFactory }, null, 2)} as const;
`;
fs.writeFileSync(path.join(outdir, "SimpleAMMFactoryABI.ts"), factoryABI, "utf-8");
console.log(`✅ Generated SimpleAMMFactoryABI.ts`);

const factoryAddresses = `/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const SimpleAMMFactoryAddresses = {
  "${factoryData.chainId}": {
    chainId: ${factoryData.chainId},
    chainName: "${factoryData.chainName}",
    address: "${factoryData.contracts.SimpleAMMFactory.address}" as const,
    owner: "${factoryData.contracts.SimpleAMMFactory.owner}" as const
  }
} as const;

export function getFactoryAddress(chainId: number): \`0x\${string}\` {
  const chain = SimpleAMMFactoryAddresses[chainId.toString() as keyof typeof SimpleAMMFactoryAddresses];
  if (!chain) {
    throw new Error(\`SimpleAMMFactory not deployed on chain \${chainId}\`);
  }
  return chain.address;
}
`;
fs.writeFileSync(path.join(outdir, "SimpleAMMFactoryAddresses.ts"), factoryAddresses, "utf-8");
console.log(`✅ Generated SimpleAMMFactoryAddresses.ts`);

// ===================== Generate SimpleAMMRouter ABI/Addresses =====================
console.log("\n📝 Generating SimpleAMMRouter...");

const routerABI = `/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const SimpleAMMRouterABI = ${JSON.stringify({ abi: routerData.abis.SimpleAMMRouter }, null, 2)} as const;
`;
fs.writeFileSync(path.join(outdir, "SimpleAMMRouterABI.ts"), routerABI, "utf-8");
console.log(`✅ Generated SimpleAMMRouterABI.ts`);

const routerAddresses = `/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const SimpleAMMRouterAddresses = {
  "${routerData.chainId}": {
    chainId: ${routerData.chainId},
    chainName: "${routerData.chainName}",
    address: "${routerData.contracts.SimpleAMMRouter.address}" as const,
    factory: "${routerData.contracts.SimpleAMMRouter.factory}" as const
  }
} as const;

export function getRouterAddress(chainId: number): \`0x\${string}\` {
  const chain = SimpleAMMRouterAddresses[chainId.toString() as keyof typeof SimpleAMMRouterAddresses];
  if (!chain) {
    throw new Error(\`SimpleAMMRouter not deployed on chain \${chainId}\`);
  }
  return chain.address;
}
`;
fs.writeFileSync(path.join(outdir, "SimpleAMMRouterAddresses.ts"), routerAddresses, "utf-8");
console.log(`✅ Generated SimpleAMMRouterAddresses.ts`);

// ===================== Generate SimpleAMMPair ABI and Pairs Map =====================
console.log("\n📝 Generating SimpleAMMPair + Pairs map...");

const pairABI = `/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const SimpleAMMPairABI = ${JSON.stringify({ abi: pairsData.abis.SimpleAMMPair }, null, 2)} as const;
`;
fs.writeFileSync(path.join(outdir, "SimpleAMMPairABI.ts"), pairABI, "utf-8");
console.log(`✅ Generated SimpleAMMPairABI.ts`);

const pairsTs = `/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const AMMPairs = {
${Object.entries(pairsData.pairs)
  .map(
    ([key, data]) => `  "${key}": {
    tokenSymbol: "${data.tokenSymbol}",
    tokenAddress: "${data.tokenAddress}",
    quoteAddress: "${data.quoteAddress}",
    pairAddress: "${data.pairAddress}"
  }`
  )
  .join(",\n")}
} as const;

export function getPairKey(symbolA: string, symbolB: string) {
  const direct = \`\${symbolA}/\${symbolB}\`;
  const inverse = \`\${symbolB}/\${symbolA}\`;
  if (direct in AMMPairs) return direct as keyof typeof AMMPairs;
  if (inverse in AMMPairs) return inverse as keyof typeof AMMPairs;
  throw new Error(\`Pair not found: \${symbolA}/\${symbolB}\`);
}
`;
fs.writeFileSync(path.join(outdir, "AMMPairs.ts"), pairsTs, "utf-8");
console.log(`✅ Generated AMMPairs.ts`);

// ===================== Generate contracts.ts (DEX only) =====================
const dexContractsTs = `/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
import { SimpleAMMFactoryABI } from './SimpleAMMFactoryABI';
import { SimpleAMMFactoryAddresses, getFactoryAddress } from './SimpleAMMFactoryAddresses';
import { SimpleAMMRouterABI } from './SimpleAMMRouterABI';
import { SimpleAMMRouterAddresses, getRouterAddress } from './SimpleAMMRouterAddresses';
import { SimpleAMMPairABI } from './SimpleAMMPairABI';
import { AMMPairs, getPairKey } from './AMMPairs';

export const ABIs = {
  SimpleAMMFactory: SimpleAMMFactoryABI.abi,
  SimpleAMMRouter: SimpleAMMRouterABI.abi,
  SimpleAMMPair: SimpleAMMPairABI.abi,
};

export const Addresses = {
  SimpleAMMFactory: SimpleAMMFactoryAddresses,
  SimpleAMMRouter: SimpleAMMRouterAddresses,
};

export { SimpleAMMFactoryABI, SimpleAMMFactoryAddresses, getFactoryAddress };
export { SimpleAMMRouterABI, SimpleAMMRouterAddresses, getRouterAddress };
export { SimpleAMMPairABI };
export { AMMPairs, getPairKey };

export const ARC_TESTNET_CHAIN_ID = ${factoryData.chainId ?? 5042002};

export function getDexAddresses(chainId: number = ARC_TESTNET_CHAIN_ID) {
  return {
    factory: getFactoryAddress(chainId),
    router: getRouterAddress(chainId),
  };
}
`;
fs.writeFileSync(path.join(outdir, "contracts.ts"), dexContractsTs, "utf-8");
console.log(`✅ Generated contracts.ts (DEX only)`);

// ===================== Summary =====================
console.log(`\n${line}🎉 All done! Generated DEX files:${line}`);
console.log(`   ✅ SimpleAMMFactoryABI.ts`);
console.log(`   ✅ SimpleAMMFactoryAddresses.ts`);
console.log(`   ✅ SimpleAMMRouterABI.ts`);
console.log(`   ✅ SimpleAMMRouterAddresses.ts`);
console.log(`   ✅ SimpleAMMPairABI.ts`);
console.log(`   ✅ AMMPairs.ts`);
console.log(`   ✅ contracts.ts (DEX only)`);
console.log(`${line}`);
