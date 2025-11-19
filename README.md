# 🔄 ArcSwap

**The Native AMM of Arc Network**

A decentralized exchange (DEX) built on Arc Testnet, enabling seamless token swaps and liquidity provision through an automated market maker (AMM) protocol.

---

## 🎯 Overview

**ArcSwap** is a Uniswap V2-style AMM that allows users to:

- **Swap Tokens**: Trade between any supported tokens with low slippage
- **Provide Liquidity**: Add liquidity to pools and earn trading fees (0.3%)
- **Remove Liquidity**: Withdraw your liquidity position at any time
- **Faucet Tokens**: Get test tokens for testing the platform

---

## ✨ Key Features

- **Uniswap V2 Architecture**: Constant product formula (x * y = k)
- **Trading Fee**: 0.3% per swap (retained in pool)
- **Multiple Tokens**: Support for USDC, EURC, NBC, SDR, PHL, QBT
- **Dynamic Pairs**: Create new trading pairs on-demand
- **Low Slippage**: Efficient price discovery through AMM
- **LP Tokens**: Receive liquidity provider tokens representing your share
- **No KYC**: Fully decentralized and permissionless

---

## 🏗️ Architecture

### Smart Contracts

- **SimpleAMMFactory.sol** - Creates and manages trading pairs
- **SimpleAMMRouter.sol** - Handles swaps and liquidity operations
- **SimpleAMMPair.sol** - Core AMM logic for each trading pair
- **TestToken.sol** - Test tokens (NBC, SDR, PHL, QBT) for development

### Frontend (Next.js)

- **Swap Tab** - Token swapping interface
- **Liquidity Tab** - Add/remove liquidity, view pools
- **Faucet Tab** - Get test tokens for testing

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MetaMask with Arc Testnet configured
- Test tokens from Faucet tab

### Installation

```bash
# Clone repository
cd arc/arc-02

# Install contracts
cd contracts
npm install

# Install frontend
cd ../frontend
npm install
```

### Deploy Contracts

```bash
cd contracts

# 1. Deploy test tokens
npx hardhat run scripts/deployTestTokens.ts --network arc

# 2. Deploy AMM Factory
npx hardhat run scripts/deployAmmFactory.ts --network arc

# 3. Deploy AMM Router
npx hardhat run scripts/deployAmmRouter.ts --network arc

# 4. Create trading pairs (optional)
npx hardhat run scripts/createAmmPairs.ts --network arc
```

### Run Frontend

```bash
cd frontend
npm run dev
# Open http://localhost:3000
```

---

## 📦 Contract Addresses (Arc Testnet)

| Contract | Address | Description |
|----------|---------|-------------|
| **USDC** | `0x3600000000000000000000000000000000000000` | Circle USDC (6 decimals) |
| **EURC** | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | Circle EURC (6 decimals) |
| **Factory** | [See deployments/amm-factory.json] | Creates trading pairs |
| **Router** | [See deployments/amm-router.json] | Handles swaps & liquidity |

**Explorer:** https://testnet.arcscan.app

---

## ⚙️ Configuration

### AMM Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| **Trading Fee** | 0.3% | Fee per swap (retained in pool) |
| **Formula** | x * y = k | Constant product AMM |
| **LP Tokens** | ERC20 | Represent liquidity share |
| **Pair Creation** | Permissionless | Anyone can create pairs |

### Supported Tokens

| Token | Symbol | Decimals | Type |
|-------|--------|----------|------|
| **USDC** | USDC | 6 | Stablecoin (Circle) |
| **EURC** | EURC | 6 | Stablecoin (Circle) |
| **NBC** | NBC | 18 | Test Token |
| **SDR** | SDR | 18 | Test Token |
| **PHL** | PHL | 18 | Test Token |
| **QBT** | QBT | 18 | Test Token |

### Network Details

```
Network Name: Arc Testnet
Chain ID: 5042002
RPC URL: https://rpc.testnet.arc.network
Currency Symbol: USDC
Block Explorer: https://testnet.arcscan.app
```

---

## 🔧 Development

### Test Scripts

```bash
cd contracts

# Create a new trading pair
npx hardhat run scripts/createTestTokenPair.ts --network arc

# Add liquidity to a pair
npx hardhat run scripts/addLiquiditySample.ts --network arc

# Remove liquidity from a pair
npx hardhat run scripts/removeLiquiditySample.ts --network arc

# Execute a token swap
npx hardhat run scripts/swapSample.ts --network arc
```

### Frontend Development

```bash
cd frontend

# Run dev server
npm run dev

# Build for production
npm run build
```

---

## 📚 User Flows

### Swap Tokens

1. **Connect Wallet** → Arc Testnet
2. **Select Tokens** → Choose token to swap from/to
3. **Enter Amount** → Input amount to swap
4. **Approve** → Approve token spending (first time only)
5. **Swap** → Execute swap transaction
6. **Receive Tokens** → Get tokens in your wallet

### Add Liquidity

1. **Navigate to Liquidity Tab**
2. **Select Pair** → Choose token pair (e.g., EURC/NBC)
3. **Enter Amounts** → Input amounts for both tokens
4. **Approve Tokens** → Approve both tokens (first time only)
5. **Add Liquidity** → Execute transaction
6. **Receive LP Tokens** → Get LP tokens representing your share

### Remove Liquidity

1. **Navigate to Liquidity Tab**
2. **Click "Manage"** → On the pair you want to remove from
3. **Switch to Remove Tab**
4. **Enter LP Amount** → Amount of LP tokens to burn
5. **Approve LP** → Approve LP tokens (first time only)
6. **Remove Liquidity** → Execute transaction
7. **Receive Tokens** → Get both tokens back

---

## 🛠️ Tech Stack

**Smart Contracts:**
- Solidity 0.8.20
- Hardhat
- Uniswap V2-style AMM

**Frontend:**
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- wagmi + viem
- react-hot-toast

---

## 🔐 Security Features

- ✅ **ReentrancyGuard**: All fund transfers protected
- ✅ **Token Sorting**: Automatic token0/token1 ordering
- ✅ **Slippage Protection**: User-defined slippage tolerance
- ✅ **Safe Math**: Overflow/underflow protection
- ✅ **Access Control**: Factory owner controls (optional)

---

## 📊 How It Works

### Constant Product Formula

The AMM uses the formula: `x * y = k`

- `x` = Reserve of token0
- `y` = Reserve of token1
- `k` = Constant (must remain constant after swaps)

### Trading Fees

- 0.3% fee per swap
- Fees are retained in the pool (increase k)
- LP providers earn fees proportionally to their share

### Price Impact

Price impact increases with swap size:
- Small swaps: Low impact
- Large swaps: High impact (slippage)

---

## 📖 Resources

- **Circle Faucet**: https://faucet.circle.com/
- **Arc Testnet Docs**: https://docs.arc.network
- **Block Explorer**: https://testnet.arcscan.app

---

## 📄 License

MIT License

---

## 🤝 Contributing

This is a testnet project for demonstration purposes.

---

**Built with ❤️ on Arc Testnet**
