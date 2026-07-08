import { ethers, network } from "hardhat";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Deploys the CloakOps contracts:
 *   - CloakConfidentialToken (cCLOAK confidential payout token)
 *   - ConfidentialCampaign   (the confidential campaign + claim layer)
 *
 * On Sepolia, ConfidentialCampaign inherits ZamaEthereumConfig and is wired to
 * the live FHEVM coprocessor automatically.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();

  console.log(`Network: ${network.name} (chainId ${net.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(
    `Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`,
  );

  const Token = await ethers.getContractFactory("CloakConfidentialToken");
  const token = await Token.deploy("CloakOps Confidential Token", "cCLOAK");
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`CloakConfidentialToken deployed: ${tokenAddress}`);

  const Campaign = await ethers.getContractFactory("ConfidentialCampaign");
  const campaign = await Campaign.deploy();
  await campaign.waitForDeployment();
  const campaignAddress = await campaign.getAddress();
  console.log(`ConfidentialCampaign deployed:   ${campaignAddress}`);

  // Authorize the campaign contract as a confidential-token distributor so it
  // can credit encrypted balances on claim().
  const authTx = await token.setDistributor(campaignAddress, true);
  await authTx.wait();
  console.log(`Campaign authorized as distributor on token.`);

  const record = {
    network: network.name,
    chainId: Number(net.chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      ConfidentialCampaign: campaignAddress,
      CloakConfidentialToken: tokenAddress,
    },
  };

  const dir = join(__dirname, "..", "deployments");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${network.name}.json`),
    JSON.stringify(record, null, 2),
  );

  console.log("\nDeployment saved to deployments/" + network.name + ".json");
  console.log("\nNext steps:");
  console.log(
    `  1. Set in your frontend env (apps/web/.env.local):\n` +
      `     NEXT_PUBLIC_CLOAKOPS_CONTRACT_ADDRESS=${campaignAddress}\n` +
      `     NEXT_PUBLIC_CLOAKOPS_TOKEN_ADDRESS=${tokenAddress}`,
  );
  console.log("  2. Export the ABI to the web app:\n     npm run export-abi");
  console.log(
    `  3. (Optional) Seed the demo campaign:\n     npm run demo-campaign`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
