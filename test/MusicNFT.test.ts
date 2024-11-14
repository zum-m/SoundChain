// test/MusicNFT.test.ts  
import { expect } from "chai";  
import { ethers } from "hardhat";  
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";  
import { MusicNFT } from "../typechain-types";  

describe("音楽NFT テスト", function () {  
    let musicNFT: MusicNFT;  
    let owner: SignerWithAddress;  
    let artist: SignerWithAddress;  
    let user1: SignerWithAddress;  
    let user2: SignerWithAddress;  

    beforeEach(async function () {  
        [owner, artist, user1, user2] = await ethers.getSigners();  
        const MusicNFTFactory = await ethers.getContractFactory("MusicNFT");  
        musicNFT = await MusicNFTFactory.deploy();  
        await musicNFT.waitForDeployment();  
    });  

    describe("NFTの基本機能", function () {  
        it("空のURIではNFTを作成できない", async function () {  
            await expect(musicNFT.mintMusic(""))  
                .to.be.revertedWith("URI cannot be empty");  
        });  

        it("NFT作成時にイベントが正しく発行される", async function () {  
            const uri = "ipfs://test-uri";  
            await expect(musicNFT.mintMusic(uri))  
                .to.emit(musicNFT, "MusicMinted")  
                .withArgs(1, await owner.getAddress(), uri);  
        });  

        it("同一URIで複数のNFTを作成可能", async function () {  
            const tokenURI = "ipfs://test";  
            await musicNFT.connect(artist).mintMusic(tokenURI);  
            await musicNFT.connect(artist).mintMusic(tokenURI);  
            expect(await musicNFT.tokenURI(1)).to.equal(tokenURI);  
            expect(await musicNFT.tokenURI(2)).to.equal(tokenURI);  
        });  
    });  

    describe("所有権の管理", function () {  
        it("NFTを他のアドレスに転送できる", async function () {  
            await musicNFT.connect(artist).mintMusic("ipfs://test");  
            await musicNFT.connect(artist).transferFrom(  
                artist.address,  
                user1.address,  
                1  
            );  
            expect(await musicNFT.ownerOf(1)).to.equal(user1.address);  
        });  

        it("所有者以外は転送できない", async function () {  
            await musicNFT.connect(artist).mintMusic("ipfs://test");  
            await expect(  
                musicNFT.connect(user1).transferFrom(  
                    artist.address,  
                    user2.address,  
                    1  
                )  
            ).to.be.revertedWith("ERC721: caller is not token owner or approved");  
        });  
    });  

    describe("ロイヤリティ機能", function () {  
        it("異なる価格でも正しくロイヤリティを計算する", async function () {  
            await musicNFT.connect(artist).mintMusic("ipfs://test");  
            
            const [receiver1, amount1] = await musicNFT.royaltyInfo(1, ethers.parseEther("1.0"));  
            expect(amount1).to.equal(ethers.parseEther("0.1"));  
            
            const [receiver2, amount2] = await musicNFT.royaltyInfo(1, ethers.parseEther("2.0"));  
            expect(amount2).to.equal(ethers.parseEther("0.2"));  
        });  

        it("ロイヤリティ受取人が正しく設定される", async function () {  
            await musicNFT.connect(artist).mintMusic("ipfs://test");  
            const [receiver] = await musicNFT.royaltyInfo(1, 1000);  
            expect(receiver).to.equal(artist.address);  
        });  
    });  

    describe("メタデータの取り扱い", function () {  
        it("存在しないトークンIDのURIを取得しようとすると失敗すること", async function () {  
            await expect(musicNFT.tokenURI(999))  
                .to.be.revertedWith("Token does not exist");  
        });  

        it("URIが正しく保存され取得できること", async function () {  
            const tokenURI = "ipfs://test";  
            await musicNFT.connect(artist).mintMusic(tokenURI);  
            expect(await musicNFT.tokenURI(1)).to.equal(tokenURI);  
        });  
    });  


    describe("ガス最適化の確認", function () {  
        it("連続したミント操作のガス使用量が適切であること", async function () {  
            // 初期状態を作成（最初のミントは計測対象外）  
            await musicNFT.connect(artist).mintMusic("ipfs://initial");  

            // 2回目と3回目のミントを比較  
            const tx1 = await musicNFT.connect(artist).mintMusic("ipfs://1");  
            const receipt1 = await tx1.wait();  
            const gas1 = Number(receipt1.gasUsed);  

            const tx2 = await musicNFT.connect(artist).mintMusic("ipfs://2");  
            const receipt2 = await tx2.wait();  
            const gas2 = Number(receipt2.gasUsed);  

            // ガス使用量の差が30%以内であることを確認（より現実的な値）  
            const difference = Math.abs(gas2 - gas1);  
            expect(difference).to.be.lessThan(gas1 * 0.3);  

            // ガス使用量のログ出力（デバッグ用）  
            console.log(`Gas used for first mint: ${gas1}`);  
            console.log(`Gas used for second mint: ${gas2}`);  
            console.log(`Difference: ${difference}`);  
            console.log(`Percentage difference: ${(difference / gas1 * 100).toFixed(2)}%`);  
        });  

        // 追加のガステスト  
        it("ミント操作の基本ガスコストが一定範囲内であること", async function () {  
            const tx = await musicNFT.connect(artist).mintMusic("ipfs://test");  
            const receipt = await tx.wait();  
            const gasUsed = Number(receipt.gasUsed);  

            // ガス使用量が適切な範囲内であることを確認  
            // 標準的なNFTミント操作のガス使用量の範囲を設定  
            expect(gasUsed).to.be.below(300000); // 最大ガス使用量の目安  
            expect(gasUsed).to.be.above(50000);  // 最小ガス使用量の目安  
        });  
    });  

});