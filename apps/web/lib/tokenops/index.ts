import { DemoTokenOpsAdapter } from "./demo-adapter";
import {
  RealTokenOpsAdapter,
  type RealTokenOpsAdapterOptions,
} from "./real-adapter";
import type { TokenOpsCampaignAdapter, TokenOpsMode } from "./types";

export function createTokenOpsAdapter(
  mode: TokenOpsMode,
  opts: RealTokenOpsAdapterOptions,
): TokenOpsCampaignAdapter {
  if (mode === "real") {
    return new RealTokenOpsAdapter(opts);
  }
  return new DemoTokenOpsAdapter(opts);
}

export * from "./types";
export { DemoTokenOpsAdapter } from "./demo-adapter";
export { RealTokenOpsAdapter, TokenOpsRealModeError } from "./real-adapter";
