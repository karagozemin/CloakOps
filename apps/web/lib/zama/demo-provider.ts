import { sleep } from "@/lib/utils";
import type {
  BatchEncryptResult,
  EncryptedFieldType,
  RecipientPlain,
  ZamaProvider,
  ZamaStatus,
} from "./types";

const SECRETS_KEY = "cloakops.zama.demo.secrets.v1";

type SecretMap = Record<string, string>; // handle -> decimal string value

function loadSecrets(): SecretMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(SECRETS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveSecrets(map: SecretMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SECRETS_KEY, JSON.stringify(map));
}

function randomHandle(prefix: string): string {
  const bytes = new Uint8Array(20);
  (globalThis.crypto ?? crypto).getRandomValues(bytes);
  return (
    prefix +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * DemoZamaProvider — deterministic local FHE simulation.
 *
 * Encrypted values produce opaque random handles; the cleartext is stored in a
 * local secret map keyed by handle. Decryption returns the value only through
 * this provider. The UI gates `decryptValue` behind wallet ownership so the demo
 * faithfully reproduces the "only the recipient can decrypt" FHE guarantee.
 */
export class DemoZamaProvider implements ZamaProvider {
  readonly mode = "demo" as const;

  async getStatus(): Promise<ZamaStatus> {
    await sleep(120);
    return {
      mode: "demo",
      ready: true,
      message: "Zama demo encryption ready (deterministic local FHE simulation).",
    };
  }

  async encryptBatch(
    _contractAddress: string,
    _userAddress: string,
    recipients: RecipientPlain[],
  ): Promise<BatchEncryptResult> {
    await sleep(150 + recipients.length * 90);
    const secrets = loadSecrets();

    const encryptedRecipients = recipients.map((r) => {
      const amountHandle = randomHandle("0xa1");
      const tierHandle = randomHandle("0xb2");
      const vestingHandle = randomHandle("0xc3");
      secrets[amountHandle] = String(r.allocation);
      secrets[tierHandle] = String(r.tier);
      secrets[vestingHandle] = String(r.vestingClass);
      return {
        wallet: r.wallet,
        amountHandle,
        tierHandle,
        vestingHandle,
      };
    });

    saveSecrets(secrets);

    return {
      recipients: encryptedRecipients,
      inputProof: randomHandle("0xproof"),
    };
  }

  async decryptValue(
    handle: string,
    _contractAddress: string,
    _userAddress: string,
    _type: EncryptedFieldType,
  ): Promise<bigint> {
    await sleep(450);
    const secrets = loadSecrets();
    const value = secrets[handle];
    if (value === undefined) {
      throw new Error("Handle not found in local demo store.");
    }
    return BigInt(value);
  }
}
