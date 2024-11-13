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
    
    // プレイリスト機能の追加
    struct Playlist {
        string name;
        uint256[] musicIds;
        address creator;
        bool isPublic;
    }

    mapping(uint256 => Playlist) public playlists;
    uint256 public playlistCount;

    // いいね機能の追加
    mapping(uint256 => mapping(address => bool)) public likes;
    mapping(uint256 => uint256) public likesCount;

    // コメント機能の追加
    struct Comment {
        address user;
        string content;
        uint256 timestamp;
    }
    mapping(uint256 => Comment[]) public comments;

    // ユーザープロファイル機能の追加
    struct UserProfile {
        string name;
        string avatarURI;
        uint256[] playlists;
        uint256[] followers;
        uint256[] following;
    }
    
    mapping(address => UserProfile) public userProfiles;
    mapping(uint256 => mapping(address => bool)) public playlistFollowers;
    
    event ProfileUpdated(address indexed user, string name, string avatarURI);
    event PlaylistFollowed(uint256 indexed playlistId, address indexed follower);

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

    // 新規機能の追加
    function createPlaylist(string memory _name, bool _isPublic) external {
        playlistCount++;
        playlists[playlistCount] = Playlist(_name, new uint256[](0), msg.sender, _isPublic);
    }

    function addToPlaylist(uint256 _playlistId, uint256 _musicId) external {
        require(playlists[_playlistId].creator == msg.sender, "Not playlist owner");
        playlists[_playlistId].musicIds.push(_musicId);
    }

    function likeMusic(uint256 _musicId) external {
        require(!likes[_musicId][msg.sender], "Already liked");
        likes[_musicId][msg.sender] = true;
        likesCount[_musicId]++;
    }

    function addComment(uint256 _musicId, string memory _content) external {
        comments[_musicId].push(Comment(msg.sender, _content, block.timestamp));
    }

    // ソーシャル機能の追加
    function updateProfile(string memory name, string memory avatarURI) external {
        UserProfile storage profile = userProfiles[msg.sender];
        profile.name = name;
        profile.avatarURI = avatarURI;
        emit ProfileUpdated(msg.sender, name, avatarURI);
    }
    
    function followPlaylist(uint256 playlistId) external {
        require(playlists[playlistId].isPublic, "Playlist is private");
        require(!playlistFollowers[playlistId][msg.sender], "Already following");
        
        playlistFollowers[playlistId][msg.sender] = true;
        UserProfile storage profile = userProfiles[msg.sender];
        profile.playlists.push(playlistId);
        
        emit PlaylistFollowed(playlistId, msg.sender);
    }
}