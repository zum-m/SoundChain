// hardhat.config.ts  
import { HardhatUserConfig } from "hardhat/config";  
import "@nomicfoundation/hardhat-toolbox";  

const config: HardhatUserConfig = {  
  solidity: {  
    version: "0.8.17",  
    settings: {  
      optimizer: {  
        enabled: true,  
        runs: 200  
      }  
    }  
  },  
  networks: {  
    hardhat: {  
      chainId: 31337  
    }  
  }  
};  

export default config;