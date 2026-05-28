import { ethers, network } from "hardhat";

const TOKEN_ADDRESS =
  process.env.CDEMO_TOKEN_ADDRESS ??
  "0x64b18e14F1A47C4152a69Ad12e50C6B9F0c6dd2E";

/**
 * Mint cDEMO to a wallet on Sepolia.
 *
 * Usage:
 *   RECIPIENT=0xYourWallet npm run mint-cdemo --workspace=@cloakops/contracts
 *   # or
 *   npx hardhat run scripts/mint-cdemo.ts --network sepolia
 *   (mints to the signer if RECIPIENT is unset)
 */
async function main() {
  const [signer] = await ethers.getSigners();
  const recipient = process.env.RECIPIENT ?? signer.address;
  const amount = ethers.parseEther(process.env.MINT_AMOUNT ?? "1000000");

  console.log(`Network:  ${network.name}`);
  console.log(`Token:    ${TOKEN_ADDRESS}`);
  console.log(`Signer:   ${signer.address}`);
  console.log(`Recipient:${recipient}`);
  console.log(`Amount:   ${ethers.formatEther(amount)} cDEMO\n`);

  const token = await ethers.getContractAt("MockConfidentialToken", TOKEN_ADDRESS);
  const before = await token.balanceOf(recipient);
  console.log(`Balance before: ${ethers.formatEther(before)} cDEMO`);

  const tx = await token.mint(recipient, amount);
  console.log(`Mint tx: ${tx.hash}`);
  await tx.wait();

  const after = await token.balanceOf(recipient);
  console.log(`Balance after:  ${ethers.formatEther(after)} cDEMO`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
