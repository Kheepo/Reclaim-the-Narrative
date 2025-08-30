import { ethers } from "hardhat";

async function main() {
  console.log("Deploying GBVReportRegistry contract...");

  const GBVReportRegistry = await ethers.getContractFactory("GBVReportRegistry");
  const gbvReportRegistry = await GBVReportRegistry.deploy();

  await gbvReportRegistry.waitForDeployment();

  const contractAddress = await gbvReportRegistry.getAddress();
  console.log("GBVReportRegistry deployed to:", contractAddress);

  // Save deployment info
  const deploymentInfo = {
    contractAddress,
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployedAt: new Date().toISOString()
  };

  console.log("Deployment info:", deploymentInfo);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });