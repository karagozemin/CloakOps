import type { CampaignRecord, RecipientRecord } from "./types";

const STORAGE_KEY = "cloakops.campaigns.v1";

let cache: CampaignRecord[] | null = null;
const listeners = new Set<() => void>();

function read(): CampaignRecord[] {
  if (cache) return cache;
  if (typeof window === "undefined") return [];
  try {
    cache = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    cache = [];
  }
  return cache!;
}

function write(next: CampaignRecord[]) {
  cache = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

export const campaignStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot(): CampaignRecord[] {
    return read();
  },

  list(): CampaignRecord[] {
    return read();
  },

  get(id: string): CampaignRecord | undefined {
    return read().find((c) => c.id === id || String(c.onChainId) === id);
  },

  upsert(campaign: CampaignRecord) {
    const all = read();
    const idx = all.findIndex((c) => c.id === campaign.id);
    const next = [...all];
    if (idx >= 0) next[idx] = campaign;
    else next.unshift(campaign);
    write(next);
  },

  markClaimed(id: string, wallet: string) {
    const all = read();
    const next = all.map((c) => {
      if (c.id !== id && String(c.onChainId) !== id) return c;
      return {
        ...c,
        recipients: c.recipients.map((r) =>
          r.wallet.toLowerCase() === wallet.toLowerCase()
            ? { ...r, claimed: true }
            : r,
        ),
      };
    });
    write(next);
  },

  addRecipient(id: string, recipient: RecipientRecord) {
    const all = read();
    const next = all.map((c) => {
      if (c.id !== id && String(c.onChainId) !== id) return c;
      if (
        c.recipients.some(
          (r) => r.wallet.toLowerCase() === recipient.wallet.toLowerCase(),
        )
      ) {
        return c;
      }
      return { ...c, recipients: [...c.recipients, recipient] };
    });
    write(next);
  },

  reset() {
    write([]);
  },
};

export function findRecipient(
  campaign: CampaignRecord,
  wallet?: string,
): RecipientRecord | undefined {
  if (!wallet) return undefined;
  return campaign.recipients.find(
    (r) => r.wallet.toLowerCase() === wallet.toLowerCase(),
  );
}
