import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import type { HardhatEthersHelpers } from "@nomicfoundation/hardhat-ethers/types";

type HardhatEthers = typeof import("ethers") & HardhatEthersHelpers;
const hardhatEthers = (hre as typeof hre & { ethers: HardhatEthers }).ethers;

const TOKEN_SYMBOL = "NBC"; // swap from QUOTE -> TOKEN

// Quote token: EURC (6 decimals)
const QUOTE_SYMBOL = "EURC";
const QUOTE_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
const QUOTE_DECIMALS = 6;
const AMOUNT_IN_QUOTE = "1"; // EURC with 6 decimals

// Slippage and deadline configuration
// Example: 100 = 1% slippage; 50 = 0.5%
const SLIPPAGE_BPS = 100;
// Client-side deadline (in seconds). If now > createdAt + DEADLINE_SECONDS, abort locally.
const DEADLINE_SECONDS = 300;

// Optional: assumed fee for AMM in basis points (Uniswap V2 default 0.3% = 30 bps)
// Used only for client-side quote to derive minOut. Does not affect on-chain logic.
const FEE_BPS = 30;
const BPS_DENOM = 10000;

async function main() {
  const [deployer] = await hardhatEthers.getSigners();
  console.log("Swapping with account:", deployer.address);

  const deploymentsDir = path.join(__dirname, "../deployments");
  const testTokensPath = path.join(deploymentsDir, "test-tokens.json");
  const routerPath = path.join(deploymentsDir, "amm-router.json");
  const pairsPath = path.join(deploymentsDir, "amm-pairs.json");

  if (!fs.existsSync(testTokensPath)) {
    throw new Error("test-tokens.json not found. Deploy test tokens first.");
  }
  if (!fs.existsSync(routerPath)) {
    throw new Error("amm-router.json not found. Deploy router first.");
  }
  if (!fs.existsSync(pairsPath)) {
    throw new Error("amm-pairs.json not found. Create pairs first.");
  }

  const testTokensJson = JSON.parse(fs.readFileSync(testTokensPath, "utf-8"));
  const routerJson = JSON.parse(fs.readFileSync(routerPath, "utf-8"));
  const pairsJson = JSON.parse(fs.readFileSync(pairsPath, "utf-8"));
  const routerAddress = routerJson.contracts?.SimpleAMMRouter?.address;
  if (!routerAddress) {
    throw new Error("Router address missing in amm-router.json");
  }

  const tokenInfo = testTokensJson.contracts?.[TOKEN_SYMBOL];
  if (!tokenInfo) {
    throw new Error(`Token ${TOKEN_SYMBOL} not found in test-tokens.json`);
  }

  const tokenAddress = tokenInfo.address;

  // Load pair address for TOKEN/QUOTE
  const pairKeyA = `${TOKEN_SYMBOL}/${QUOTE_SYMBOL}`;
  const pairKeyB = `${QUOTE_SYMBOL}/${TOKEN_SYMBOL}`;
  const pairInfo = pairsJson.pairs?.[pairKeyA] ?? pairsJson.pairs?.[pairKeyB];
  if (!pairInfo?.pairAddress) {
    throw new Error(`Pair for ${TOKEN_SYMBOL}/${QUOTE_SYMBOL} not found in amm-pairs.json`);
  }
  const pairAddress = pairInfo.pairAddress as string;

  // Prepare contracts
  const router = await hardhatEthers.getContractAt("SimpleAMMRouter", routerAddress, deployer);
  const quoteContract = await hardhatEthers.getContractAt("contracts/IERC20.sol:IERC20", QUOTE_ADDRESS, deployer);
  const pair = await hardhatEthers.getContractAt(pairsJson.abis.SimpleAMMPair, pairAddress, deployer);

  // Determine token ordering in the pair
  const [token0, token1] = await Promise.all([pair.token0(), pair.token1()]);

  // Read reserves
  const [reserve0, reserve1] = await pair.getReserves();

  // Compute expected output using constant product formula with fee
  // amountOut = (amountInWithFee * reserveOut) / (reserveIn * BPS_DENOM + amountInWithFee)
  const isQuoteToken0 = token0.toLowerCase() === QUOTE_ADDRESS.toLowerCase();
  const reserveIn = isQuoteToken0 ? reserve0 : reserve1; // QUOTE reserve
  const reserveOut = isQuoteToken0 ? reserve1 : reserve0; // TOKEN reserve

  const feeMultiplier = BigInt(BPS_DENOM - FEE_BPS);
  const amountIn = hardhatEthers.parseUnits(AMOUNT_IN_QUOTE, QUOTE_DECIMALS);
  const amountInWithFee = amountIn * feeMultiplier;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * BigInt(BPS_DENOM) + amountInWithFee;
  const amountOutExpected = denominator === 0n ? 0n : numerator / denominator;

  // Apply slippage tolerance
  const slippageMultiplier = BigInt(BPS_DENOM - SLIPPAGE_BPS);
  const minOut = (amountOutExpected * slippageMultiplier) / BigInt(BPS_DENOM);

  console.log(`Swapping ${AMOUNT_IN_QUOTE} ${QUOTE_SYMBOL} -> ${TOKEN_SYMBOL}`);
  console.log(`Quote amountOutExpected: ${hardhatEthers.formatUnits(amountOutExpected, tokenInfo.decimals ?? 18)} ${TOKEN_SYMBOL}`);
  console.log(`MinOut (${SLIPPAGE_BPS / 100}% slippage): ${hardhatEthers.formatUnits(minOut, tokenInfo.decimals ?? 18)} ${TOKEN_SYMBOL}`);

  // Client-side deadline logging and check (router does not enforce on-chain deadline)
  const createdAt = Math.floor(Date.now() / 1000);
  const deadlineTs = createdAt + DEADLINE_SECONDS;
  console.log(`Client deadline: ${new Date(deadlineTs * 1000).toISOString()} (in ${DEADLINE_SECONDS}s)`);
  if (Math.floor(Date.now() / 1000) > deadlineTs) {
    throw new Error("Client-side deadline exceeded before sending tx.");
  }

  console.log(`Approving router for ${QUOTE_SYMBOL}...`);
  const approveTx = await quoteContract.approve(routerAddress, amountIn);
  await approveTx.wait();
  console.log("✅ Approval done");

  console.log("Executing swap...");
  const tx = await router.swapExactTokens(QUOTE_ADDRESS, tokenAddress, amountIn, minOut);
  const receipt = await tx.wait();
  console.log(`✅ Swap tx hash: ${receipt?.hash ?? "unknown"}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

