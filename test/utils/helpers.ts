// test/utils/helpers.ts  
import { ethers } from "hardhat";  
import { Contract } from "ethers";  

export async function deployContract(contractName: string, args: any[] = []): Promise<Contract> {  
    try {  
        const Factory = await ethers.getContractFactory(contractName);  
        console.log(`Deploying ${contractName} with args:`, args);  
        
        const contract = await Factory.deploy(...args);  
        // ethers v6用のデプロイ待機  
        await contract.waitForDeployment();  
        
        const address = await contract.getAddress();  
        console.log(`${contractName} deployed to:`, address);  
        
        return contract;  
    } catch (error) {  
        console.error(`Error deploying ${contractName}:`, error);  
        throw error;  
    }  
}  

export async function setupUsers() {  
    const [owner, artist, user1] = await ethers.getSigners();  
    return { owner, artist, user1 };  
}