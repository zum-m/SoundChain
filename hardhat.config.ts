import { HardhatUserConfig } from "hardhat/config";  
import "@nomicfoundation/hardhat-toolbox";  

const config: HardhatUserConfig = {  
  solidity: "0.8.27",  
  networks: {  
    hardhat: {  
      chainId: 31337  
    }  
  },  
  typechain: {  
    outDir: 'typechain-types',  
    target: 'ethers-v6'  
  }  
};  

export default config;  
