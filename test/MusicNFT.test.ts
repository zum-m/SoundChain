// test/MusicNFT.test.ts  
import { expect } from "chai";  
import { ethers } from "hardhat";  
import { deployContract, setupUsers } from "./utils/helpers";  
import { MusicNFT } from "../typechain-types";  

describe("音楽NFT 詳細テスト", function () {  
    let musicNFT: MusicNFT;  
    let owner: any, artist: any, user1: any, user2: any;  

    beforeEach(async function () {  
        ({ owner, artist, user1, user2 } = await setupUsers());  
        musicNFT = await deployContract("MusicNFT") as MusicNFT;  
    });  

    describe("NFTの発行と検証", function () {  
        it("空のURIで発行しようとすると失敗すること", async function () {  
            await expect(musicNFT.connect(artist).mintMusic(""))  
                .to.be.revertedWith("URIは空にできません");  
        });  

        it("MusicMintedイベントが正しく発行されること", async function () {  
            const tokenURI = "ipfs://test";  
            await expect(musicNFT.connect(artist).mintMusic(tokenURI))  
                .to.emit(musicNFT, "MusicMinted")  
                .withArgs(artist.address, 1, tokenURI);  
        });  

        it("同じURIで複数のNFTを発行できること", async function () {  
            const tokenURI = "ipfs://test";  
            await musicNFT.connect(artist).mintMusic(tokenURI);  
            await musicNFT.connect(artist).mintMusic(tokenURI);  
            expect(await musicNFT.tokenURI(1)).to.equal(tokenURI);  
            expect(await musicNFT.tokenURI(2)).to.equal(tokenURI);  
        });  
    });  

    describe("所有権とトランスファー", function () {  
        it("NFTを他のアドレスに転送できること", async function () {  
            await musicNFT.connect(artist).mintMusic("ipfs://test");  
            await musicNFT.connect(artist).transferFrom(  
                artist.address,  
                user1.address,  
                1  
            );  
            expect(await musicNFT.ownerOf(1)).to.equal(user1.address);  
        });  

        it("所有者でない場合は転送できないこと", async function () {  
            await musicNFT.connect(artist).mintMusic("ipfs://test");  
            await expect(  
                musicNFT.connect(user1).transferFrom(  
                    artist.address,  
                    user2.address,  
                    1  
                )  
            ).to.be.reverted;  
        });  
    });  

    describe("ロイヤリティの詳細テスト", function () {  
        it("異なる販売価格でも正しいロイヤリティが計算されること", async function () {  
            await musicNFT.connect(artist).mintMusic("ipfs://test");  
            
            // 1 ETHの場合（10%のロイヤリティ）  
            const [receiver1, amount1] = await musicNFT.royaltyInfo(1, ethers.parseEther("1.0"));  
            expect(amount1).to.equal(ethers.parseEther("0.1"));  
            
            // 2 ETHの場合  
            const [receiver2, amount2] = await musicNFT.royaltyInfo(1, ethers.parseEther("2.0"));  
            expect(amount2).to.equal(ethers.parseEther("0.2"));  
        });  

        it("ロイヤリティの受取人が正しく設定されること", async function () {  
            await musicNFT.connect(artist).mintMusic("ipfs://test");  
            const [receiver] = await musicNFT.royaltyInfo(1, 1000);  
            expect(receiver).to.equal(artist.address);  
        });  
    });  

    describe("メタデータの取り扱い", function () {  
        it("存在しないトークンIDのURIを取得しようとすると失敗すること", async function () {  
            await expect(musicNFT.tokenURI(1))  
                .to.be.revertedWith("トークンが存在しません");  
        });  

        it("URIが正しく保存され取得できること", async function () {  
            const tokenURI = "ipfs://test";  
            await musicNFT.connect(artist).mintMusic(tokenURI);  
            expect(await musicNFT.tokenURI(1)).to.equal(tokenURI);  
        });  
    });  

    describe("ガス最適化の確認", function () {  
        it("連続したミント操作のガス使用量が適切であること", async function () {  
            const tx1 = await musicNFT.connect(artist).mintMusic("ipfs://1");  
            const receipt1 = await tx1.wait();  
            const gas1 = receipt1.gasUsed;  

            const tx2 = await musicNFT.connect(artist).mintMusic("ipfs://2");  
            const receipt2 = await tx2.wait();  
            const gas2 = receipt2.gasUsed;  

            // 2回目のミントのガス使用量が極端に増えていないことを確認  
            expect(gas2).to.be.closeTo(gas1, gas1.div(10)); // 10%の誤差を許容  
        });  
    });  
});