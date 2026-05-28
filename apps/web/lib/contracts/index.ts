import { confidentialCampaignAbi } from "./confidential-campaign-abi";
import { CLOAKOPS_CONTRACT_ADDRESS } from "@/lib/config";

export { confidentialCampaignAbi };

/** True when a live ConfidentialCampaign contract address is configured. */
export const hasLiveContract = Boolean(CLOAKOPS_CONTRACT_ADDRESS);

export function getContractConfig() {
  if (!CLOAKOPS_CONTRACT_ADDRESS) return null;
  return {
    address: CLOAKOPS_CONTRACT_ADDRESS as `0x${string}`,
    abi: confidentialCampaignAbi,
  } as const;
}
