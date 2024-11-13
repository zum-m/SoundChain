// contracts/core/RightsManager.sol  
// SPDX-License-Identifier: MIT  
pragma solidity ^0.8.17;  

import "@openzeppelin/contracts/access/Ownable.sol";  
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";  
import "@openzeppelin/contracts/security/Pausable.sol";  
import "./MusicNFT.sol";  

contract RightsManager is Ownable, ReentrancyGuard, Pausable {  
    MusicNFT public musicNFT;  

    enum LicenseType { PERSONAL, COMMERCIAL, STREAMING }  
    
    struct LicenseTerms {  
        uint256 price;  
        bool isActive;  
        uint256 duration;        // ライセンスの有効期間（秒）  
        LicenseType licenseType; // ライセンスタイプ  
        uint256 maxStreams;      // 最大ストリーミング回数  
        uint256 royaltyRate;     // ロイヤリティレート（10000 = 100%）  
    }  

    struct License {  
        bool isValid;  
        uint256 expiresAt;  
        uint256 streamCount;  
        LicenseType licenseType;  
    }  

    struct RevenuePool {
        uint256 streamingRevenue;
        uint256 downloadRevenue;
        uint256 commercialRevenue;
    }

    mapping(uint256 => LicenseTerms) public licenseTerms;  
    mapping(address => mapping(uint256 => License)) public licenses;  
    mapping(uint256 => address) public tokenArtists;  
    mapping(uint256 => uint256) public tokenRevenue;  
    mapping(uint256 => RevenuePool) public revenuePools;

    event LicenseTermsSet(  
        uint256 indexed tokenId,  
        uint256 price,  
        bool isActive,  
        uint256 duration,  
        LicenseType licenseType  
    );  
    event LicensePurchased(  
        address indexed user,  
        uint256 indexed tokenId,  
        LicenseType licenseType,  
        uint256 expiresAt  
    );  
    event LicenseRevoked(uint256 indexed tokenId, address indexed user);  
    event RoyaltyPaid(  
        uint256 indexed tokenId,  
        address indexed artist,  
        uint256 amount  
    );  
    event StreamRecorded(  
        uint256 indexed tokenId,  
        address indexed user,  
        uint256 streamCount  
    );  

    constructor(address _musicNFT) {  
        require(_musicNFT != address(0), "Invalid MusicNFT address");  
        musicNFT = MusicNFT(_musicNFT);  
    }  

    function setLicenseTerms(  
        uint256 tokenId,  
        uint256 price,  
        bool isActive,  
        uint256 duration,  
        LicenseType licenseType,  
        uint256 maxStreams,  
        uint256 royaltyRate  
    ) external whenNotPaused {  
        require(  
            musicNFT.ownerOf(tokenId) == msg.sender,  
            "Only token owner can set terms"  
        );  
        require(royaltyRate <= 10000, "Invalid royalty rate");  

        licenseTerms[tokenId] = LicenseTerms(  
            price,  
            isActive,  
            duration,  
            licenseType,  
            maxStreams,  
            royaltyRate  
        );  
        tokenArtists[tokenId] = msg.sender;  

        emit LicenseTermsSet(tokenId, price, isActive, duration, licenseType);  
    }  

    function purchaseLicense(uint256 tokenId, LicenseType licenseType)  
        external  
        payable  
        whenNotPaused  
        nonReentrant  
    {  
        LicenseTerms memory terms = licenseTerms[tokenId];  
        require(terms.isActive, "License not available");  
        require(terms.licenseType == licenseType, "Invalid license type");  
        require(msg.value >= terms.price, "Insufficient payment");  

        uint256 expirationTime = block.timestamp + terms.duration;  
        licenses[msg.sender][tokenId] = License(  
            true,  
            expirationTime,  
            0,  
            licenseType  
        );  

        // ロイヤリティの計算と支払い  
        uint256 royaltyAmount = (msg.value * terms.royaltyRate) / 10000;  
        address artist = tokenArtists[tokenId];  
        tokenRevenue[tokenId] += royaltyAmount;  

        (bool success, ) = payable(artist).call{value: royaltyAmount}("");  
        require(success, "Royalty payment failed");  

        emit LicensePurchased(msg.sender, tokenId, licenseType, expirationTime);  
        emit RoyaltyPaid(tokenId, artist, royaltyAmount);  
    }  

    function revokeLicense(uint256 tokenId, address user)  
        external  
        whenNotPaused  
    {  
        require(  
            musicNFT.ownerOf(tokenId) == msg.sender,  
            "Only token owner can revoke"  
        );  
        delete licenses[user][tokenId];  
        emit LicenseRevoked(tokenId, user);  
    }  

    function recordStream(uint256 tokenId, address user)  
        external  
        whenNotPaused  
    {  
        require(msg.sender == owner(), "Only owner can record streams");  
        License storage license = licenses[user][tokenId];  
        require(license.isValid, "Invalid license");  
        require(block.timestamp <= license.expiresAt, "License expired");  
        require(  
            license.streamCount < licenseTerms[tokenId].maxStreams,  
            "Stream limit reached"  
        );  

        license.streamCount++;  
        emit StreamRecorded(tokenId, user, license.streamCount);  
    }  

    function hasValidLicense(address user, uint256 tokenId)  
        external  
        view  
        returns (bool)  
    {  
        License memory license = licenses[user][tokenId];  
        return license.isValid &&  
               block.timestamp <= license.expiresAt &&  
               license.streamCount < licenseTerms[tokenId].maxStreams;  
    }  

    function getLicenseDetails(address user, uint256 tokenId)  
        external  
        view  
        returns (License memory)  
    {  
        return licenses[user][tokenId];  
    }  

    function getTokenRevenue(uint256 tokenId)  
        external  
        view  
        returns (uint256)  
    {  
        return tokenRevenue[tokenId];  
    }  

    function distributeRevenue(uint256 tokenId) external nonReentrant {
        RevenuePool storage pool = revenuePools[tokenId];
        address artist = tokenArtists[tokenId];
        require(artist != address(0), "Artist not found");
        
        uint256 totalRevenue = pool.streamingRevenue + pool.downloadRevenue + pool.commercialRevenue;
        require(totalRevenue > 0, "No revenue to distribute");
        
        pool.streamingRevenue = 0;
        pool.downloadRevenue = 0;
        pool.commercialRevenue = 0;
        
        (bool success, ) = payable(artist).call{value: totalRevenue}("");
        require(success, "Revenue distribution failed");
        
        emit RoyaltyPaid(tokenId, artist, totalRevenue);
    }

    function pause() external onlyOwner {  
        _pause();  
    }  

    function unpause() external onlyOwner {  
        _unpause();  
    }  
}