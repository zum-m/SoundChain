// test/MusicStreaming.test.ts  
import { expect } from "chai";  
import { ethers } from "hardhat";  
import { Contract } from "ethers";  
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";  

describe("MusicStreaming", function () {  
    let musicNFT: Contract;  
    let rightsManager: Contract;  
    let musicStreaming: Contract;  
    let owner: SignerWithAddress;  
    let artist: SignerWithAddress;  
    let user: SignerWithAddress;  

    beforeEach(async function () {  
        [owner, artist, user] = await ethers.getSigners();  

        // Deploy MusicNFT  
        const MusicNFT = await ethers.getContractFactory("MusicNFT");  
        musicNFT = await MusicNFT.deploy();  
        await musicNFT.waitForDeployment(); // 修正: deployed() → waitForDeployment()  

        const musicNFTAddress = await musicNFT.getAddress(); // 修正: コントラクトアドレスの取得方法  
        console.log("MusicNFT deployed to:", musicNFTAddress);  

        // Deploy RightsManager  
        const RightsManager = await ethers.getContractFactory("RightsManager");  
        rightsManager = await RightsManager.deploy(musicNFTAddress);  
        await rightsManager.waitForDeployment();  

        const rightsManagerAddress = await rightsManager.getAddress();  
        console.log("RightsManager deployed to:", rightsManagerAddress);  

        // Deploy MusicStreaming  
        const MusicStreaming = await ethers.getContractFactory("MusicStreaming");  
        musicStreaming = await MusicStreaming.deploy(rightsManagerAddress);  
        await musicStreaming.waitForDeployment();  

        const musicStreamingAddress = await musicStreaming.getAddress();  
        console.log("MusicStreaming deployed to:", musicStreamingAddress);  

        // NFTをミント  
        const mintTx = await musicNFT.connect(artist).mintMusic("ipfs://testURI");  
        await mintTx.wait(); // トランザクションの完了を待機  

        // ライセンス条件を設定  
        const setTermsTx = await rightsManager.connect(artist).setLicenseTerms(  
            1n,                             // tokenId  
            ethers.parseEther("0.01"),      // price  
            true,                           // isActive  
            86400n,                         // duration (24時間)  
            0n,                             // licenseType (PERSONAL)  
            100n,                           // maxStreams  
            1000n                           // royaltyRate (10%)  
        );  
        await setTermsTx.wait(); // トランザクションの完了を待機  
    });  

    describe("基本的なストリーミング機能", function () {  
        it("ライセンスを持っていない場合はストリーミングを開始できない", async function () {  
            await expect(  
                musicStreaming.connect(user).startStream(1n, {  
                    value: ethers.parseEther("0.001")  
                })  
            ).to.be.revertedWith("No valid license");  
        });  

        it("ライセンスを購入してストリーミングを開始できる", async function () {  
            // ライセンスを購入  
            const purchaseTx = await rightsManager.connect(user).purchaseLicense(  
                1n,  // tokenId  
                0n,  // PERSONAL license  
                { value: ethers.parseEther("0.01") }  
            );  
            await purchaseTx.wait();  

            // ストリーミングを開始  
            await expect(  
                musicStreaming.connect(user).startStream(1n, {  
                    value: ethers.parseEther("0.001")  
                })  
            ).to.emit(musicStreaming, "StreamStarted")  
             .withArgs(1n, await user.getAddress(), ethers.parseEther("0.001"));  
        });  
    });  

    describe("Social Features", function () {
        it("Should create and manage playlists", async function () {
            const [user] = await ethers.getSigners();
            await musicStreaming.connect(user).createPlaylist("My Playlist", true);
            const playlist = await musicStreaming.playlists(1);
            expect(playlist.name).to.equal("My Playlist");
            expect(playlist.creator).to.equal(user.address);
        });

        it("Should handle likes correctly", async function () {
            const [user] = await ethers.getSigners();
            await musicStreaming.connect(user).likeMusic(1);
            expect(await musicStreaming.likesCount(1)).to.equal(1);
        });
    });
});