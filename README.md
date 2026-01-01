# 🔄 ArcSwap: High-Fidelity AMM Protocol

**ArcSwap** is the foundational liquidity layer of the Arc Network, providing a professional-grade automated market maker (AMM) experience. It combines the reliability of constant-product mathematics with advanced routing and institutional-level trading analytics.

---

## ✨ Key Features & Technical Highlights

### 🛡️ Battle-Tested AMM Logic
Built on the **Constant Product Formula (`x * y = k`)**, ArcSwap ensures continuous liquidity regardless of order size. The smart contracts are optimized for gas efficiency and high-speed execution on the Arc Testnet.

### 🛣️ Intelligent Multi-Hop Routing
Never worry about missing liquidity pairs. ArcSwap's routing engine automatically executes complex multi-segment trades, bridging through **USDC** or **EURC** to connect any two assets in the ecosystem seamlessly.

### 📊 Real-Time Institutional Analytics
Trade with precision using our advanced data engine:
- **Price Impact Visualization**: See exactly how your trade affects the pool before execution.
- **Dynamic Slippage Control**: Auto-suggested slippage based on volatility, with full manual override.
- **Transaction Clarity**: Real-time display of "Minimum Received" and "Exchange Rate" to guarantee trade transparency.

### 💰 Yield Engine for Liquidity Providers
Turn your idle assets into a revenue stream.
- **Trading Fee Revenue**: Liquidity providers earn a **0.3% fee** on every swap, compounded directly into the pool.
- **Permissionless Pair Creation**: The `AmmFactory` allows anyone to bootstrap new token markets instantly.

### ⚡ Native Arc Network Optimization
Engineered to leverage the unique advantages of Arc:
- **USDC Native Gas**: Fully compatible with Arc's ability to use USDC for gas fees, eliminating the need for separate gas tokens.
- **Instant Finality**: Designed to match Arc's sub-second block times for a near-instant trading experience.

---

## 🏗 Project Structure

The project is architected for transparency and scalability:

- **`/contracts`**: The core protocol layer containing the `AmmFactory` (registry), `AmmRouter` (execution), and `AmmPair` (liquidity pools) implemented in Solidity.
- **`/frontend`**: A high-performance trading terminal built with **Next.js 15 (App Router)** and **Tailwind CSS 4**, providing a premium user experience.

---

## 🚀 Quick Start

### 1. Smart Contract Deployment
Launch the full AMM stack on the Arc Network:
```bash
cd contracts
npm install

# 1️⃣ Deploy Market Tokens (USDC, EURC, NBC, SDR, NYRA...)
npx hardhat run scripts/deployTestTokens.ts --network arc

# 2️⃣ Deploy AMM Factory (Manager of all pools)
npx hardhat run scripts/deployAmmFactory.ts --network arc

# 3️⃣ Deploy AMM Router (User execution entry-point)
npx hardhat run scripts/deployAmmRouter.ts --network arc

# 4️⃣ Seed Initial Trading Pairs
npx hardhat run scripts/createAmmPairs.ts --network arc
```

### 2. Frontend Launch
Run the decentralized trading interface:
```bash
cd frontend
npm install
npm run genabi # Sync pool contracts and current deployments
npm run dev
```

---

## 🛠 Tech Stack
- **Smart Contracts**: Solidity 0.8.20, Hardhat, OpenZeppelin.
- **Frontend**: Next.js 15, React 19, Tailwind CSS 4, Wagmi/Viem.
- **Network**: Arc Testnet (Chain ID: `5042002`).

---

## 📄 License
MIT

**Built on Arc Network**
