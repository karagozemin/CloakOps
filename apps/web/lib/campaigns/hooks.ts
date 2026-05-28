"use client";

import { useSyncExternalStore } from "react";
import { campaignStore } from "./store";
import type { CampaignRecord } from "./types";

export function useCampaigns(): CampaignRecord[] {
  return useSyncExternalStore(
    campaignStore.subscribe,
    campaignStore.getSnapshot,
    () => [],
  );
}

export function useCampaign(id: string): CampaignRecord | undefined {
  const campaigns = useCampaigns();
  return campaigns.find((c) => c.id === id || String(c.onChainId) === id);
}
