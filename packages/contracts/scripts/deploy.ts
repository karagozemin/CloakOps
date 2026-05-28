import { ethers, network } from "hardhat";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Deploys the CloakOps contracts:
 *   - MockConfidentialToken (demo campaign token reference)
 *   - ConfidentialCampaign  (the confidential campaign + claim layer)
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

  const Token = await ethers.getContractFactory("MockConfidentialToken");
  const token = await Token.deploy(
    "CloakOps Demo Token",
    "cDEMO",
    18,
    ethers.parseEther("10000000"),
  );
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`MockConfidentialToken deployed: ${tokenAddress}`);

  const Campaign = await ethers.getContractFactory("ConfidentialCampaign");
  const campaign = await Campaign.deploy();
  await campaign.waitForDeployment();
  const campaignAddress = await campaign.getAddress();
  console.log(`ConfidentialCampaign deployed:  ${campaignAddress}`);

  const record = {
    network: network.name,
    chainId: Number(net.chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      ConfidentialCampaign: campaignAddress,
      MockConfidentialToken: tokenAddress,
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
    `  1. Set in your frontend env:\n     NEXT_PUBLIC_CLOAKOPS_CONTRACT_ADDRESS=${campaignAddress}`,
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
