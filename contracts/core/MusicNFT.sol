// contracts/core/MusicNFT.sol  
// SPDX-License-Identifier: MIT  
pragma solidity ^0.8.17;  

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";  
import "@openzeppelin/contracts/token/common/ERC2981.sol";  
import "@openzeppelin/contracts/utils/Counters.sol";  

contract MusicNFT is ERC721, ERC2981 {  
    using Counters for Counters.Counter;  
    Counters.Counter private _tokenIds;  

    event MusicMinted(address indexed artist, uint256 indexed tokenId, string uri);  

    mapping(uint256 => string) private _tokenURIs;  

    constructor() ERC721("MusicNFT", "MNFT") {  
        _setDefaultRoyalty(msg.sender, 1000); // 10% royalty  
    }  

    function mintMusic(string memory tokenURI) public returns (uint256) {  
        require(bytes(tokenURI).length > 0, "URI cannot be empty");  
        
        _tokenIds.increment();  
        uint256 newTokenId = _tokenIds.current();  

        _safeMint(msg.sender, newTokenId);  
        _tokenURIs[newTokenId] = tokenURI;  
        _setTokenRoyalty(newTokenId, msg.sender, 1000);  

        emit MusicMinted(msg.sender, newTokenId, tokenURI);  
        return newTokenId;  
    }  

    function tokenURI(uint256 tokenId) public view override returns (string memory) {  
        require(_exists(tokenId), "Token does not exist");  
        return _tokenURIs[tokenId];  
    }  

    function totalSupply() public view returns (uint256) {  
        return _tokenIds.current();  
    }  

    function supportsInterface(bytes4 interfaceId)  
        public  
        view  
        override(ERC721, ERC2981)  
        returns (bool)  
    {  
        return super.supportsInterface(interfaceId);  
    }  
}