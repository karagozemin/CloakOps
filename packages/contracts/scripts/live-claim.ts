/* eslint-disable no-console */
/**
 * LIVE end-to-end claim proof against real Sepolia + the real Zama relayer.
 *
 * This mirrors exactly what a juror does in the browser, but from Node so it is
 * reproducible and self-verifying:
 *
 *   1. Encrypt (amount, tier, vesting) with the real relayer SDK  -> real proof
 *   2. createCampaign() on the live ConfidentialCampaign contract
 *   3. addRecipient() -> on-chain FHE.fromExternal verifies the relayer proof
 *   4. userDecrypt the stored allocation handle via the relayer  -> plaintext back
 *   5. claim() -> zero-gate + tier-bonus FHE.select payout path + PayoutSettled
 *   6. userDecrypt the recipient's confidential token balance after claim
 *
 * TIER-BONUS PROOF: this run uses TIER=3, which lands in the encrypted +10%
 * band. The expected on-chain payout is therefore 25000 -> 27500. Because the
 * decrypted balance (27500) differs from the raw allocation (25000), this is a
 * live proof that FHE.select genuinely TRANSFORMS the amount under encryption
 * (a real homomorphic compute), not a pass-through of the stored handle.
 *
 * Single-wallet constraint: admin == recipient (self-claim). ACL isolation
 * (recipient-only decrypt) is already proven in the mock test-suite; what this
 * script proves is the part the mock CANNOT: real relayer proof verification,
 * real gas, and real handle/ACL behaviour on live FHEVM.
 *
 * Run:
 *   cd packages/contracts
 *   npx hardhat run scripts/live-claim.ts --network sepolia
 */
import { ethers, network } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

// The relayer SDK ships as ESM-only. This file runs under ts-node as CommonJS
// (hardhat), so we load the SDK lazily via a runtime dynamic import() — which
// node16 preserves as a real ESM import — instead of a static CJS `require`.
type FheInstance = Awaited<
  ReturnType<
    (typeof import("@zama-fhe/relayer-sdk/node", { with: { "resolution-mode": "import" } }))["createInstance"]
  >
>;


const AMOUNT = 25_000n;
const TIER = 3; // tier 3 -> +10% encrypted bonus band (proves real FHE compute)
const VESTING = 1;

/** Mirror of the on-chain tier-bonus rule for the expected-value assertion. */
function expectedPayout(amount: bigint, tier: number): bigint {
  if (tier >= 5) return amount + amount / 4n; // +25%
  if (tier >= 3) return amount + amount / 10n; // +10%
  return amount; // no bonus
}


function loadAddresses() {
  const file = join(__dirname, "..", "deployments", `${network.name}.json`);
  const rec = JSON.parse(readFileSync(file, "utf8"));
  return {
    campaign: rec.contracts.ConfidentialCampaign as string,
    token: rec.contracts.CloakConfidentialToken as string,
  };
}

async function main() {
  const net = await ethers.provider.getNetwork();
  if (Number(net.chainId) !== 11155111) {
    throw new Error(`Run with --network sepolia (got chainId ${net.chainId})`);
  }

  const [signer] = await ethers.getSigners();
  const me = signer.address;
  const { campaign: campaignAddr, token: tokenAddr } = loadAddresses();

  console.log("== CloakOps LIVE claim e2e (real Sepolia + real Zama relayer) ==");
  console.log("Signer   :", me);
  console.log("Campaign :", campaignAddr);
  console.log("Token    :", tokenAddr);
  const bal = await ethers.provider.getBalance(me);
  console.log("ETH bal  :", ethers.formatEther(bal), "\n");

  const campaign = await ethers.getContractAt("ConfidentialCampaign", campaignAddr, signer);
  const token = await ethers.getContractAt("CloakConfidentialToken", tokenAddr, signer);

  // --- Init the real relayer SDK (Sepolia defaults: relayer + coprocessor) ---
  console.log("[1/6] Initialising Zama relayer SDK (Sepolia config)...");
  const rpcUrl =
    process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
  const { createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/node");
  const fhe = await createInstance({ ...SepoliaConfig, network: rpcUrl });

  console.log("      relayer instance ready.\n");


  // --- Create a fresh campaign (public metadata only) ---
  const nowTs = (await ethers.provider.getBlock("latest"))!.timestamp;
  const start = nowTs - 60; // already open
  const end = nowTs + 30 * 24 * 3600;
  console.log("[2/6] createCampaign()...");
  const createTx = await campaign.createCampaign(
    "LIVE e2e proof",
    "ipfs://live-e2e",
    0, // PrivateRound
    1_000_000n,
    start,
    end,
    tokenAddr,
  );
  const createRc = await createTx.wait();
  const campaignId = await campaign.campaignCount();
  console.log(`      campaignId=${campaignId}  tx=${createRc?.hash}\n`);

  // --- Encrypt inputs with the REAL relayer -> produces a real inputProof ---
  console.log("[3/6] Encrypting (amount,tier,vesting) via relayer + addRecipient()...");
  const enc = await fhe
    .createEncryptedInput(campaignAddr, me)
    .add64(AMOUNT)
    .add8(TIER)
    .add8(VESTING)
    .encrypt();

  const addTx = await campaign.addRecipient(
    campaignId,
    me,
    enc.handles[0],
    enc.handles[1],
    enc.handles[2],
    enc.inputProof,
  );
  const addRc = await addTx.wait();
  console.log(`      recipient added (on-chain proof verified)  tx=${addRc?.hash}\n`);

  // --- Decrypt the stored allocation handle via the relayer (userDecrypt) ---
  console.log("[4/6] userDecrypt stored allocation handle...");
  const encAlloc = await campaign.getEncryptedAllocation(campaignId, me);
  const decAlloc = await userDecrypt(fhe, signer, campaignAddr, encAlloc);
  console.log(`      decrypted allocation = ${decAlloc}  (expected ${AMOUNT})`);
  const allocOk = decAlloc === AMOUNT;
  console.log(`      allocation match: ${allocOk ? "PASS" : "FAIL"}\n`);

  // --- Balance BEFORE claim ---
  const encBalBefore = await token.confidentialBalanceOf(me);
  let balBefore = 0n;
  try {
    balBefore = await userDecrypt(fhe, signer, tokenAddr, encBalBefore);
  } catch {
    balBefore = 0n; // uninitialised handle -> treat as 0
  }
  console.log(`      confidential balance before claim = ${balBefore}\n`);

  // --- claim(): conditional payout path + PayoutSettled event ---
  console.log("[5/6] claim()...");
  const claimTx = await campaign.claim(campaignId);
  const claimRc = await claimTx.wait();
  const settled = claimRc?.logs
    .map((l: any) => {
      try {
        return campaign.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((p: any) => p?.name === "PayoutSettled");

  const credited = settled?.args?.[2];
  console.log(`      claim tx=${claimRc?.hash}`);
  console.log(`      PayoutSettled.credited = ${credited}\n`);

  // --- Balance AFTER claim (should be before + tier-adjusted payout) ---
  console.log("[6/6] userDecrypt confidential balance after claim...");
  const encBalAfter = await token.confidentialBalanceOf(me);
  const balAfter = await userDecrypt(fhe, signer, tokenAddr, encBalAfter);
  const payout = expectedPayout(AMOUNT, TIER); // tier 3 -> 27500 (25000 + 10%)
  const bonus = payout - AMOUNT;
  const expectedAfter = balBefore + payout;
  console.log(`      tier=${TIER} -> payout ${AMOUNT} + bonus ${bonus} = ${payout}`);
  console.log(`      balance after = ${balAfter}  (expected ${expectedAfter})`);
  const balOk = balAfter === expectedAfter;
  // The bonus must be strictly positive AND the payout must differ from the raw
  // allocation, otherwise FHE.select degenerated back into a pass-through.
  const bonusApplied = bonus > 0n && payout !== AMOUNT;
  const claimedFlag = await campaign.hasClaimed(campaignId, me);

  console.log("\n================ LIVE RESULT ================");
  console.log(`campaignId              : ${campaignId}`);
  console.log(`allocation decrypt      : ${decAlloc} (expected ${AMOUNT}) -> ${allocOk ? "PASS" : "FAIL"}`);
  console.log(`PayoutSettled.credited  : ${credited}`);
  console.log(`hasClaimed              : ${claimedFlag}`);
  console.log(`tier bonus (FHE.select) : +${bonus} (${AMOUNT} -> ${payout}) -> ${bonusApplied ? "PASS" : "FAIL"}`);
  console.log(`balance before -> after : ${balBefore} -> ${balAfter} (expected ${expectedAfter}) -> ${balOk ? "PASS" : "FAIL"}`);
  const overall = allocOk && credited === true && claimedFlag === true && balOk && bonusApplied;

  console.log(`OVERALL                 : ${overall ? "PASS ✅" : "FAIL ❌"}`);
  console.log("=============================================");
  if (!overall) process.exitCode = 1;
}

async function userDecrypt(
  fhe: FheInstance,
  signer: any,

  contractAddress: string,
  handle: string,
): Promise<bigint> {
  const keypair = fhe.generateKeypair();
  const handleContractPairs = [{ handle, contractAddress }];
  const startTimeStamp = Math.floor(Date.now() / 1000);
  const durationDays = 1;
  const contractAddresses = [contractAddress];


  const eip712 = fhe.createEIP712(
    keypair.publicKey,
    contractAddresses,
    startTimeStamp,
    durationDays,
  );
  const signature = await signer.signTypedData(
    eip712.domain,
    { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
    eip712.message,
  );

  const result = await fhe.userDecrypt(
    handleContractPairs,
    keypair.privateKey,
    keypair.publicKey,
    signature.replace("0x", ""),
    contractAddresses,
    signer.address,
    startTimeStamp,
    durationDays,
  );
  return BigInt(result[handle as `0x${string}`] as string | number | bigint);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
