import { expect } from "chai";
import hre from "hardhat";
import { GBVReportRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

const { ethers } = hre;

describe("GBVReportRegistry", function () {
  let gbvReportRegistry: GBVReportRegistry;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  
  const reportHash1 = ethers.keccak256(ethers.toUtf8Bytes("test-report-1"));
  const reportHash2 = ethers.keccak256(ethers.toUtf8Bytes("test-report-2"));
  const ipfsCIDs1 = ["QmTestHash1", "QmTestHash2"];
  const ipfsCIDs2 = ["QmTestHash3"];

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const GBVReportRegistryFactory = await ethers.getContractFactory("GBVReportRegistry");
    gbvReportRegistry = await GBVReportRegistryFactory.deploy();
    await gbvReportRegistry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(await gbvReportRegistry.getAddress()).to.be.a.properAddress();
    });
  });

  describe("Report Submission", function () {
    it("Should submit a report successfully", async function () {
      const tx = await gbvReportRegistry.connect(user1).submitReport(reportHash1, ipfsCIDs1);
      
      await expect(tx)
        .to.emit(gbvReportRegistry, "ReportSubmitted")
        .withArgs(user1.address, reportHash1, ipfsCIDs1, await getBlockTimestamp(tx));
    });

    it("Should store report data correctly", async function () {
      await gbvReportRegistry.connect(user1).submitReport(reportHash1, ipfsCIDs1);
      
      const report = await gbvReportRegistry.getReport(reportHash1);
      expect(report.reportHash).to.equal(reportHash1);
      expect(report.ipfsCIDs).to.deep.equal(ipfsCIDs1);
      expect(report.submitter).to.equal(user1.address);
      expect(report.timestamp).to.be.greaterThan(0);
    });

    it("Should add report to user's report list", async function () {
      await gbvReportRegistry.connect(user1).submitReport(reportHash1, ipfsCIDs1);
      
      const userReports = await gbvReportRegistry.getUserReports(user1.address);
      expect(userReports).to.have.lengthOf(1);
      expect(userReports[0]).to.equal(reportHash1);
    });

    it("Should allow multiple reports from same user", async function () {
      await gbvReportRegistry.connect(user1).submitReport(reportHash1, ipfsCIDs1);
      await gbvReportRegistry.connect(user1).submitReport(reportHash2, ipfsCIDs2);
      
      const userReports = await gbvReportRegistry.getUserReports(user1.address);
      expect(userReports).to.have.lengthOf(2);
      expect(userReports[0]).to.equal(reportHash1);
      expect(userReports[1]).to.equal(reportHash2);
    });

    it("Should allow different users to submit reports", async function () {
      await gbvReportRegistry.connect(user1).submitReport(reportHash1, ipfsCIDs1);
      await gbvReportRegistry.connect(user2).submitReport(reportHash2, ipfsCIDs2);
      
      const user1Reports = await gbvReportRegistry.getUserReports(user1.address);
      const user2Reports = await gbvReportRegistry.getUserReports(user2.address);
      
      expect(user1Reports).to.have.lengthOf(1);
      expect(user2Reports).to.have.lengthOf(1);
      expect(user1Reports[0]).to.equal(reportHash1);
      expect(user2Reports[0]).to.equal(reportHash2);
    });
  });

  describe("Report Submission Validation", function () {
    it("Should reject empty report hash", async function () {
      const emptyHash = ethers.ZeroHash;
      
      await expect(
        gbvReportRegistry.connect(user1).submitReport(emptyHash, ipfsCIDs1)
      ).to.be.revertedWith("Invalid report hash");
    });

    it("Should reject empty IPFS CIDs array", async function () {
      await expect(
        gbvReportRegistry.connect(user1).submitReport(reportHash1, [])
      ).to.be.revertedWith("No IPFS CIDs provided");
    });

    it("Should reject duplicate report hash", async function () {
      await gbvReportRegistry.connect(user1).submitReport(reportHash1, ipfsCIDs1);
      
      await expect(
        gbvReportRegistry.connect(user2).submitReport(reportHash1, ipfsCIDs2)
      ).to.be.revertedWith("Report already exists");
    });
  });

  describe("Report Retrieval", function () {
    beforeEach(async function () {
      await gbvReportRegistry.connect(user1).submitReport(reportHash1, ipfsCIDs1);
    });

    it("Should retrieve report data correctly", async function () {
      const report = await gbvReportRegistry.getReport(reportHash1);
      
      expect(report.reportHash).to.equal(reportHash1);
      expect(report.ipfsCIDs).to.deep.equal(ipfsCIDs1);
      expect(report.submitter).to.equal(user1.address);
      expect(report.timestamp).to.be.greaterThan(0);
    });

    it("Should reject retrieval of non-existent report", async function () {
      await expect(
        gbvReportRegistry.getReport(reportHash2)
      ).to.be.revertedWith("Report not found");
    });
  });

  describe("User Reports", function () {
    it("Should return empty array for user with no reports", async function () {
      const userReports = await gbvReportRegistry.getUserReports(user1.address);
      expect(userReports).to.have.lengthOf(0);
    });

    it("Should return correct reports for user", async function () {
      await gbvReportRegistry.connect(user1).submitReport(reportHash1, ipfsCIDs1);
      await gbvReportRegistry.connect(user1).submitReport(reportHash2, ipfsCIDs2);
      
      const userReports = await gbvReportRegistry.getUserReports(user1.address);
      expect(userReports).to.have.lengthOf(2);
      expect(userReports).to.include(reportHash1);
      expect(userReports).to.include(reportHash2);
    });

    it("Should not return other users' reports", async function () {
      await gbvReportRegistry.connect(user1).submitReport(reportHash1, ipfsCIDs1);
      await gbvReportRegistry.connect(user2).submitReport(reportHash2, ipfsCIDs2);
      
      const user1Reports = await gbvReportRegistry.getUserReports(user1.address);
      const user2Reports = await gbvReportRegistry.getUserReports(user2.address);
      
      expect(user1Reports).to.have.lengthOf(1);
      expect(user2Reports).to.have.lengthOf(1);
      expect(user1Reports[0]).to.equal(reportHash1);
      expect(user2Reports[0]).to.equal(reportHash2);
    });
  });

  describe("Events", function () {
    it("Should emit ReportSubmitted event with correct parameters", async function () {
      const tx = await gbvReportRegistry.connect(user1).submitReport(reportHash1, ipfsCIDs1);
      const timestamp = await getBlockTimestamp(tx);
      
      await expect(tx)
        .to.emit(gbvReportRegistry, "ReportSubmitted")
        .withArgs(user1.address, reportHash1, ipfsCIDs1, timestamp);
    });
  });

  describe("Gas Usage", function () {
    it("Should use reasonable gas for report submission", async function () {
      const tx = await gbvReportRegistry.connect(user1).submitReport(reportHash1, ipfsCIDs1);
      const receipt = await tx.wait();
      
      // Gas usage should be reasonable (less than 250,000 gas)
      expect(receipt!.gasUsed).to.be.below(250000);
    });

    it("Should use reasonable gas for report retrieval", async function () {
      await gbvReportRegistry.connect(user1).submitReport(reportHash1, ipfsCIDs1);
      
      const gasEstimate = await gbvReportRegistry.getReport.estimateGas(reportHash1);
      expect(gasEstimate).to.be.lessThan(50000);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle large IPFS CIDs array", async function () {
      const largeCIDsArray = Array(10).fill(0).map((_, i) => `QmTestHash${i}`);
      
      await expect(
        gbvReportRegistry.connect(user1).submitReport(reportHash1, largeCIDsArray)
      ).to.not.be.reverted;
      
      const report = await gbvReportRegistry.getReport(reportHash1);
      expect(report.ipfsCIDs).to.deep.equal(largeCIDsArray);
    });

    it("Should handle maximum length IPFS CID strings", async function () {
      const maxLengthCID = "Qm" + "a".repeat(44); // Maximum IPFS CID length
      
      await expect(
        gbvReportRegistry.connect(user1).submitReport(reportHash1, [maxLengthCID])
      ).to.not.be.reverted;
      
      const report = await gbvReportRegistry.getReport(reportHash1);
      expect(report.ipfsCIDs[0]).to.equal(maxLengthCID);
    });
  });

  // Helper function to get block timestamp
  async function getBlockTimestamp(tx: any): Promise<number> {
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    return block!.timestamp;
  }
});