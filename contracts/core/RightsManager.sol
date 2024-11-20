// contracts/core/RightsManager.sol  
// SPDX-License-Identifier: MIT  
pragma solidity ^0.8.17;  

import "@openzeppelin/contracts/access/Ownable.sol";  
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";  
import "@openzeppelin/contracts/security/Pausable.sol";  
import "./MusicNFT.sol";  

contract RightsManager is Ownable, ReentrancyGuard, Pausable {
    /*
    * @title 音楽NFTの権利管理コントラクト
    * @dev OpenZeppelinの以下の機能を継承:
    * - Ownable: 管理者権限の制御
    * - ReentrancyGuard: 再入攻撃対���
    * - Pausable: 緊急時の機能停止
    */

    MusicNFT public musicNFT;  

    // ライセンスの種類を定義
    enum LicenseType { 
        PERSONAL,    // 個人利用ライセンス
        COMMERCIAL,  // 商用利用ライセンス
        STREAMING    // ストリーミング用ライセンス
    }  
    
    struct LicenseTerms {  
        uint256 price;           // ライセンス価格
        bool isActive;           // 販売状態
        uint256 duration;        // 有効期間（秒）
        LicenseType licenseType; // ライセンス種別
        uint256 maxStreams;      // 最大再生回数
        uint256 royaltyRate;     // ロイヤリティ率（10000 = 100%）
    }  

    struct License {  
        bool isValid;  
        uint256 expiresAt;  
        uint256 streamCount;  
        LicenseType licenseType;  
    }  

    // 収益プール構造
    struct RevenuePool {
        uint256 streamingRevenue;   // ストリーミング収入
        uint256 downloadRevenue;    // ダウンロード収入
        uint256 commercialRevenue;  // 商用利用収入
    }

    // ライセンス条件の管理
    mapping(uint256 => LicenseTerms) public licenseTerms;

    // ユーザーごとのライセンス状態管理
    mapping(address => mapping(uint256 => License)) public licenses;

    // NFTごとの権利者アドレス管理
    mapping(uint256 => address) public tokenArtists;

    // NFTごとの収益管理
    mapping(uint256 => uint256) public tokenRevenue;

    // NFTごとの収益プール管理
    mapping(uint256 => RevenuePool) public revenuePools;

    // MusicStreamingコントラクトのアドレスを保持
    address public musicStreamingContract;

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

    /**
     * @dev ライセンス条件を設定
     * @param tokenId NFTのトークンID
     * @param price ライセンス価格
     * @param isActive 販売状態
     * @param duration 有効期間
     * @param licenseType ライセンスタイプ
     * @param maxStreams 最大再生回数
     * @param royaltyRate ロイヤリティ率
     */
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

    /**
     * @dev ライセンスを購入
     * @param tokenId 購入するNFTのID
     * @param licenseType ライセンスタイプ
     */
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

    /**
     * @dev ストリーミング記録
     * @param tokenId 再生されたNFTのID
     * @param user 再生したユーザーアドレス
     */
    function recordStream(uint256 tokenId, address user)  
        external  
        whenNotPaused  
    {  
        // ownerではなく、MusicStreamingコントラクトからの呼び出しのみを許可
        require(msg.sender == musicStreamingContract, "Only MusicStreaming contract can record streams");
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

    // MusicStreamingコントラクトの設定関数を追加
    function setMusicStreamingContract(address _musicStreaming) external onlyOwner {
        require(_musicStreaming != address(0), "Invalid address");
        musicStreamingContract = _musicStreaming;
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

    /**
     * @dev 収益分配
     * @param tokenId 収益を分配するNFTのID
     */
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