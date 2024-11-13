// test/RightsManager.test.ts  
import { expect } from "chai";  
import { ethers } from "hardhat";  
import { deployContract, setupUsers } from "./utils/helpers";  
import { RightsManager, MusicNFT } from "../typechain-types";  
import { Contract } from "ethers";  

describe("RightsManager", function () {  
    let rightsManager: Contract;  
    let musicNFT: Contract;  
    let owner: any, artist: any, user1: any;  

    beforeEach(async function () {  
        try {  
            // Setup users  
            const users = await setupUsers();  
            owner = users.owner;  
            artist = users.artist;  
            user1 = users.user1;  

            // Deploy MusicNFT first  
            musicNFT = await deployContract("MusicNFT", []);  
            const musicNFTAddress = await musicNFT.getAddress();  
            console.log("MusicNFT deployed at:", musicNFTAddress);  

            // Then deploy RightsManager with MusicNFT address  
            rightsManager = await deployContract("RightsManager", [musicNFTAddress]);  
            console.log("RightsManager deployed at:", await rightsManager.getAddress());  
        } catch (error) {  
            console.error("Setup error:", error);  
            throw error;  
        }  
    });  

    describe("License Management", function () {  
        it("Should allow setting license terms", async function () {  
            const mintTx = await musicNFT.connect(artist).mintMusic("ipfs://1");  
            await mintTx.wait();  

            const setTermsTx = await rightsManager.connect(artist).setLicenseTerms(  
                1,  
                ethers.parseEther("0.1"),  
                true  
            );  
            await setTermsTx.wait();  

            const terms = await rightsManager.getLicenseTerms(1);  
            expect(terms.price).to.equal(ethers.parseEther("0.1"));  
            expect(terms.isActive).to.be.true;  
        });  

        it("Should allow purchasing license", async function () {  
            const mintTx = await musicNFT.connect(artist).mintMusic("ipfs://1");  
            await mintTx.wait();  

            const setTermsTx = await rightsManager.connect(artist).setLicenseTerms(  
                1,  
                ethers.parseEther("0.1"),  
                true  
            );  
            await setTermsTx.wait();  

            await expect(rightsManager.connect(user1).purchaseLicense(1, {  
                value: ethers.parseEther("0.1")  
            }))  
                .to.emit(rightsManager, "LicensePurchased")  
                .withArgs(user1.address, 1);  
        });  
    });  
});