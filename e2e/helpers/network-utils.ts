import { ethers } from 'ethers';
import { execSync } from 'child_process';

// Configuration
const FUNDING_AMOUNT_ETH = '10000'; // Amount of ETH to fund each address

export async function fundPrivateKeysInAnvil(
  privateKeys: string,
  rpcUrl: string = 'http://127.0.0.1:8545'
): Promise<void> {
  await fundPrivateKeys(privateKeys, rpcUrl, true);
}

export async function fundPrivateKeysInHardhat(
  privateKeys: string,
  rpcUrl: string = 'http://127.0.0.1:8545'
): Promise<void> {
  await fundPrivateKeys(privateKeys, rpcUrl, false);
}

async function fundPrivateKeys(
  pks: string,
  rpcUrl: string,
  isAnvil: boolean
): Promise<void> {
  const environment = isAnvil ? 'Anvil' : 'Hardhat';
  console.log(`💰 Funding addresses with ${environment}...`);

  try {
    // Create provider for the local network
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    // Get the private keys
    const pkArray = pks.split(',').map(pk => pk.trim());
    console.log(`📋 Found ${pkArray.length} private keys to fund`);
    
    // Extract addresses from private keys
    const addresses: string[] = [];
    for (let i = 0; i < pkArray.length; i++) {
      const wallet = new ethers.Wallet(pkArray[i], provider);
      addresses.push(wallet.address);
      console.log(`👤 Address ${i}: ${wallet.address}`);
    }
    
    // Fund each address
    const fundingAmount = ethers.utils.parseEther(FUNDING_AMOUNT_ETH);
    console.log(`💰 Funding each address with ${FUNDING_AMOUNT_ETH} ETH using ${environment}`);
    
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      
      // Check current balance
      const currentBalance = await provider.getBalance(address);
      console.log(`📊 Address ${i} (${address}) current balance: ${ethers.utils.formatEther(currentBalance)} ETH`);
      
      // Skip funding if current balance is already sufficient
      if (currentBalance.gte(fundingAmount)) {
        console.log(`⏭️  Skipping funding for address ${i} (${address}) - already has sufficient balance`);
        continue;
      }
      
      // Fund using the appropriate method based on environment
      if (isAnvil) {
        await _fundInAnvil(address, fundingAmount);
      } else {
        await _fundInHardhat(provider, address, fundingAmount);
      }
      
      // Verify the funding
      const newBalance = await provider.getBalance(address);
      console.log(`📊 Address ${i} (${address}) new balance: ${ethers.utils.formatEther(newBalance)} ETH`);
    }
    
    console.log(`✅ Address funding completed with ${environment}`);
  } catch (error) {
    console.error(`❌ Error funding addresses with ${environment}:`, error);
    throw error;
  }
}

async function _fundInAnvil(address: string, fundingAmount: ethers.BigNumber): Promise<void> {
  try {
    const anvilCommand = `cast rpc anvil_setBalance ${address} ${fundingAmount.toHexString()}`;
    console.log(`📝 Funding with anvil: ${anvilCommand}`);
    
    execSync(anvilCommand, { 
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: process.cwd(),
    });
    console.log(`✅ Successfully funded address (${address}) using anvil`);
  } catch (error) {
    console.error(`❌ Failed to fund address (${address}) with anvil:`, error.message);
    throw error;
  }
}

async function _fundInHardhat(provider: ethers.providers.JsonRpcProvider, address: string, fundingAmount: ethers.BigNumber): Promise<void> {
  try {
    console.log(`📝 Funding with hardhat: setting balance for ${address} to ${ethers.utils.formatEther(fundingAmount)} ETH`);
    
    // Use Hardhat's programmatic API to set balance
    await provider.send("hardhat_setBalance", [
      address,
      fundingAmount.toHexString()
    ]);
    
    console.log(`✅ Successfully funded address (${address}) using hardhat`);
  } catch (error) {
    console.error(`❌ Failed to fund address (${address}) with hardhat:`, error.message);
    throw error;
  }
}

export async function checkAccountBalances(
  privateKeys: string[],
  rpcUrl: string = 'http://127.0.0.1:8545'
): Promise<boolean> {
  console.log('🔍 Checking account balances...');
  
  try {
    // Create provider for the network
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    // Check each private key balance
    for (let i = 0; i < privateKeys.length; i++) {
      const privateKey = privateKeys[i].trim();
      
      if (!privateKey) {
        console.log(`❌ Private key at index ${i} is empty`);
        return false;
      }
      
      const wallet = new ethers.Wallet(privateKey, provider);
      const balance = await provider.getBalance(wallet.address);
      console.log(`📊 Account[${i}] (${wallet.address}) balance: ${ethers.utils.formatEther(balance)} ETH`);
      
      if (balance.eq(0)) {
        console.log(`❌ Account[${i}] has zero balance`);
        return false;
      }
    }
    
    console.log('✅ All accounts have sufficient balance');
    return true;
  } catch (error) {
    console.error('❌ Error checking account balances:', error);
    return false;
  }
}
