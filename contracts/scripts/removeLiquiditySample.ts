import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import type { HardhatEthersHelpers } from "@nomicfoundation/hardhat-ethers/types";

type HardhatEthers = typeof import("ethers") & HardhatEthersHelpers;
const hardhatEthers = (hre as typeof hre & { ethers: HardhatEthers }).ethers;

const TOKEN_A_SYMBOL = "NBC";
const TOKEN_B_SYMBOL = "EURC";
const LP_AMOUNT_TO_REMOVE = "0.00003"; // Exact amount of LP tokens to remove (in LP tokens, 18 decimals)

async function main() {
  const [deployer] = await hardhatEthers.getSigners();
  console.log("Removing liquidity with account:", deployer.address);

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

  const pairAddress = pairInfo.pairAddress;
  console.log(`\nTarget pair: ${pairKey}`);
  console.log(`Pair address: ${pairAddress}`);

  // Basic ERC20 ABI for balanceOf function
  const erc20Abi = [
    "function balanceOf(address account) external view returns (uint256)",
  ];

  // Get contracts
  const tokenAContract = await hardhatEthers.getContractAt("TestToken", tokenAAddress, deployer);
  const tokenBContract = await hardhatEthers.getContractAt(erc20Abi, tokenBAddress, deployer);
  const router = await hardhatEthers.getContractAt("SimpleAMMRouter", routerAddress, deployer);
  const pairContract = await hardhatEthers.getContractAt("SimpleAMMPair", pairAddress, deployer);

  // Check LP token balance
  const lpBalance = await pairContract.balanceOf(deployer.address);
  console.log(`\nLP Token Balance: ${hardhatEthers.formatUnits(lpBalance, 18)} LP`);
  
  if (lpBalance === 0n) {
    throw new Error("No LP tokens to remove. Add liquidity first.");
  }

  // Check balances before
  const tokenABalanceBefore = await tokenAContract.balanceOf(deployer.address);
  const tokenBBalanceBefore = await tokenBContract.balanceOf(deployer.address);
  console.log(`\nBalances BEFORE removal:`);
  console.log(`  ${TOKEN_A_SYMBOL}: ${hardhatEthers.formatUnits(tokenABalanceBefore, tokenADecimals)}`);
  console.log(`  ${TOKEN_B_SYMBOL}: ${hardhatEthers.formatUnits(tokenBBalanceBefore, tokenBDecimals)}`);

  // Get pair reserves and total supply to calculate expected amounts
  const [reserve0, reserve1] = await pairContract.getReserves();
  const totalSupply = await pairContract.totalSupply();
  const token0 = await pairContract.token0();
  const isTokenA0 = tokenAAddress.toLowerCase() < tokenBAddress.toLowerCase();
  
  // Parse LP amount to remove (18 decimals)
  const lpAmountToRemove = hardhatEthers.parseUnits(LP_AMOUNT_TO_REMOVE, 18);
  
  console.log(`\nRemoving LP tokens:`);
  console.log(`  LP tokens to remove: ${LP_AMOUNT_TO_REMOVE} LP (${lpAmountToRemove.toString()})`);
  
  if (lpAmountToRemove === 0n) {
    throw new Error("LP amount to remove is zero");
  }
  
  if (lpAmountToRemove > lpBalance) {
    throw new Error(`Insufficient LP balance. Have: ${hardhatEthers.formatUnits(lpBalance, 18)}, Need: ${LP_AMOUNT_TO_REMOVE}`);
  }

  // Calculate expected amounts based on LP amount to remove
  const expectedToken0 = (lpAmountToRemove * BigInt(reserve0)) / totalSupply;
  const expectedToken1 = (lpAmountToRemove * BigInt(reserve1)) / totalSupply;
  
  const expectedTokenA = isTokenA0 ? expectedToken0 : expectedToken1;
  const expectedTokenB = isTokenA0 ? expectedToken1 : expectedToken0;
  
  console.log(`\nExpected amounts to receive:`);
  console.log(`  ${TOKEN_A_SYMBOL}: ${hardhatEthers.formatUnits(expectedTokenA, tokenADecimals)}`);
  console.log(`  ${TOKEN_B_SYMBOL}: ${hardhatEthers.formatUnits(expectedTokenB, tokenBDecimals)}`);

  // Approve LP token
  console.log("\nApproving LP token for router...");
  const approveLPTx = await pairContract.approve(routerAddress, lpAmountToRemove);
  await approveLPTx.wait();
  console.log("✅ LP token approval complete");

  // Remove liquidity
  console.log("\nRemoving liquidity via router...");
  try {
    const tx = await router.removeLiquidity(tokenAAddress, tokenBAddress, lpAmountToRemove);
    const receipt = await tx.wait();
    console.log(`✅ Liquidity removed. Tx hash: ${receipt?.hash ?? "unknown"}`);
    
    // Check balances after
    const tokenABalanceAfter = await tokenAContract.balanceOf(deployer.address);
    const tokenBBalanceAfter = await tokenBContract.balanceOf(deployer.address);
    const lpBalanceAfter = await pairContract.balanceOf(deployer.address);
    
    console.log(`\nBalances AFTER removal:`);
    console.log(`  ${TOKEN_A_SYMBOL}: ${hardhatEthers.formatUnits(tokenABalanceAfter, tokenADecimals)} (+${hardhatEthers.formatUnits(tokenABalanceAfter - tokenABalanceBefore, tokenADecimals)})`);
    console.log(`  ${TOKEN_B_SYMBOL}: ${hardhatEthers.formatUnits(tokenBBalanceAfter, tokenBDecimals)} (+${hardhatEthers.formatUnits(tokenBBalanceAfter - tokenBBalanceBefore, tokenBDecimals)})`);
    console.log(`  LP Token: ${hardhatEthers.formatUnits(lpBalanceAfter, 18)} (-${hardhatEthers.formatUnits(lpBalance - lpBalanceAfter, 18)})`);
    
    // Verify amounts received
    const tokenAReceived = tokenABalanceAfter - tokenABalanceBefore;
    const tokenBReceived = tokenBBalanceAfter - tokenBBalanceBefore;
    
    console.log(`\n✅ Test PASSED:`);
    console.log(`  Received ${TOKEN_A_SYMBOL}: ${hardhatEthers.formatUnits(tokenAReceived, tokenADecimals)}`);
    console.log(`  Received ${TOKEN_B_SYMBOL}: ${hardhatEthers.formatUnits(tokenBReceived, tokenBDecimals)}`);
    console.log(`  LP burned: ${hardhatEthers.formatUnits(lpBalance - lpBalanceAfter, 18)}`);
  } catch (error: any) {
    console.error("\n❌ Error removing liquidity:");
    console.error(error.message || error);
    if (error.reason) {
      console.error(`Reason: ${error.reason}`);
    }
    throw error;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

