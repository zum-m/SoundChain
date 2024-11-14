// test/RightsManager.test.ts  
import { expect } from "chai";  
import { ethers, network } from "hardhat";  
import { Contract } from "ethers";  
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";  


describe("ライセンス管理機能テスト", function () {  
    let musicNFT: Contract;  
    let rightsManager: Contract;  
    let musicStreaming: Contract; // MusicStreamingコントラクトを追加
    let owner: SignerWithAddress;  
    let artist: SignerWithAddress;  
    let user1: SignerWithAddress;  

    beforeEach(async function () {  
        [owner, artist, user1] = await ethers.getSigners();  

        // Deploy MusicNFT  
        const MusicNFT = await ethers.getContractFactory("MusicNFT");  
        musicNFT = await MusicNFT.deploy();  
        await musicNFT.waitForDeployment();  

        // Deploy RightsManager  
        const RightsManager = await ethers.getContractFactory("RightsManager");  
        rightsManager = await RightsManager.deploy(await musicNFT.getAddress());  
        await rightsManager.waitForDeployment();  

        // Deploy MusicStreaming
        const MusicStreaming = await ethers.getContractFactory("MusicStreaming");
        musicStreaming = await MusicStreaming.deploy(await rightsManager.getAddress());
        await musicStreaming.waitForDeployment();

        // Set MusicStreaming contract address in RightsManager
        await rightsManager.connect(owner).setMusicStreamingContract(
            await musicStreaming.getAddress()
        );

        // Mint NFT and set license terms  
        await musicNFT.connect(artist).mintMusic("ipfs://1");  
        await rightsManager.connect(artist).setLicenseTerms(  
            1,  
            ethers.parseEther("0.1"),  
            true,  
            86400, // 1日  
            0, // PERSONAL  
            100, // 最大100回のストリーミング  
            1000 // 10%のロイヤリティ  
        );  
    });  


    it("ライセンスの有効期限が正しく��能する", async function () {  
        await rightsManager.connect(user1).purchaseLicense(1, 0, {  
            value: ethers.parseEther("0.1")  
        });  

        // 1日後に時間を進める  
        await network.provider.send("evm_increaseTime", [86401]);  
        await network.provider.send("evm_mine");  

        const hasValidLicense = await rightsManager.hasValidLicense(user1.address, 1);  
        expect(hasValidLicense).to.be.false;  
    });  

    it("ストリーム回数が正しく記録される", async function () {  
        // ライセンスを購入
        await rightsManager.connect(user1).purchaseLicense(1, 0, {  
            value: ethers.parseEther("0.1")  
        });  

        // ストリーミングを実行
        await musicStreaming.connect(user1).startStream(1, {
            value: ethers.parseEther("0.001")
        });
        await musicStreaming.connect(user1).endStream(1);
        
        const license = await rightsManager.getLicenseDetails(user1.address, 1);  
        expect(license.streamCount).to.equal(1);  
    });  

    it("異なるライセンスタイプを正しく処理する", async function () {  
        // 商用ライセンスの設定  
        await rightsManager.connect(artist).setLicenseTerms(  
            1,  
            ethers.parseEther("0.5"),  
            true,  
            86400 * 30, // 30日  
            1, // 商用ライセンス  
            1000, // 1000回まで再生可能  
            2000 // 20%のロイヤリティ  
        );  

        await rightsManager.connect(user1).purchaseLicense(1, 1, {  
            value: ethers.parseEther("0.5")  
        });  

        const license = await rightsManager.getLicenseDetails(user1.address, 1);  
        expect(license.licenseType).to.equal(1); // 商用ライセンス  
    });  

    it("ロイヤリティが正しく計算され分配される", async function () {  
        const initialArtistBalance = await ethers.provider.getBalance(artist.address);  

        await rightsManager.connect(user1).purchaseLicense(1, 0, {  
            value: ethers.parseEther("0.1")  
        });  

        const finalArtistBalance = await ethers.provider.getBalance(artist.address);  
        const expectedRoyalty = ethers.parseEther("0.01"); // 10%  
        
        expect(finalArtistBalance - initialArtistBalance).to.equal(expectedRoyalty);  
    });  

    it("所有者によるライセンスの取り消しが可能", async function () {  
        await rightsManager.connect(user1).purchaseLicense(1, 0, {  
            value: ethers.parseEther("0.1")  
        });  

        await rightsManager.connect(artist).revokeLicense(1, user1.address);  
        
        const hasValidLicense = await rightsManager.hasValidLicense(user1.address, 1);  
        expect(hasValidLicense).to.be.false;  
    });  
});