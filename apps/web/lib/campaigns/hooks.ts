"use client";

import { useEffect, useSyncExternalStore } from "react";
import { campaignStore } from "./store";
import type { CampaignRecord } from "./types";
import { DemoZamaProvider } from "@/lib/zama/demo-provider";
import {
  DEMO_CAMPAIGN,
  DEMO_RECIPIENTS,
  DEMO_TOKEN_ADDRESS,
} from "@/lib/demo/data";

const DEMO_ADMIN = "0xC10a40000000000000000000000000000000a0ps";
const DEMO_CONTRACT = "0xC10a4000000000000000000000000000000C0a4e";

let seedPromise: Promise<void> | null = null;
let seedDone = false;
const seedListeners = new Set<() => void>();

function markSeedDone() {
  seedDone = true;
  seedListeners.forEach((l) => l());
}

async function seedDemoCampaign() {
  if (campaignStore.get("1")) return;
  const provider = new DemoZamaProvider();
  const enc = await provider.encryptBatch(DEMO_CONTRACT, DEMO_ADMIN, DEMO_RECIPIENTS);
  if (campaignStore.get("1")) return; // re-check after async

  const now = Math.floor(Date.now() / 1000);
  const campaign: CampaignRecord = {
    id: "1",
    onChainId: 1,
    name: DEMO_CAMPAIGN.name,
    metadataURI: "ipfs://cloakops-demo",
    campaignType: DEMO_CAMPAIGN.campaignType,
    totalBudget: DEMO_CAMPAIGN.totalBudget,
    tokenAddress: DEMO_TOKEN_ADDRESS,
    admin: DEMO_ADMIN,
    claimStart: now,
    claimEnd: now + DEMO_CAMPAIGN.claimWindowDays * 86400,
    recipients: enc.recipients.map((r, i) => ({
      ...r,
      role: DEMO_RECIPIENTS[i].role,
      claimed: false,
    })),
    createdAt: Date.now(),
    tokenOpsCampaignId: "tops_demoseed01",
    tokenOpsUrl: "https://app.tokenops.xyz/campaigns/tops_demoseed01",
    notes: DEMO_CAMPAIGN.notes,
    source: "demo",
  };
  campaignStore.upsert(campaign);
}

/** Seeds the flagship demo campaign once, so claim/audit pages work out of the box. */
export function useDemoSeed() {
  useEffect(() => {
    if (!seedPromise) {
      seedPromise = seedDemoCampaign()
        .catch((e) => {
          console.error("demo seed failed", e);
        })
        .finally(markSeedDone);
    }
  }, []);
}

/** True once the initial demo-seed attempt has completed (for loading states). */
export function useSeedReady(): boolean {
  return useSyncExternalStore(
    (cb) => {
      seedListeners.add(cb);
      return () => seedListeners.delete(cb);
    },
    () => seedDone,
    () => false,
  );
}

export function useCampaigns(): CampaignRecord[] {
  useDemoSeed();
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
