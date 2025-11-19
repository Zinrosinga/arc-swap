import { createConfig, http } from 'wagmi';
import { sepolia, baseSepolia, arbitrumSepolia, optimismSepolia } from 'wagmi/chains';
import { defineChain } from 'viem';
import { injected } from 'wagmi/connectors';

// Define Arc Testnet (Main network)
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
});

// Supported chains (5 testnets for bridge)
export const chains = [
  arcTestnet,
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia,
] as const;

// Network configs for UI (centralized)
export const networksConfig = [
  {
    id: arcTestnet.id,
    name: arcTestnet.name,
    icon: '/arc.svg',
  },
  {
    id: sepolia.id,
    name: sepolia.name,
    icon: '/eth.svg',
  },
] as const;

// Wagmi configuration
export const wagmiConfig = createConfig({
  chains,
  connectors: [
    // injected() tự động detect: MetaMask, OKX, Coinbase, Trust, etc.
    injected(),
  ],
  transports: {
    [arcTestnet.id]: http('https://rpc.testnet.arc.network'),
    [sepolia.id]: http('https://ethereum-sepolia.publicnode.com'),
    [baseSepolia.id]: http('https://sepolia.base.org'),
    [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
    [optimismSepolia.id]: http('https://sepolia.optimism.io'),
  },
  ssr: false,
});
