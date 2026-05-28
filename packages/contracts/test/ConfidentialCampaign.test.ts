import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ConfidentialCampaign, CloakConfidentialToken } from "../typechain-types";

const CampaignType = {
  PrivateRound: 0,
  ContributorReward: 1,
  AdvisorVesting: 2,
  CommunityDistribution: 3,
} as const;

async function now(): Promise<number> {
  const block = await ethers.provider.getBlock("latest");
  return block!.timestamp;
}

describe("ConfidentialCampaign", () => {
  let campaign: ConfidentialCampaign;
  let token: CloakConfidentialToken;
  let contractAddress: string;
  let admin: HardhatEthersSigner;
  let alice: HardhatEthersSigner; // recipient
  let bob: HardhatEthersSigner; // recipient
  let mallory: HardhatEthersSigner; // non-recipient

  beforeEach(async () => {
    [admin, alice, bob, mallory] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("CloakConfidentialToken");
    token = (await Token.deploy(
      "CloakOps Confidential Token",
      "cCLOAK",
    )) as unknown as CloakConfidentialToken;
    await token.waitForDeployment();

    const Campaign = await ethers.getContractFactory("ConfidentialCampaign");
    campaign = (await Campaign.deploy()) as unknown as ConfidentialCampaign;
    await campaign.waitForDeployment();
    contractAddress = await campaign.getAddress();
  });

  async function createCampaign(opts?: { start?: number; end?: number }) {
    const t = await now();
    const start = opts?.start ?? t;
    const end = opts?.end ?? t + 30 * 24 * 3600;
    const tx = await campaign
      .connect(admin)
      .createCampaign(
        "AI x Crypto Seed Contributors",
        "ipfs://demo",
        CampaignType.PrivateRound,
        1_000_000n,
        start,
        end,
        await token.getAddress(),
      );
    await tx.wait();
    return Number(await campaign.campaignCount());
  }

  async function addRecipient(
    campaignId: number,
    recipient: string,
    amount: number,
    tier: number,
    vesting: number,
  ) {
    const input = fhevm.createEncryptedInput(contractAddress, admin.address);
    input.add64(amount);
    input.add8(tier);
    input.add8(vesting);
    const enc = await input.encrypt();
    const tx = await campaign
      .connect(admin)
      .addRecipient(
        campaignId,
        recipient,
        enc.handles[0],
        enc.handles[1],
        enc.handles[2],
        enc.inputProof,
      );
    await tx.wait();
  }

  describe("campaign creation", () => {
    it("creates a campaign with public metadata", async () => {
      const id = await createCampaign();
      expect(id).to.eq(1);

      const c = await campaign.getPublicCampaign(id);
      expect(c.admin).to.eq(admin.address);
      expect(c.name).to.eq("AI x Crypto Seed Contributors");
      expect(c.campaignType).to.eq(CampaignType.PrivateRound);
      expect(c.totalBudget).to.eq(1_000_000n);
      expect(c.recipientCount).to.eq(0n);
      expect(c.claimedCount).to.eq(0n);
      expect(c.exists).to.eq(true);
    });

    it("rejects an invalid claim window", async () => {
      const t = await now();
      await expect(
        campaign
          .connect(admin)
          .createCampaign("bad", "", 0, 1n, t + 100, t + 100, await token.getAddress()),
      ).to.be.revertedWithCustomError(campaign, "InvalidClaimWindow");
    });

    it("reverts reads for a non-existent campaign", async () => {
      await expect(campaign.getPublicCampaign(99)).to.be.revertedWithCustomError(
        campaign,
        "CampaignDoesNotExist",
      );
    });
  });

  describe("recipients", () => {
    it("adds a recipient and increments the public count", async () => {
      const id = await createCampaign();
      await addRecipient(id, alice.address, 25_000, 2, 1);

      expect(await campaign.isEligible(id, alice.address)).to.eq(true);
      expect(await campaign.isEligible(id, bob.address)).to.eq(false);

      const c = await campaign.getPublicCampaign(id);
      expect(c.recipientCount).to.eq(1n);
    });

    it("only the admin can add recipients", async () => {
      const id = await createCampaign();
      // Exercise the onlyAdmin modifier via eth_call (staticCall) with empty
      // arrays: this surfaces the custom error cleanly without routing encrypted
      // inputs through the FHEVM mock's send path.
      await expect(
        campaign
          .connect(mallory)
          .batchAddRecipients.staticCall(id, [], [], [], [], "0x"),
      ).to.be.revertedWithCustomError(campaign, "NotCampaignAdmin");
    });

    it("stores an encrypted allocation that the recipient can decrypt", async () => {
      const id = await createCampaign();
      await addRecipient(id, alice.address, 25_000, 2, 1);

      const encAmount = await campaign.getEncryptedAllocation(id, alice.address);
      const clearAmount = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encAmount,
        contractAddress,
        alice,
      );
      expect(clearAmount).to.eq(25_000n);

      const encTier = await campaign.getEncryptedTier(id, alice.address);
      const clearTier = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        encTier,
        contractAddress,
        alice,
      );
      expect(clearTier).to.eq(2n);

      const encVesting = await campaign.getEncryptedVestingClass(id, alice.address);
      const clearVesting = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        encVesting,
        contractAddress,
        alice,
      );
      expect(clearVesting).to.eq(1n);
    });

    it("does not let a different recipient decrypt someone else's allocation", async () => {
      const id = await createCampaign();
      await addRecipient(id, alice.address, 25_000, 2, 1);

      const encAmount = await campaign.getEncryptedAllocation(id, alice.address);
      // Bob is not on the FHE ACL for Alice's handle.
      await expect(
        fhevm.userDecryptEuint(FhevmType.euint64, encAmount, contractAddress, bob),
      ).to.be.rejected;
    });

    it("batch-adds multiple recipients under one proof", async () => {
      const id = await createCampaign();
      const input = fhevm.createEncryptedInput(contractAddress, admin.address);
      // alice
      input.add64(25_000);
      input.add8(2);
      input.add8(1);
      // bob
      input.add64(150_000);
      input.add8(4);
      input.add8(3);
      const enc = await input.encrypt();

      const tx = await campaign.connect(admin).batchAddRecipients(
        id,
        [alice.address, bob.address],
        [enc.handles[0], enc.handles[3]],
        [enc.handles[1], enc.handles[4]],
        [enc.handles[2], enc.handles[5]],
        enc.inputProof,
      );
      await tx.wait();

      const c = await campaign.getPublicCampaign(id);
      expect(c.recipientCount).to.eq(2n);

      const encBob = await campaign.getEncryptedAllocation(id, bob.address);
      const clearBob = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encBob,
        contractAddress,
        bob,
      );
      expect(clearBob).to.eq(150_000n);
    });
  });

  describe("claim", () => {
    it("lets an eligible recipient claim and bumps the public claimed count", async () => {
      const id = await createCampaign();
      await addRecipient(id, alice.address, 25_000, 2, 1);

      expect(await campaign.hasClaimed(id, alice.address)).to.eq(false);
      await (await campaign.connect(alice).claim(id)).wait();
      expect(await campaign.hasClaimed(id, alice.address)).to.eq(true);

      const c = await campaign.getPublicCampaign(id);
      expect(c.claimedCount).to.eq(1n);
    });

    it("credits the recipient's confidential token balance on claim", async () => {
      const id = await createCampaign();
      await addRecipient(id, alice.address, 25_000, 2, 1);

      await (await campaign.connect(alice).claim(id)).wait();

      // The payout amount is credited via on-chain FHE.add and stays encrypted;
      // only the recipient can decrypt their resulting balance.
      const tokenAddress = await token.getAddress();
      const encBalance = await token.confidentialBalanceOf(alice.address);
      const clearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encBalance,
        tokenAddress,
        alice,
      );
      expect(clearBalance).to.eq(25_000n);
    });

    it("rejects claims from non-eligible accounts", async () => {
      const id = await createCampaign();
      await expect(campaign.connect(mallory).claim(id)).to.be.revertedWithCustomError(
        campaign,
        "NotEligible",
      );
    });

    it("rejects a double claim", async () => {
      const id = await createCampaign();
      await addRecipient(id, alice.address, 25_000, 2, 1);
      await (await campaign.connect(alice).claim(id)).wait();
      await expect(campaign.connect(alice).claim(id)).to.be.revertedWithCustomError(
        campaign,
        "AlreadyClaimed",
      );
    });

    it("rejects claims before the window opens", async () => {
      const t = await now();
      const id = await createCampaign({ start: t + 10_000, end: t + 20_000 });
      await addRecipient(id, alice.address, 25_000, 2, 1);
      await expect(campaign.connect(alice).claim(id)).to.be.revertedWithCustomError(
        campaign,
        "ClaimWindowNotOpen",
      );
    });
  });
});
