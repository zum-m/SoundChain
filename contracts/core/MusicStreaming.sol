// contracts/core/MusicStreaming.sol  
// SPDX-License-Identifier: MIT  
pragma solidity ^0.8.17;  

import "./RightsManager.sol";  
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";  

contract MusicStreaming is ReentrancyGuard {  
    RightsManager public rightsManager;  
    
    struct Stream {  
        uint256 startTime;  
        uint256 endTime;  
        uint256 duration;  
        address user;  
        bool isActive;  
        uint256 payment;  // 支払い額を記録  
    }  
    
    mapping(uint256 => Stream[]) public streams;  
    mapping(address => mapping(uint256 => bool)) public activeStreams;  
    
    uint256 public constant MINIMUM_STREAM_PAYMENT = 0.001 ether;  
    
    event StreamStarted(uint256 indexed tokenId, address indexed user, uint256 payment);  
    event StreamEnded(uint256 indexed tokenId, address indexed user, uint256 duration);  
    
    constructor(address _rightsManager) {  
        rightsManager = RightsManager(_rightsManager);  
    }  
    
    modifier onlyLicenseHolder(uint256 tokenId) {  
        require(  
            rightsManager.hasValidLicense(msg.sender, tokenId),  
            "No valid license"  
        );  
        _;  
    }  
    
    function startStream(uint256 tokenId) external payable onlyLicenseHolder(tokenId) nonReentrant {  
        require(msg.value >= MINIMUM_STREAM_PAYMENT, "Insufficient payment");  
        require(!activeStreams[msg.sender][tokenId], "Already streaming");  
        
        streams[tokenId].push(Stream({  
            startTime: block.timestamp,  
            endTime: 0,  
            duration: 0,  
            user: msg.sender,  
            isActive: true,  
            payment: msg.value  // 支払い額を記録  
        }));  
        
        activeStreams[msg.sender][tokenId] = true;  
        
        // 支払いの処理  
        address artist = rightsManager.tokenArtists(tokenId);  
        require(artist != address(0), "Artist not found");  
        
        (bool success, ) = payable(artist).call{value: msg.value}("");  
        require(success, "Payment failed");  
        
        emit StreamStarted(tokenId, msg.sender, msg.value);  
    }  
    
    function endStream(uint256 tokenId) external nonReentrant {  
        require(activeStreams[msg.sender][tokenId], "No active stream");  
        
        uint256 streamIndex = streams[tokenId].length - 1;  
        Stream storage currentStream = streams[tokenId][streamIndex];  
        
        require(currentStream.user == msg.sender, "Not stream owner");  
        
        currentStream.endTime = block.timestamp;  
        currentStream.duration = currentStream.endTime - currentStream.startTime;  
        currentStream.isActive = false;  
        
        activeStreams[msg.sender][tokenId] = false;  
        
        // ストリームの記録  
        rightsManager.recordStream(tokenId, msg.sender);  
        
        emit StreamEnded(tokenId, msg.sender, currentStream.duration);  
    }  
    
    function getStreamHistory(uint256 tokenId) external view returns (Stream[] memory) {  
        return streams[tokenId];  
    }  
}