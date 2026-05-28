import { ethers, fhevm, network } from "hardhat";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

/**
 * Seeds the on-chain demo campaign "AI x Crypto Seed Contributors":
 * 1,000,000 tokens split across investors, advisors, and contributors, where
 * each allocation/tier/vesting is encrypted with Zama FHE.
 *
 * Run AFTER `npm run deploy:sepolia` (reads deployments/<network>.json).
 */
const DEMO_RECIPIENTS = [
  { wallet: "0x1111111111111111111111111111111111111111", allocation: 25000, tier: 2, vestingClass: 1 },
  { wallet: "0x2222222222222222222222222222222222222222", allocation: 75000, tier: 3, vestingClass: 2 },
  { wallet: "0x3333333333333333333333333333333333333333", allocation: 150000, tier: 4, vestingClass: 3 },
  { wallet: "0x4444444444444444444444444444444444444444", allocation: 300000, tier: 5, vestingClass: 4 },
  { wallet: "0x5555555555555555555555555555555555555555", allocation: 450000, tier: 5, vestingClass: 4 },
];

async function main() {
  const depPath = join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!existsSync(depPath)) {
    throw new Error(
      `No deployment found at ${depPath}. Run the deploy script first.`,
    );
  }
  const dep = JSON.parse(readFileSync(depPath, "utf8"));
  const campaignAddress: string = dep.contracts.ConfidentialCampaign;
  const tokenAddress: string = dep.contracts.MockConfidentialToken;

  const [admin] = await ethers.getSigners();
  const campaign = await ethers.getContractAt("ConfidentialCampaign", campaignAddress);

  const block = await ethers.provider.getBlock("latest");
  const startTime = block!.timestamp; // open immediately
  const endTime = startTime + 60 * 24 * 3600; // 60 days

  console.log(`Creating campaign on ${network.name} as ${admin.address}…`);
  const createTx = await campaign.createCampaign(
    "AI x Crypto Seed Contributors",
    "ipfs://cloakops-demo",
    0, // CampaignType.PrivateRound
    1_000_000n,
    startTime,
    endTime,
    tokenAddress,
  );
  await createTx.wait();
  const campaignId = await campaign.campaignCount();
  console.log(`Campaign created with id ${campaignId}`);

  console.log("Encrypting recipient allocations with Zama FHE…");
  const input = fhevm.createEncryptedInput(campaignAddress, admin.address);
  for (const r of DEMO_RECIPIENTS) {
    input.add64(r.allocation);
    input.add8(r.tier);
    input.add8(r.vestingClass);
  }
  const enc = await input.encrypt();

  const amounts = DEMO_RECIPIENTS.map((_, i) => enc.handles[i * 3]);
  const tiers = DEMO_RECIPIENTS.map((_, i) => enc.handles[i * 3 + 1]);
  const vestings = DEMO_RECIPIENTS.map((_, i) => enc.handles[i * 3 + 2]);
  const wallets = DEMO_RECIPIENTS.map((r) => r.wallet);

  console.log("Submitting batchAddRecipients…");
  const addTx = await campaign.batchAddRecipients(
    campaignId,
    wallets,
    amounts,
    tiers,
    vestings,
    enc.inputProof,
  );
  await addTx.wait();

  const c = await campaign.getPublicCampaign(campaignId);
  console.log(`\nDone. Campaign #${campaignId}`);
  console.log(`  name:        ${c.name}`);
  console.log(`  recipients:  ${c.recipientCount}`);
  console.log(`  totalBudget: ${c.totalBudget}`);
  console.log(`  public claim window: ${c.claimStart} → ${c.claimEnd}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
