// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract UserProfileNFT is ERC721, ERC721URIStorage {
    struct ProfileData {
        string name;
        string avatarURI;
        address owner;
        uint256[] playlists;
        uint256[] followers;
        uint256[] following;
        uint256 reputation;    // ユーザーの評価スコア
        bool isVerified;       // 認証済みステータス
    }

    mapping(uint256 => ProfileData) private _profiles;
    mapping(address => uint256) private _addressToTokenId;
    uint256 private _tokenIds;

    event ProfileCreated(uint256 indexed tokenId, address indexed owner);
    event ProfileUpdated(uint256 indexed tokenId, string name, string avatarURI);
    event ReputationUpdated(uint256 indexed tokenId, uint256 newScore);

    constructor() ERC721("UserProfile", "UPROF") {}

    function createProfile(string memory name, string memory avatarURI) public returns (uint256) {
        require(_addressToTokenId[msg.sender] == 0, "Profile already exists");
        
        _tokenIds++;
        uint256 newTokenId = _tokenIds;
        
        _profiles[newTokenId] = ProfileData({
            name: name,
            avatarURI: avatarURI,
            owner: msg.sender,
            playlists: new uint256[](0),
            followers: new uint256[](0),
            following: new uint256[](0),
            reputation: 0,
            isVerified: false
        });

        _safeMint(msg.sender, newTokenId);
        _addressToTokenId[msg.sender] = newTokenId;

        emit ProfileCreated(newTokenId, msg.sender);
        return newTokenId;
    }

    // プロフィール更新
    function updateProfile(uint256 tokenId, string memory name, string memory avatarURI) public {
        require(ownerOf(tokenId) == msg.sender, "Not profile owner");
        
        _profiles[tokenId].name = name;
        _profiles[tokenId].avatarURI = avatarURI;
        
        emit ProfileUpdated(tokenId, name, avatarURI);
    }

    // 評価システム
    function updateReputation(uint256 tokenId, uint256 score) public {
        // ここに適切な権限チェックを実装
        _profiles[tokenId].reputation = score;
        emit ReputationUpdated(tokenId, score);
    }

    // プロフィール情報の取得
    function getProfile(uint256 tokenId) public view returns (ProfileData memory) {
        require(_exists(tokenId), "Profile does not exist");
        return _profiles[tokenId];
    }

    // アドレスからプロフィールIDを取得
    function getProfileIdByAddress(address user) public view returns (uint256) {
        return _addressToTokenId[user];
    }

    // オーバーライド関数の追加
    function _burn(uint256 tokenId) internal virtual override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId) public view virtual override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
