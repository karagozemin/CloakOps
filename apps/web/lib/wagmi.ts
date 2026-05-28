import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import { WALLETCONNECT_PROJECT_ID } from "./config";

const connectors = [
  injected({ shimDisconnect: true }),
  ...(WALLETCONNECT_PROJECT_ID
    ? [
        walletConnect({
          projectId: WALLETCONNECT_PROJECT_ID,
          showQrModal: true,
          metadata: {
            name: "CloakOps",
            description: "Confidential campaign layer for TokenOps.",
            url: "https://cloakops.app",
            icons: [],
          },
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors,
  transports: {
    [sepolia.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
