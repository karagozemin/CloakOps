import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-network-helpers";
import "@typechain/hardhat";

import type { HardhatUserConfig } from "hardhat/config";

// Load root .env first, then a local package .env as override.
dotenvConfig({ path: resolve(__dirname, "../../.env") });
dotenvConfig({ path: resolve(__dirname, ".env") });

const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 800,
      },
      evmVersion: "cancun",
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      // FHEVM mock mode runs here by default via @fhevm/hardhat-plugin.
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  mocha: {
    timeout: 120000,
  },
};

export default config;
