// contracts/core/RightsManager.sol  
// SPDX-License-Identifier: MIT  
pragma solidity ^0.8.17;  

import "@openzeppelin/contracts/access/Ownable.sol";  
import "./MusicNFT.sol";  

contract RightsManager is Ownable {  
    MusicNFT public musicNFT;  

    struct LicenseTerms {  
        uint256 price;  
        bool isActive;  
    }  

    mapping(uint256 => LicenseTerms) public licenseTerms;  
    mapping(address => mapping(uint256 => bool)) public licenses;  

    event LicenseTermsSet(uint256 indexed tokenId, uint256 price, bool isActive);  
    event LicensePurchased(address indexed user, uint256 indexed tokenId);  

    constructor(address _musicNFT) {  
        require(_musicNFT != address(0), "Invalid MusicNFT address");  
        musicNFT = MusicNFT(_musicNFT);  
    }  

    function setLicenseTerms(  
        uint256 tokenId,  
        uint256 price,  
        bool isActive  
    ) external {  
        require(  
            musicNFT.ownerOf(tokenId) == msg.sender,  
            "Only token owner can set terms"  
        );  
        licenseTerms[tokenId] = LicenseTerms(price, isActive);  
        emit LicenseTermsSet(tokenId, price, isActive);  
    }  

    function getLicenseTerms(uint256 tokenId)  
        external  
        view  
        returns (LicenseTerms memory)  
    {  
        return licenseTerms[tokenId];  
    }  

    function purchaseLicense(uint256 tokenId) external payable {  
        LicenseTerms memory terms = licenseTerms[tokenId];  
        require(terms.isActive, "License not available");  
        require(msg.value >= terms.price, "Insufficient payment");  

        address payable owner = payable(musicNFT.ownerOf(tokenId));  
        owner.transfer(msg.value);  

        licenses[msg.sender][tokenId] = true;  
        emit LicensePurchased(msg.sender, tokenId);  
    }  

    function hasLicense(address user, uint256 tokenId)  
        external  
        view  
        returns (bool)  
    {  
        return licenses[user][tokenId];  
    }  
}