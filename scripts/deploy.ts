import { ethers } from "hardhat";  

async function main() {  
    const [deployer] = await ethers.getSigners();  
    console.log("Deploying contracts with the account:", deployer.address);  

    // Deploy MusicNFT  
    const MusicNFT = await ethers.getContractFactory("MusicNFT");  
    const musicNFT = await MusicNFT.deploy();  
    await musicNFT.waitForDeployment();  
    console.log("MusicNFT deployed to:", await musicNFT.getAddress());  

    // Deploy RightsManager  
    const RightsManager = await ethers.getContractFactory("RightsManager");  
    const rightsManager = await RightsManager.deploy(await musicNFT.getAddress());  
    await rightsManager.waitForDeployment();  
    console.log("RightsManager deployed to:", await rightsManager.getAddress());  

    // Deploy MusicStreaming  
    const MusicStreaming = await ethers.getContractFactory("MusicStreaming");  
    const musicStreaming = await MusicStreaming.deploy(await rightsManager.getAddress());  
    await musicStreaming.waitForDeployment();  
    console.log("MusicStreaming deployed to:", await musicStreaming.getAddress());  

    // フロントエンド設定の追加
    const config = {
        ipfsGateway: "https://ipfs.io/ipfs/",
        streamingEndpoint: "https://api.streaming.example.com",
        contractAddresses: {
            musicNFT: await musicNFT.getAddress(),
            rightsManager: await rightsManager.getAddress(),
            musicStreaming: await musicStreaming.getAddress()
        }
    };

    // 設定ファイルの出力
    const fs = require("fs");
    fs.writeFileSync(
        "./frontend/src/config.json",
        JSON.stringify(config, null, 2)
    );
}  

main()  
    .then(() => process.exit(0))  
    .catch((error) => {  
        console.error(error);  
        process.exit(1);  
    });
