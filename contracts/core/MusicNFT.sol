// contracts/core/MusicNFT.sol  
// SPDX-License-Identifier: MIT  
pragma solidity ^0.8.17;  

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";  
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";  
import "@openzeppelin/contracts/access/Ownable.sol";  
import "@openzeppelin/contracts/token/common/ERC2981.sol";  
import "@openzeppelin/contracts/utils/Strings.sol";  

contract MusicNFT is ERC721, ERC721URIStorage, ERC2981, Ownable {  
    using Strings for uint256;  
    
    uint256 private _tokenIds;  
    
    // イベントの定義  
    event MusicMinted(uint256 indexed tokenId, address indexed creator, string uri);  
    
    struct MusicRoyaltyInfo {  
        address recipient;  
        uint256 percentage;  
    }  
    
    mapping(uint256 => MusicRoyaltyInfo) private _musicRoyalties;  

    constructor() ERC721("MusicNFT", "MNFT") {}  

    function mintMusic(string memory _uri) public returns (uint256) {  
        // URIの空チェック  
        require(bytes(_uri).length > 0, "URI cannot be empty");  
        
        _tokenIds++;  
        uint256 newItemId = _tokenIds;  
        _safeMint(msg.sender, newItemId);  
        _setTokenURI(newItemId, _uri);  
        
        // デフォルトのロイヤリティを設定  
        _setTokenRoyalty(newItemId, msg.sender, 1000);  

        // イベントの発行  
        emit MusicMinted(newItemId, msg.sender, _uri);  

        return newItemId;  
    }  

    function setMusicRoyalty(  
        uint256 tokenId,  
        address recipient,  
        uint256 percentage  
    ) public {  
        require(_exists(tokenId), "Token does not exist");  
        require(ownerOf(tokenId) == msg.sender, "Only owner can set royalty");  
        require(percentage <= 10000, "Percentage cannot exceed 100%");  

        _musicRoyalties[tokenId] = MusicRoyaltyInfo(recipient, percentage);  
    }  

    function getMusicRoyaltyInfo(uint256 tokenId) public view returns (address, uint256) {  
        require(_exists(tokenId), "Token does not exist");  
        MusicRoyaltyInfo memory royalty = _musicRoyalties[tokenId];  
        return (royalty.recipient, royalty.percentage);  
    }  

    function tokenURI(uint256 tokenId)  
        public  
        view  
        virtual  
        override(ERC721, ERC721URIStorage)  
        returns (string memory)  
    {  
        require(_exists(tokenId), "Token does not exist");  
        return super.tokenURI(tokenId);  
    }  

    function _burn(uint256 tokenId)   
        internal   
        virtual   
        override(ERC721, ERC721URIStorage)   
    {  
        super._burn(tokenId);  
    }  

    function supportsInterface(bytes4 interfaceId)  
        public  
        view  
        virtual  
        override(ERC721, ERC721URIStorage, ERC2981)  
        returns (bool)  
    {  
        return super.supportsInterface(interfaceId);  
    }  
}