import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import type { HardhatEthersHelpers } from "@nomicfoundation/hardhat-ethers/types";

type HardhatEthers = typeof import("ethers") & HardhatEthersHelpers;
const hardhatEthers = (hre as typeof hre & { ethers: HardhatEthers }).ethers;

const TOKEN_A_SYMBOL = "NBC";
const TOKEN_B_SYMBOL = "EURC";
const TOKEN_A_AMOUNT = "5000"; // expressed in whole tokens
const TOKEN_B_AMOUNT = "5"; // expressed in whole tokens

async function main() {
  const [deployer] = await hardhatEthers.getSigners();
  console.log("Adding liquidity with account:", deployer.address);

  const deploymentsDir = path.join(__dirname, "../deployments");
  const testTokensPath = path.join(deploymentsDir, "test-tokens.json");
  const pairsPath = path.join(deploymentsDir, "amm-pairs.json");
  const routerPath = path.join(deploymentsDir, "amm-router.json");

  if (!fs.existsSync(testTokensPath)) {
    throw new Error("test-tokens.json not found. Deploy test tokens first.");
  }
  if (!fs.existsSync(pairsPath)) {
    throw new Error("amm-pairs.json not found. Create pairs first.");
  }
  if (!fs.existsSync(routerPath)) {
    throw new Error("amm-router.json not found. Deploy router first.");
  }

  const testTokensJson = JSON.parse(fs.readFileSync(testTokensPath, "utf-8"));
  const pairsJson = JSON.parse(fs.readFileSync(pairsPath, "utf-8"));
  const routerJson = JSON.parse(fs.readFileSync(routerPath, "utf-8"));
  const routerAddress = routerJson.contracts?.SimpleAMMRouter?.address;
  if (!routerAddress) {
    throw new Error("Router address missing in amm-router.json");
  }

  // Get token A from test-tokens.json
  const tokenAInfo = testTokensJson.contracts?.[TOKEN_A_SYMBOL];
  if (!tokenAInfo) {
    throw new Error(`Token ${TOKEN_A_SYMBOL} not found in test-tokens.json`);
  }

  // Get token B from amm-pairs.json (for quote tokens like EURC/USDC)
  const pairKey = `${TOKEN_A_SYMBOL}/${TOKEN_B_SYMBOL}`;
  const pairInfo = pairsJson.pairs?.[pairKey];
  if (!pairInfo) {
    throw new Error(`Pair ${pairKey} not found in amm-pairs.json`);
  }

  const tokenAAddress = tokenAInfo.address;
  const tokenBAddress = pairInfo.quoteAddress;
  const tokenADecimals = Number(tokenAInfo.decimals ?? 18);
  // EURC/USDC typically use 6 decimals
  const tokenBDecimals = TOKEN_B_SYMBOL === "EURC" || TOKEN_B_SYMBOL === "USDC" ? 6 : 18;

  const tokenAAmount = hardhatEthers.parseUnits(TOKEN_A_AMOUNT, tokenADecimals);
  const tokenBAmount = hardhatEthers.parseUnits(TOKEN_B_AMOUNT, tokenBDecimals);

  console.log(`Target pair: ${TOKEN_A_SYMBOL}/${TOKEN_B_SYMBOL}`);
  console.log(`${TOKEN_A_SYMBOL} amount: ${TOKEN_A_AMOUNT} (${tokenAAmount.toString()})`);
  console.log(`${TOKEN_B_SYMBOL} amount: ${TOKEN_B_AMOUNT} (${tokenBAmount.toString()})`);

  // Basic ERC20 ABI for approve function
  const erc20Abi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
  ];

  const tokenAContract = await hardhatEthers.getContractAt("TestToken", tokenAAddress, deployer);
  const tokenBContract = await hardhatEthers.getContractAt(erc20Abi, tokenBAddress, deployer);
  const router = await hardhatEthers.getContractAt("SimpleAMMRouter", routerAddress, deployer);

  // Check balances
  const tokenABalance = await tokenAContract.balanceOf(deployer.address);
  const tokenBBalance = await tokenBContract.balanceOf(deployer.address);
  
  console.log(`\nCurrent balances:`);
  console.log(`  ${TOKEN_A_SYMBOL}: ${hardhatEthers.formatUnits(tokenABalance, tokenADecimals)}`);
  console.log(`  ${TOKEN_B_SYMBOL}: ${hardhatEthers.formatUnits(tokenBBalance, tokenBDecimals)}`);
  
  if (tokenABalance < tokenAAmount) {
    throw new Error(`Insufficient ${TOKEN_A_SYMBOL} balance. Have: ${hardhatEthers.formatUnits(tokenABalance, tokenADecimals)}, Need: ${TOKEN_A_AMOUNT}`);
  }
  if (tokenBBalance < tokenBAmount) {
    throw new Error(`Insufficient ${TOKEN_B_SYMBOL} balance. Have: ${hardhatEthers.formatUnits(tokenBBalance, tokenBDecimals)}, Need: ${TOKEN_B_AMOUNT}`);
  }

  console.log("\nApproving router...");
  const approveTokenATx = await tokenAContract.approve(routerAddress, tokenAAmount);
  await approveTokenATx.wait();
  const approveTokenBTx = await tokenBContract.approve(routerAddress, tokenBAmount);
  await approveTokenBTx.wait();
  console.log("✅ Approvals complete");

  console.log("\nAdding liquidity via router...");
  const tx = await router.addLiquidity(tokenAAddress, tokenBAddress, tokenAAmount, tokenBAmount);
  const receipt = await tx.wait();
  const event = receipt?.logs?.length ? "Liquidity added" : "Liquidity tx sent";
  console.log(`✅ ${event}. Tx hash: ${receipt?.hash ?? "unknown"}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

