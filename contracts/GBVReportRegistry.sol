// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract GBVReportRegistry {
    struct Report {
        bytes32 reportHash;
        string[] ipfsCIDs;
        uint256 timestamp;
        address submitter;
    }
    
    mapping(bytes32 => Report) public reports;
    mapping(address => bytes32[]) public userReports;
    
    event ReportSubmitted(
        address indexed submitter,
        bytes32 indexed reportHash,
        string[] ipfsCIDs,
        uint256 timestamp
    );
    
    function submitReport(
        bytes32 _reportHash,
        string[] memory _ipfsCIDs
    ) external {
        require(_reportHash != bytes32(0), "Invalid report hash");
        require(_ipfsCIDs.length > 0, "No IPFS CIDs provided");
        require(reports[_reportHash].timestamp == 0, "Report already exists");
        
        reports[_reportHash] = Report({
            reportHash: _reportHash,
            ipfsCIDs: _ipfsCIDs,
            timestamp: block.timestamp,
            submitter: msg.sender
        });
        
        userReports[msg.sender].push(_reportHash);
        
        emit ReportSubmitted(msg.sender, _reportHash, _ipfsCIDs, block.timestamp);
    }
    
    function getReport(bytes32 _reportHash) external view returns (
        bytes32 reportHash,
        string[] memory ipfsCIDs,
        uint256 timestamp,
        address submitter
    ) {
        Report memory report = reports[_reportHash];
        require(report.timestamp != 0, "Report not found");
        
        return (
            report.reportHash,
            report.ipfsCIDs,
            report.timestamp,
            report.submitter
        );
    }
    
    function getUserReports(address _user) external view returns (bytes32[] memory) {
        return userReports[_user];
    }
}