import { ethers } from "hardhat";

export async function deployContract(contractName: string) {
  const ContractFactory = await ethers.getContractFactory(contractName);
  const contract = await ContractFactory.deploy();
  await contract.waitForDeployment();
  return contract;
}

export async function setupUsers() {
  const [owner, artist, user1] = await ethers.getSigners();
  return { owner, artist, user1 };
}