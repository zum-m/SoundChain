// test/RightsManager.test.ts  
describe("Advanced License Features", function () {  
    beforeEach(async function () {  
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

    it("Should handle license expiration", async function () {  
        await rightsManager.connect(user1).purchaseLicense(1, 0, {  
            value: ethers.parseEther("0.1")  
        });  

        // 時間を1日後に進める  
        await network.provider.send("evm_increaseTime", [86401]);  
        await network.provider.send("evm_mine");  

        const hasValidLicense = await rightsManager.hasValidLicense(user1.address, 1);  
        expect(hasValidLicense).to.be.false;  
    });  

    it("Should track stream count correctly", async function () {  
        await rightsManager.connect(user1).purchaseLicense(1, 0, {  
            value: ethers.parseEther("0.1")  
        });  

        await rightsManager.connect(owner).recordStream(1, user1.address);  
        
        const license = await rightsManager.getLicenseDetails(user1.address, 1);  
        expect(license.streamCount).to.equal(1);  
    });  

    it("Should handle different license types", async function () {  
        // 商用ライセンスの設定  
        await rightsManager.connect(artist).setLicenseTerms(  
            1,  
            ethers.parseEther("0.5"),  
            true,  
            86400 * 30, // 30日  
            1, // COMMERCIAL  
            1000, // 1000回のストリーミング  
            2000 // 20%のロイヤリティ  
        );  

        await rightsManager.connect(user1).purchaseLicense(1, 1, {  
            value: ethers.parseEther("0.5")  
        });  

        const license = await rightsManager.getLicenseDetails(user1.address, 1);  
        expect(license.licenseType).to.equal(1); // COMMERCIAL  
    });  

    it("Should calculate and distribute royalties correctly", async function () {  
        const initialArtistBalance = await ethers.provider.getBalance(artist.address);  

        await rightsManager.connect(user1).purchaseLicense(1, 0, {  
            value: ethers.parseEther("0.1")  
        });  

        const finalArtistBalance = await ethers.provider.getBalance(artist.address);  
        const expectedRoyalty = ethers.parseEther("0.01"); // 10%  
        
        expect(finalArtistBalance - initialArtistBalance).to.equal(expectedRoyalty);  
    });  

    it("Should allow license revocation by owner", async function () {  
        await rightsManager.connect(user1).purchaseLicense(1, 0, {  
            value: ethers.parseEther("0.1")  
        });  

        await rightsManager.connect(artist).revokeLicense(1, user1.address);  
        
        const hasValidLicense = await rightsManager.hasValidLicense(user1.address, 1);  
        expect(hasValidLicense).to.be.false;  
    });  
});