import {
  RealTokenOpsAdapter,
  type RealTokenOpsAdapterOptions,
} from "./real-adapter";
import type { TokenOpsCampaignAdapter } from "./types";

export function createTokenOpsAdapter(
  opts: RealTokenOpsAdapterOptions,
): TokenOpsCampaignAdapter {
  return new RealTokenOpsAdapter(opts);
}

export * from "./types";
export { RealTokenOpsAdapter, TokenOpsRealModeError } from "./real-adapter";
