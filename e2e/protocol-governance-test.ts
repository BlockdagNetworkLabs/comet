import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { DynamicHardhatConfig } from './helpers/dynamic-hardhat-config';
import { extractProposalId } from '../scripts/helpers/commandUtil';
import { expect } from 'chai';
import { discoverMarkets, updateInfrastructureConfiguration } from './helpers/deployment-manager';
import { CometRewardFunder } from '../scripts/governor/propose/comet-reward-funding/index';
import { getMultisigThreshold, getTimelockDelay } from '../src/deploy/helpers/govConfiguration';
import { fundPrivateKeysInAnvil, fundPrivateKeysInHardhat, checkAccountBalances } from './helpers/network-utils';

//Parameters
let E2E_NETWORK_CONFIG = {
  chainId: process.env.E2E_CHAIN_ID ? parseInt(process.env.E2E_CHAIN_ID) : process.env.LOCAL_CHAIN_ID ? parseInt(process.env.LOCAL_CHAIN_ID) : 1337, 
  url: process.env.E2E_RPC_URL || 'http://127.0.0.1:8545', 
} as any;
const TEMPLATE_NAME = process.env.E2E_TEMPLATE || '_template-1';

// Configuration
const TEMP_HARDHAT_CONFIG_FILE_NAME = 'temp-hardhat.config.ts';
const NETWORK_NAME = 'e2e-network';

const PROTOCOL_DEPLOYMENT_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const PROPOSE_PHASE_1_TIMEOUT = 5 * 60 * 1000; // 5 minutes

const TEST_HARDHAT_CONFIG_PATH = path.join(__dirname, TEMP_HARDHAT_CONFIG_FILE_NAME);
const TEST_DEPLOYMENT_PATH = path.join(__dirname, '../deployments', NETWORK_NAME);
const TEMPLATE_PATH = path.join(__dirname, TEMPLATE_NAME);

const DEFAULT_PK = process.env.TEST_PK ?? '';
const ADMIN_PKS = process.env.TEST_ADMIN_PKS ?? '';

let EXECUTE_TIMEOUT: number;
let MULTISIG_THRESHOLD: number;

describe('E2E Protocol Governance Test Suite', function () {

  before(async function () {
    await setupTestAccounts(this);
  });
  
  describe('Complete Protocol Deployment', function () {
    // Tests deploying all markets at once
    before(async function () {
      // Set test environment variables
      process.env.TEST = 'true';
      process.env.TEST_HARDHAT_CONFIG = TEST_HARDHAT_CONFIG_PATH;
       
      // Copy template files to e2e root
      await copyDirectory(TEMPLATE_PATH, TEST_DEPLOYMENT_PATH, [TEMPLATE_NAME]);

      await reloadHardhatConfigToIncorporateSigner(DEFAULT_PK);
    });

    after(async function () {
      await deleteDirectory();
      await deleteHardhatConfigFile();
      // Clean up test environment variables
      delete process.env.TEST;
      delete process.env.TEST_HARDHAT_CONFIG;
    });

    it('should deploy protocol successfully', async function () {
      this.timeout(PROTOCOL_DEPLOYMENT_TIMEOUT);
      console.log(`🚀 Testing protocol deployment for ${TEMPLATE_NAME}...`);
      
      try {
        // Run deployment command - all internal hardhat commands will now use the test config
        const command = `yes | npx ts-node scripts/deployer/deploy-markets/index.ts --network ${NETWORK_NAME} --deployments all --clean`;
        
        console.log(`📝 Running deployment command: ${command}`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        console.log('Deployment output:', result);
        console.log(`✅ Protocol deployment test passed for ${TEMPLATE_NAME}`);
      } catch (error) {
        console.error('Deployment failed:', error.message);
        throw error;
      }
    });
  });

  describe('Incremental Protocol Deployment', function () {
    // Tests deploying subset of markets + governance proposals
    let excludedDeployment: string = '';
    let marketPhase1ProposalId: string = '';
    let marketPhase1ExecutionTimestamp: number | null = null;
    let newCometAddress: string | null = null;
    let marketPhase2ProposalId: string | null = null;
    let marketPhase2ExecutionTimestamp: number | null = null;

    before(async function () {
      // Set test environment variables
      process.env.TEST = 'true';
      process.env.TEST_HARDHAT_CONFIG = TEST_HARDHAT_CONFIG_PATH;

      await copyDirectory(TEMPLATE_PATH, TEST_DEPLOYMENT_PATH, [TEMPLATE_NAME]);

      await loadInitialConfigurationForMultisigGovernance();

      await reloadHardhatConfigToIncorporateSigner(DEFAULT_PK);
    });

    after(async function () {
      await deleteDirectory();
      await deleteHardhatConfigFile();
      // Clean up test environment variables
      delete process.env.TEST;
      delete process.env.TEST_HARDHAT_CONFIG;
    });

    it('should deploy all deployments except one', async function () {
      this.timeout(PROTOCOL_DEPLOYMENT_TIMEOUT);

      // Fetch all available deployment names
      const availableDeployments = await discoverMarkets(TEST_DEPLOYMENT_PATH);
      console.log(`📋 Found ${availableDeployments.length} available deployments:`, availableDeployments);
      
      if (availableDeployments.length < 2) {
        console.log('⚠️  Not enough deployments to test selective deployment (need at least 2)');
        this.parent.skip();
      }

      // Select one deployment to exclude (first one)
      excludedDeployment = availableDeployments[0];
      const deploymentsToDeploy = availableDeployments.slice(1);
      
      console.log(`🚀 Testing selective deployment...`);
      console.log(`📋 Excluding deployment: ${excludedDeployment}`);
      console.log(`📋 Deploying deployments: ${deploymentsToDeploy.join(', ')}`);
      
      try {
        // Build deployment command with specific deployments
        const deploymentsList = deploymentsToDeploy.join(' ');
        const command = `yes | npx ts-node scripts/deployer/deploy-markets/index.ts --network ${NETWORK_NAME} --deployments ${deploymentsList} --clean`;
        
        console.log(`📝 Running deployment command: ${command}`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        console.log('Deployment output:', result);
        console.log(`✅ Selective deployment test passed - deployed: ${deploymentsToDeploy.join(', ')}`);
        console.log(`✅ Excluded deployment: ${excludedDeployment}`);
      } catch (error) {
        console.error('Selective deployment failed:', error.message);
        throw error;
      }
    });

    it('should propose deployment for excluded market', async function () {
      this.timeout(PROPOSE_PHASE_1_TIMEOUT);
      
      if (!excludedDeployment) {
        throw new Error('⚠️  No excluded deployment to propose');
      }
      
      await runWithSigner(getAdminPrivateKey(0), async () => {
      
        console.log(`🚀 Testing governance proposal for excluded deployment: ${excludedDeployment}`);
      // Create a proposal to deploy the excluded market
      const command = `yes | npx ts-node scripts/governor/propose/market-phase-1/index.ts --network ${NETWORK_NAME} --deployment ${excludedDeployment}`;
      
      console.log(`📝 Running proposal command: ${command}`);
        console.log(`📝 Using admin private key for governance operations`);

      const result = execSync(command, { 
        encoding: 'utf8',
        stdio: 'pipe',
        cwd: process.cwd(),
      });
        
      try {
        marketPhase1ProposalId = extractProposalId(result);
        console.log(`📝 Proposal ID: ${marketPhase1ProposalId}`);
        console.log(`✅ Governance proposal test passed for ${excludedDeployment}`);
      } catch (extractError) {
        console.error(`❌ Failed to extract proposal ID: ${extractError.message}`);
        throw new Error(`Proposal ID extraction failed: ${extractError.message}`);
      }
    });
    });

    it('should accept market phase 1 proposal with required admin signatures', async function () {      
      if (!marketPhase1ProposalId) {
        throw new Error('⚠️  No proposal ID available to accept');
      }
      
      // Get threshold from environment (assume it exists)
      const threshold = MULTISIG_THRESHOLD;
      console.log(`📋 Required threshold for proposal acceptance: ${threshold}`);
      
      // Get admin signers from environment (assume it exists)
      const adminSigners = ADMIN_PKS;
      const adminPkArray = adminSigners.split(',').map(pk => pk.trim());
      console.log(`📋 Available admin signers: ${adminPkArray.length}`);
      
      // Iterate through required number of admins to meet threshold
      for (let i = 0; i < Math.min(threshold, adminPkArray.length); i++) {
        console.log(`🎯 Accepting proposal with admin ${i + 1}/${threshold}`);
        
        await runWithSigner(getAdminPrivateKey(i), async () => {
          const command = `npx ts-node scripts/governor/accept-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${marketPhase1ProposalId}`;
          
          console.log(`📝 Running accept proposal command: ${command}`);
          console.log(`📝 Using admin private key ${i + 1} for proposal acceptance`);
          
          const result = execSync(command, { 
            encoding: 'utf8',
            stdio: 'pipe',
            cwd: process.cwd(),
          });
          
          console.log(`✅ Admin ${i + 1} acceptance result:`, result);
        });
      }
      
      console.log(`✅ Proposal acceptance completed with ${threshold} admin signatures`);
    });

    it('should queue market phase 1 proposal with first admin', async function () {      
      if (!marketPhase1ProposalId) {
        throw new Error('⚠️  No proposal ID available to queue');
      }
      
      console.log(`🚀 Queueing proposal: ${marketPhase1ProposalId}`);
      
      // Use only the first admin to queue the proposal
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/queue-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${marketPhase1ProposalId}`;
        
        console.log(`📝 Running queue proposal command: ${command}`);
        console.log(`📝 Using first admin private key for proposal queueing`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Queue proposal result:`, result);
        
        // Extract execution timestamp from the output
        const etaMatch = result.match(/ETA: (\d+)/);
        if (etaMatch) {
          marketPhase1ExecutionTimestamp = parseInt(etaMatch[1]);
          console.log(`📅 Execution timestamp captured: ${marketPhase1ExecutionTimestamp}`);
          console.log(`📅 Execution time: ${new Date(marketPhase1ExecutionTimestamp * 1000).toLocaleString()}`);
        } else {
          throw new Error('Could not extract execution timestamp from queue output');
        }
      });
      
      // Remove this line:
      // (this as any).executionTimestamp = executionTimestamp;
      
      console.log(`✅ Proposal queueing completed with first admin`);
    });

    it('should execute market phase 1 proposal with first admin', async function () {  
      this.timeout(EXECUTE_TIMEOUT);    
      if (!marketPhase1ProposalId) {
        throw new Error('⚠️  No proposal ID available to execute');
      }
      
      // Get execution timestamp from previous test
      if (!marketPhase1ExecutionTimestamp) {
        throw new Error('⚠️  No execution timestamp available from queue test');
      }
      
      console.log(`🚀 Executing market phase 1 proposal: ${marketPhase1ProposalId}`);
      console.log(`📅 Waiting until execution time: ${new Date(marketPhase1ExecutionTimestamp * 1000).toLocaleString()}`);
      
      // Wait until the execution timestamp is reached
      const currentTime = Math.floor(Date.now() / 1000);
      const timeToWait = marketPhase1ExecutionTimestamp - currentTime;
      
      if (timeToWait > 0) {
        console.log(`⏳ Waiting ${timeToWait} seconds until execution time...`);
        await new Promise(resolve => setTimeout(resolve, timeToWait * 1000));
      }
      
      console.log(`✅ Execution time reached, proceeding with execution`);
      
      // Use only the first admin to execute the proposal
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/execute-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${marketPhase1ProposalId} --execution-type comet-impl-in-configuration`;
        
        console.log(`📝 Running execute proposal command: ${command}`);
        console.log(`📝 Using first admin private key for proposal execution`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Execute proposal result:`, result);
        
        // Extract newComet address from the execution output
        const newCometMatch = result.match(/newComet[":\s]+([a-fA-F0-9x]+)/);
        if (newCometMatch) {
          newCometAddress = newCometMatch[1];
          console.log(`🏗️  New Comet address extracted: ${newCometAddress}`);
        } else {
          throw new Error('Could not extract newComet address from execution output');
        }
      });
  
      expect(newCometAddress).to.be.not.empty;
      
      console.log(`✅ Market phase 1 proposal execution completed with newComet: ${newCometAddress}`);
    });

    it('should propose market phase 2 upgrade with first admin', async function () {
      if (!newCometAddress) {
        throw new Error('⚠️  No newComet address available from phase 1 execution');
      }
      
      if (!excludedDeployment) {
        throw new Error('⚠️  No excluded deployment available for phase 2');
      }
      
      console.log(`🚀 Proposing market phase 2 upgrade for deployment: ${excludedDeployment}`);
      console.log(`🔧 Using newComet implementation: ${newCometAddress}`);
      
      // Use only the first admin to propose the phase 2 upgrade
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/propose/market-phase-2/index.ts --network ${NETWORK_NAME} --deployment ${excludedDeployment} --implementation ${newCometAddress}`;
        
        console.log(`📝 Running market phase 2 proposal command: ${command}`);
        console.log(`📝 Using first admin private key for phase 2 proposal`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Market phase 2 proposal result:`, result);
        
        try {
          marketPhase2ProposalId = extractProposalId(result);
          console.log(`📝 Market Phase 2 Proposal ID: ${marketPhase2ProposalId}`);
        } catch (extractError) {
          console.error(`❌ Failed to extract market phase 2 proposal ID: ${extractError.message}`);
          throw new Error(`Market Phase 2 Proposal ID extraction failed: ${extractError.message}`);
        }
      });
      
      console.log(`✅ Market phase 2 proposal created with ID: ${marketPhase2ProposalId}`);
    });

    it('should accept market phase 2 proposal with required admin signatures', async function () {
      if (!marketPhase2ProposalId) {
        throw new Error('⚠️  No market phase 2 proposal ID available to accept');
      }
      
      // Get threshold from environment (assume it exists)
      const threshold = MULTISIG_THRESHOLD;
      console.log(`📋 Required threshold for market phase 2 proposal acceptance: ${threshold}`);
      
      // Get admin signers from environment (assume it exists)
      const adminSigners = ADMIN_PKS;
      const adminPkArray = adminSigners.split(',').map(pk => pk.trim());
      console.log(`📋 Available admin signers: ${adminPkArray.length}`);
      
      // Iterate through required number of admins to meet threshold
      for (let i = 0; i < Math.min(threshold, adminPkArray.length); i++) {
        console.log(`🎯 Accepting market phase 2 proposal with admin ${i + 1}/${threshold}`);
        
        await runWithSigner(getAdminPrivateKey(i), async () => {
          const command = `npx ts-node scripts/governor/accept-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${marketPhase2ProposalId}`;
          
          console.log(`📝 Running accept market phase 2 proposal command: ${command}`);
          console.log(`📝 Using admin private key ${i + 1} for market phase 2 proposal acceptance`);
          
          const result = execSync(command, { 
            encoding: 'utf8',
            stdio: 'pipe',
            cwd: process.cwd(),
          });
          
          console.log(`✅ Admin ${i + 1} market phase 2 acceptance result:`, result);
        });
      }
      
      console.log(`✅ Market phase 2 proposal acceptance completed with ${threshold} admin signatures`);
    });

    it('should queue market phase 2 proposal with first admin', async function () {    
      if (!marketPhase2ProposalId) {
        throw new Error('⚠️  No market phase 2 proposal ID available to queue');
      }
      
      console.log(`🚀 Queueing market phase 2 proposal: ${marketPhase2ProposalId}`);
      
      // Use only the first admin to queue the market phase 2 proposal
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/queue-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${marketPhase2ProposalId}`;
        
        console.log(`📝 Running queue market phase 2 proposal command: ${command}`);
        console.log(`📝 Using first admin private key for market phase 2 proposal queueing`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Queue market phase 2 proposal result:`, result);
        
        // Extract execution timestamp from the output
        const etaMatch = result.match(/ETA: (\d+)/);
        if (etaMatch) {
          marketPhase2ExecutionTimestamp = parseInt(etaMatch[1]);
          console.log(`📅 Market Phase 2 execution timestamp captured: ${marketPhase2ExecutionTimestamp}`);
          console.log(`📅 Market Phase 2 execution time: ${new Date(marketPhase2ExecutionTimestamp * 1000).toLocaleString()}`);
        } else {
          throw new Error('Could not extract execution timestamp from market phase 2 queue output');
        }
      });
      
      console.log(`✅ Market phase 2 proposal queueing completed with first admin`);
    });

    it('should execute market phase 2 proposal with first admin', async function () {
      this.timeout(EXECUTE_TIMEOUT);
      if (!marketPhase2ProposalId) {
        throw new Error('⚠️  No market phase 2 proposal ID available to execute');
      }
      
      // Get execution timestamp from previous test
      if (!marketPhase2ExecutionTimestamp) {
        throw new Error('⚠️  No execution timestamp available from market phase 2 queue test');
      }
      
      console.log(`🚀 Executing market phase 2 proposal: ${marketPhase2ProposalId}`);
      console.log(`📅 Waiting until execution time: ${new Date(marketPhase2ExecutionTimestamp * 1000).toLocaleString()}`);
      
      // Wait until the execution timestamp is reached
      const currentTime = Math.floor(Date.now() / 1000);
      const timeToWait = marketPhase2ExecutionTimestamp - currentTime;
      
      if (timeToWait > 0) {
        console.log(`⏳ Waiting ${timeToWait} seconds until market phase 2 execution time...`);
        await new Promise(resolve => setTimeout(resolve, timeToWait * 1000));
      }
      
      console.log(`✅ Market phase 2 execution time reached, proceeding with execution`);
      
      // Use only the first admin to execute the market phase 2 proposal
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/execute-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${marketPhase2ProposalId} --execution-type comet-upgrade`;
        
        console.log(`📝 Running execute market phase 2 proposal command: ${command}`);
        console.log(`📝 Using first admin private key for market phase 2 proposal execution`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Execute market phase 2 proposal result:`, result);
      });
      
      console.log(`✅ Market phase 2 proposal execution completed with first admin`);
    });

    it('should test market deployment after governance completion', async function () {      
      if (!excludedDeployment) {
        throw new Error('⚠️  No excluded deployment available for testing');
      }
      
      console.log(`🧪 Testing market deployment: ${excludedDeployment}`);
      
      try {
        const command = `npx ts-node scripts/governor/test-market-setup/index.ts --network ${NETWORK_NAME} --deployment ${excludedDeployment}`;
        
        console.log(`📝 Running market test command: ${command}`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log('Market test output:', result);
        console.log(`✅ Market deployment test passed for ${excludedDeployment}`);
      } catch (error) {
        console.error('Market test failed:', error.message);
        throw error;
      }
    });
  });
  
  describe('Protocol Deployment with Market Update', function () {
    // Tests deploying all markets + updating one market via governance
    let targetMarketForUpdate: string = '';
    let marketPhase1ProposalId: string = '';
    let marketPhase1ExecutionTimestamp: number | null = null;
    let newCometAddress: string | null = null;
    let marketPhase2ProposalId: string | null = null;
    let marketPhase2ExecutionTimestamp: number | null = null;

    before(async function () {
      // Set test environment variables
      process.env.TEST = 'true';
      process.env.TEST_HARDHAT_CONFIG = TEST_HARDHAT_CONFIG_PATH;
       
      // Copy template files to e2e root
      await copyDirectory(TEMPLATE_PATH, TEST_DEPLOYMENT_PATH, [TEMPLATE_NAME]);

      await loadInitialConfigurationForMultisigGovernance();

      await reloadHardhatConfigToIncorporateSigner(DEFAULT_PK);
    });

    after(async function () {
      await deleteDirectory();
      await deleteHardhatConfigFile();
      // Clean up test environment variables
      delete process.env.TEST;
      delete process.env.TEST_HARDHAT_CONFIG;
    });

    it('should deploy protocol successfully', async function () {
      this.timeout(PROTOCOL_DEPLOYMENT_TIMEOUT);
      console.log(`🚀 Testing protocol deployment for ${TEMPLATE_NAME}...`);
      
      try {
        // Run deployment command - all internal hardhat commands will now use the test config
        const command = `yes | npx ts-node scripts/deployer/deploy-markets/index.ts --network ${NETWORK_NAME} --deployments all --clean`;
        
        console.log(`📝 Running deployment command: ${command}`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        console.log('Deployment output:', result);
        console.log(`✅ Protocol deployment test passed for ${TEMPLATE_NAME}`);
      } catch (error) {
        console.error('Deployment failed:', error.message);
        throw error;
      }
    });

    it('should select and modify target market for update', async function () {
      // Fetch all available deployment names
      const availableDeployments = await discoverMarkets(TEST_DEPLOYMENT_PATH);
      console.log(`📋 Found ${availableDeployments.length} available deployments:`, availableDeployments);

      // Select first deployment as target for update
      targetMarketForUpdate = availableDeployments[0];
      console.log(`🎯 Selected target market for update: ${targetMarketForUpdate}`);
      
      // Import helper functions
      const { 
        getAllAssetsConfiguration, 
        getConfigurationValue,
        modifyMarketParameters 
      } = await import('./helpers/deployment-manager');
      
      // Get all liquidation factors for all assets in the target market
      const liquidationFactors = await getAllAssetsConfiguration(
        TEST_DEPLOYMENT_PATH, 
        targetMarketForUpdate, 
        'liquidateCF'
      );
      
      console.log(`📊 Current liquidation factors:`, liquidationFactors);
      
      // Get store front price factor value from configuration first level
      const storeFrontPriceFactor = await getConfigurationValue(
        TEST_DEPLOYMENT_PATH, 
        targetMarketForUpdate, 
        'storeFrontPriceFactor'
      );
      
      console.log(`📊 Current store front price factor:`, storeFrontPriceFactor);
      
      // Build modifications object to increase each liquidation factor by 0.1
      const modifications: Record<string, any> = {};
      
      // Increase each asset's liquidation factor by 0.1
      for (const [asset, currentValue] of Object.entries(liquidationFactors)) {
        if (currentValue !== undefined && currentValue !== null) {
          const numericValue = Number(currentValue);
          if (!isNaN(numericValue)) {
            const newValue = parseFloat((numericValue + 0.1).toFixed(1));
            // Skip if new value would exceed 1.0
            if (newValue > 1.0) {
              console.log(`⚠️  Skipping ${asset} liquidateCF - new value ${newValue} would exceed 1.0 (current: ${currentValue})`);
            } else {
              modifications[`assets.${asset}.liquidateCF`] = newValue;
              console.log(`📝 ${asset} liquidateCF: ${currentValue} → ${newValue} (+0.1)`);
            }
          } else {
            console.log(`⚠️  Skipping ${asset} liquidateCF - non-numeric value: ${currentValue}`);
          }
        }
      }
      
      // Increase store front price factor by 0.1 (top-level configuration)
      if (storeFrontPriceFactor !== undefined && storeFrontPriceFactor !== null) {
        const numericValue = Number(storeFrontPriceFactor);
        if (!isNaN(numericValue)) {
          const newValue = parseFloat((numericValue + 0.1).toFixed(1));
          // Skip if new value would exceed 1.0
          if (newValue > 1.0) {
            console.log(`⚠️  Skipping storeFrontPriceFactor - new value ${newValue} would exceed 1.0 (current: ${storeFrontPriceFactor})`);
          } else {
            modifications['storeFrontPriceFactor'] = newValue;
            console.log(`📝 storeFrontPriceFactor: ${storeFrontPriceFactor} → ${newValue} (+0.1)`);
          }
        } else {
          console.log(`⚠️  Skipping storeFrontPriceFactor - non-numeric value: ${storeFrontPriceFactor}`);
        }
      }
      
      if(Object.keys(modifications).length === 0) {
        console.log('⚠️  No modifications to apply, skipping remaining tests.');
        this.parent.skip();
      }

      await modifyMarketParameters(TEST_DEPLOYMENT_PATH, targetMarketForUpdate, modifications);
      console.log(`✅ Market parameters modified for ${targetMarketForUpdate}`);
      console.log(`📊 Increased liquidation factors for ${Object.keys(liquidationFactors).length} assets by 0.1`);
      console.log(`📊 Increased store front price factor by 0.1`);
    });

    it('should propose market phase 1 update with first admin', async function () {
      this.timeout(PROPOSE_PHASE_1_TIMEOUT);
      
      if (!targetMarketForUpdate) {
        throw new Error('⚠️  No target market selected for update');
      }
      
      await runWithSigner(getAdminPrivateKey(0), async () => {
        console.log(`🚀 Testing governance proposal for market update: ${targetMarketForUpdate}`);
        // Create a proposal to update the target market
        const command = `yes | npx ts-node scripts/governor/propose/market-phase-1/index.ts --network ${NETWORK_NAME} --deployment ${targetMarketForUpdate}`;
        
        console.log(`📝 Running proposal command: ${command}`);
        console.log(`📝 Using admin private key for governance operations`);

        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        try {
          marketPhase1ProposalId = extractProposalId(result);
          console.log(`📝 Proposal ID: ${marketPhase1ProposalId}`);
          console.log(`✅ Governance proposal test passed for ${targetMarketForUpdate}`);
        } catch (extractError) {
          console.error(`❌ Failed to extract proposal ID: ${extractError.message}`);
          throw new Error(`Proposal ID extraction failed: ${extractError.message}`);
        }
      });
    });

    it('should accept market phase 1 update proposal with required admin signatures', async function () {      
      if (!marketPhase1ProposalId) {
        throw new Error('⚠️  No proposal ID available to accept');
      }
      
      // Get threshold from environment (assume it exists)
      const threshold = MULTISIG_THRESHOLD;
      console.log(`📋 Required threshold for proposal acceptance: ${threshold}`);
      
      // Get admin signers from environment (assume it exists)
      const adminSigners = ADMIN_PKS;
      const adminPkArray = adminSigners.split(',').map(pk => pk.trim());
      console.log(`📋 Available admin signers: ${adminPkArray.length}`);
      
      // Iterate through required number of admins to meet threshold
      for (let i = 0; i < Math.min(threshold, adminPkArray.length); i++) {
        console.log(`🎯 Accepting proposal with admin ${i + 1}/${threshold}`);
        
        await runWithSigner(getAdminPrivateKey(i), async () => {
          const command = `npx ts-node scripts/governor/accept-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${marketPhase1ProposalId}`;
          
          console.log(`📝 Running accept proposal command: ${command}`);
          console.log(`📝 Using admin private key ${i + 1} for proposal acceptance`);
          
          const result = execSync(command, { 
            encoding: 'utf8',
            stdio: 'pipe',
            cwd: process.cwd(),
          });
          
          console.log(`✅ Admin ${i + 1} acceptance result:`, result);
        });
      }
      
      console.log(`✅ Proposal acceptance completed with ${threshold} admin signatures`);
    });

    it('should queue market phase 1 update proposal with first admin', async function () {      
      if (!marketPhase1ProposalId) {
        throw new Error('⚠️  No proposal ID available to queue');
      }
      
      console.log(`🚀 Queueing proposal: ${marketPhase1ProposalId}`);
      
      // Use only the first admin to queue the proposal
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/queue-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${marketPhase1ProposalId}`;
        
        console.log(`📝 Running queue proposal command: ${command}`);
        console.log(`📝 Using first admin private key for proposal queueing`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Queue proposal result:`, result);
        
        // Extract execution timestamp from the output
        const etaMatch = result.match(/ETA: (\d+)/);
        if (etaMatch) {
          marketPhase1ExecutionTimestamp = parseInt(etaMatch[1]);
          console.log(`📅 Execution timestamp captured: ${marketPhase1ExecutionTimestamp}`);
          console.log(`📅 Execution time: ${new Date(marketPhase1ExecutionTimestamp * 1000).toLocaleString()}`);
        } else {
          throw new Error('Could not extract execution timestamp from queue output');
        }
      });
      
      console.log(`✅ Proposal queueing completed with first admin`);
    });

    it('should execute market phase 1 update proposal with first admin', async function () {  
      this.timeout(EXECUTE_TIMEOUT);    
      if (!marketPhase1ProposalId) {
        throw new Error('⚠️  No proposal ID available to execute');
      }
      
      // Get execution timestamp from previous test
      if (!marketPhase1ExecutionTimestamp) {
        throw new Error('⚠️  No execution timestamp available from queue test');
      }
      
      console.log(`🚀 Executing market phase 1 update proposal: ${marketPhase1ProposalId}`);
      console.log(`📅 Waiting until execution time: ${new Date(marketPhase1ExecutionTimestamp * 1000).toLocaleString()}`);
      
      // Wait until the execution timestamp is reached
      const currentTime = Math.floor(Date.now() / 1000);
      const timeToWait = marketPhase1ExecutionTimestamp - currentTime;
      
      if (timeToWait > 0) {
        console.log(`⏳ Waiting ${timeToWait} seconds until execution time...`);
        await new Promise(resolve => setTimeout(resolve, timeToWait * 1000));
      }
      
      console.log(`✅ Execution time reached, proceeding with execution`);
      
      // Use only the first admin to execute the proposal
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/execute-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${marketPhase1ProposalId} --execution-type comet-impl-in-configuration`;
        
        console.log(`📝 Running execute proposal command: ${command}`);
        console.log(`📝 Using first admin private key for proposal execution`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Execute proposal result:`, result);
        
        // Extract newComet address from the execution output
        const newCometMatch = result.match(/newComet[":\s]+([a-fA-F0-9x]+)/);
        if (newCometMatch) {
          newCometAddress = newCometMatch[1];
          console.log(`🏗️  New Comet address extracted: ${newCometAddress}`);
        } else {
          throw new Error('Could not extract newComet address from execution output');
        }
      });
  
      expect(newCometAddress).to.be.not.empty;
      
      console.log(`✅ Market phase 1 update proposal execution completed with newComet: ${newCometAddress}`);
    });

    it('should propose market phase 2 update with first admin', async function () {
      if (!newCometAddress) {
        throw new Error('⚠️  No newComet address available from phase 1 execution');
      }
      
      if (!targetMarketForUpdate) {
        throw new Error('⚠️  No target market available for phase 2');
      }
      
      console.log(`🚀 Proposing market phase 2 update for deployment: ${targetMarketForUpdate}`);
      console.log(`🔧 Using newComet implementation: ${newCometAddress}`);
      
      // Use only the first admin to propose the phase 2 upgrade
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/propose/market-phase-2/index.ts --network ${NETWORK_NAME} --deployment ${targetMarketForUpdate} --implementation ${newCometAddress}`;
        
        console.log(`📝 Running market phase 2 proposal command: ${command}`);
        console.log(`📝 Using first admin private key for phase 2 proposal`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Market phase 2 proposal result:`, result);
        
        try {
          marketPhase2ProposalId = extractProposalId(result);
          console.log(`📝 Market Phase 2 Proposal ID: ${marketPhase2ProposalId}`);
        } catch (extractError) {
          console.error(`❌ Failed to extract market phase 2 proposal ID: ${extractError.message}`);
          throw new Error(`Market Phase 2 Proposal ID extraction failed: ${extractError.message}`);
        }
      });
      
      console.log(`✅ Market phase 2 update proposal created with ID: ${marketPhase2ProposalId}`);
    });

    it('should accept market phase 2 update proposal with required admin signatures', async function () {
      if (!marketPhase2ProposalId) {
        throw new Error('⚠️  No market phase 2 proposal ID available to accept');
      }
      
      // Get threshold from environment (assume it exists)
      const threshold = MULTISIG_THRESHOLD;
      console.log(`📋 Required threshold for market phase 2 proposal acceptance: ${threshold}`);
      
      // Get admin signers from environment (assume it exists)
      const adminSigners = ADMIN_PKS;
      const adminPkArray = adminSigners.split(',').map(pk => pk.trim());
      console.log(`📋 Available admin signers: ${adminPkArray.length}`);
      
      // Iterate through required number of admins to meet threshold
      for (let i = 0; i < Math.min(threshold, adminPkArray.length); i++) {
        console.log(`🎯 Accepting market phase 2 proposal with admin ${i + 1}/${threshold}`);
        
        await runWithSigner(getAdminPrivateKey(i), async () => {
          const command = `npx ts-node scripts/governor/accept-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${marketPhase2ProposalId}`;
          
          console.log(`📝 Running accept market phase 2 proposal command: ${command}`);
          console.log(`📝 Using admin private key ${i + 1} for market phase 2 proposal acceptance`);
          
          const result = execSync(command, { 
            encoding: 'utf8',
            stdio: 'pipe',
            cwd: process.cwd(),
          });
          
          console.log(`✅ Admin ${i + 1} market phase 2 acceptance result:`, result);
        });
      }
      
      console.log(`✅ Market phase 2 proposal acceptance completed with ${threshold} admin signatures`);
    });

    it('should queue market phase 2 update proposal with first admin', async function () {    
      if (!marketPhase2ProposalId) {
        throw new Error('⚠️  No market phase 2 proposal ID available to queue');
      }
      
      console.log(`🚀 Queueing market phase 2 proposal: ${marketPhase2ProposalId}`);
      
      // Use only the first admin to queue the market phase 2 proposal
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/queue-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${marketPhase2ProposalId}`;
        
        console.log(`📝 Running queue market phase 2 proposal command: ${command}`);
        console.log(`📝 Using first admin private key for market phase 2 proposal queueing`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Queue market phase 2 proposal result:`, result);
        
        // Extract execution timestamp from the output
        const etaMatch = result.match(/ETA: (\d+)/);
        if (etaMatch) {
          marketPhase2ExecutionTimestamp = parseInt(etaMatch[1]);
          console.log(`📅 Market Phase 2 execution timestamp captured: ${marketPhase2ExecutionTimestamp}`);
          console.log(`📅 Market Phase 2 execution time: ${new Date(marketPhase2ExecutionTimestamp * 1000).toLocaleString()}`);
        } else {
          throw new Error('Could not extract execution timestamp from market phase 2 queue output');
        }
      });
      
      console.log(`✅ Market phase 2 proposal queueing completed with first admin`);
    });

    it('should execute market phase 2 update proposal with first admin', async function () {
      this.timeout(EXECUTE_TIMEOUT);
      if (!marketPhase2ProposalId) {
        throw new Error('⚠️  No market phase 2 proposal ID available to execute');
      }
      
      // Get execution timestamp from previous test
      if (!marketPhase2ExecutionTimestamp) {
        throw new Error('⚠️  No execution timestamp available from market phase 2 queue test');
      }
      
      console.log(`🚀 Executing market phase 2 update proposal: ${marketPhase2ProposalId}`);
      console.log(`📅 Waiting until execution time: ${new Date(marketPhase2ExecutionTimestamp * 1000).toLocaleString()}`);
      
      // Wait until the execution timestamp is reached
      const currentTime = Math.floor(Date.now() / 1000);
      const timeToWait = marketPhase2ExecutionTimestamp - currentTime;
      
      if (timeToWait > 0) {
        console.log(`⏳ Waiting ${timeToWait} seconds until market phase 2 execution time...`);
        await new Promise(resolve => setTimeout(resolve, timeToWait * 1000));
      }
      
      console.log(`✅ Market phase 2 execution time reached, proceeding with execution`);
      
      // Use only the first admin to execute the market phase 2 proposal
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/execute-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${marketPhase2ProposalId} --execution-type comet-upgrade`;
        
        console.log(`📝 Running execute market phase 2 proposal command: ${command}`);
        console.log(`📝 Using first admin private key for market phase 2 proposal execution`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Execute market phase 2 proposal result:`, result);
      });
      
      console.log(`✅ Market phase 2 update proposal execution completed with first admin`);
    });

    it('should test market deployment after governance completion', async function () {
      if (!targetMarketForUpdate) {
        throw new Error('⚠️  No target market available for testing');
      }
      
      console.log(`🧪 Testing market deployment: ${targetMarketForUpdate}`);
      
      try {
        const command = `npx ts-node scripts/governor/test-market-setup/index.ts --network ${NETWORK_NAME} --deployment ${targetMarketForUpdate}`;
        
        console.log(`📝 Running market test command: ${command}`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log('Market test output:', result);
        console.log(`✅ Market deployment test passed for ${targetMarketForUpdate}`);
      } catch (error) {
        console.error('Market test failed:', error.message);
        throw error;
      }
    });
  });
  
  describe('Comet Reward Funding', function () {
    // Tests comet reward funding governance flow
    let cometRewardFundingProposalId: string = '';
    let cometRewardFundingExecutionTimestamp: number | null = null;
    let cometRewardFunder = new CometRewardFunder({network: NETWORK_NAME})
    
    before(async function () {
      // Set test environment variables
      process.env.TEST = 'true';
      process.env.TEST_HARDHAT_CONFIG = TEST_HARDHAT_CONFIG_PATH;
       
      // Copy template files to e2e root
      await copyDirectory(TEMPLATE_PATH, TEST_DEPLOYMENT_PATH, [TEMPLATE_NAME]);

      await loadInitialConfigurationForMultisigGovernance();

      await reloadHardhatConfigToIncorporateSigner(DEFAULT_PK);
    });

    after(async function () {
      await deleteDirectory();
      await deleteHardhatConfigFile();
      // Clean up test environment variables
      delete process.env.TEST;
      delete process.env.TEST_HARDHAT_CONFIG;
    });

    it('should deploy protocol successfully', async function () {
      this.timeout(PROTOCOL_DEPLOYMENT_TIMEOUT);
      console.log(`🚀 Testing protocol deployment for ${TEMPLATE_NAME}...`);
      
      try {
        // Run deployment command - all internal hardhat commands will now use the test config
        const command = `yes | npx ts-node scripts/deployer/deploy-markets/index.ts --network ${NETWORK_NAME} --deployments all --clean`;
        
        console.log(`📝 Running deployment command: ${command}`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        console.log('Deployment output:', result);
        console.log(`✅ Protocol deployment test passed for ${TEMPLATE_NAME}`);
      } catch (error) {
        console.error('Deployment failed:', error.message);
        throw error;
      }
    });

    it('should propose comet reward funding with first admin', async function () {
      
      const FUNDING_AMOUNT = '1000000000000000000000'; // 1000 COMP tokens in wei
          
      // Set up mock answers for the comet reward funding flow
      // The script will ask:
      // 1. "Enter the amount of COMP tokens to fund (in wei, e.g., 1000000000000000000000 for 1000 COMP): " -> FUNDING_AMOUNT
      // 2. "Do you want to proceed with creating a proposal to fund CometRewards with X COMP tokens?" -> true
      let mockQuestionAnswers: string[] = [FUNDING_AMOUNT];
      let mockConfirmAnswers: boolean[] = [true]; 
      
      console.log(`🚀 Testing comet reward funding proposal`);
      console.log(`💰 Funding amount: ${FUNDING_AMOUNT} COMP tokens (wei)`);

      // Use the reusable function to set up mocks
      setupMockFunctions(cometRewardFunder, mockConfirmAnswers, mockQuestionAnswers);

      await runWithSigner(getAdminPrivateKey(0), async () => {
        try {
          cometRewardFundingProposalId = await cometRewardFunder.run();
          console.log(`✅ Comet reward funding proposal completed successfully`);
        } catch (error) {
          console.error(`❌ Comet reward funding failed:`, error);
          throw error;
        }
      });
    });

    it('should accept comet reward funding proposal with required admin signatures', async function () {      
      if (!cometRewardFundingProposalId) {
        throw new Error('⚠️  No comet reward funding proposal ID available to accept');
      }
      
      // Get threshold from environment (assume it exists)
      const threshold = MULTISIG_THRESHOLD;
      console.log(`📋 Required threshold for comet reward funding proposal acceptance: ${threshold}`);
      
      // Get admin signers from environment (assume it exists)
      const adminSigners = ADMIN_PKS;
      const adminPkArray = adminSigners.split(',').map(pk => pk.trim());
      console.log(`📋 Available admin signers: ${adminPkArray.length}`);
      
      // Iterate through required number of admins to meet threshold
      for (let i = 0; i < Math.min(threshold, adminPkArray.length); i++) {
        console.log(`🎯 Accepting comet reward funding proposal with admin ${i + 1}/${threshold}`);
        
        await runWithSigner(getAdminPrivateKey(i), async () => {
          const command = `npx ts-node scripts/governor/accept-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${cometRewardFundingProposalId}`;
          
          console.log(`📝 Running accept comet reward funding proposal command: ${command}`);
          console.log(`📝 Using admin private key ${i + 1} for comet reward funding proposal acceptance`);
          
          const result = execSync(command, { 
            encoding: 'utf8',
            stdio: 'pipe',
            cwd: process.cwd(),
          });
          
          console.log(`✅ Admin ${i + 1} comet reward funding acceptance result:`, result);
        });
      }
      
      console.log(`✅ Comet reward funding proposal acceptance completed with ${threshold} admin signatures`);
    });

    it('should queue comet reward funding proposal with first admin', async function () {      
      if (!cometRewardFundingProposalId) {
        throw new Error('⚠️  No comet reward funding proposal ID available to queue');
      }
      
      console.log(`🚀 Queueing comet reward funding proposal: ${cometRewardFundingProposalId}`);
      
      // Use only the first admin to queue the comet reward funding proposal
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/queue-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${cometRewardFundingProposalId}`;
        
        console.log(`📝 Running queue comet reward funding proposal command: ${command}`);
        console.log(`📝 Using first admin private key for comet reward funding proposal queueing`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Queue comet reward funding proposal result:`, result);
        
        // Extract execution timestamp from the output
        const etaMatch = result.match(/ETA: (\d+)/);
        if (etaMatch) {
          cometRewardFundingExecutionTimestamp = parseInt(etaMatch[1]);
          console.log(`📅 Comet reward funding execution timestamp captured: ${cometRewardFundingExecutionTimestamp}`);
          console.log(`📅 Comet reward funding execution time: ${new Date(cometRewardFundingExecutionTimestamp * 1000).toLocaleString()}`);
        } else {
          throw new Error('Could not extract execution timestamp from comet reward funding queue output');
        }
      });
      
      console.log(`✅ Comet reward funding proposal queueing completed with first admin`);
    });

    it('should execute comet reward funding proposal with first admin', async function () {
      this.timeout(EXECUTE_TIMEOUT);
      if (!cometRewardFundingProposalId) {
        throw new Error('⚠️  No comet reward funding proposal ID available to execute');
      }
      
      // Get execution timestamp from previous test
      if (!cometRewardFundingExecutionTimestamp) {
        throw new Error('⚠️  No execution timestamp available from comet reward funding queue test');
      }
      
      console.log(`🚀 Executing comet reward funding proposal: ${cometRewardFundingProposalId}`);
      console.log(`📅 Waiting until execution time: ${new Date(cometRewardFundingExecutionTimestamp * 1000).toLocaleString()}`);
      
      // Wait until the execution timestamp is reached
      const currentTime = Math.floor(Date.now() / 1000);
      const timeToWait = cometRewardFundingExecutionTimestamp - currentTime;
      
      if (timeToWait > 0) {
        console.log(`⏳ Waiting ${timeToWait} seconds until comet reward funding execution time...`);
        await new Promise(resolve => setTimeout(resolve, timeToWait * 1000));
      }
      
      console.log(`✅ Comet reward funding execution time reached, proceeding with execution`);
      
      // Use only the first admin to execute the comet reward funding proposal
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/execute-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${cometRewardFundingProposalId} --execution-type comet-reward-funding`;
        
        console.log(`📝 Running execute comet reward funding proposal command: ${command}`);
        console.log(`📝 Using first admin private key for comet reward funding proposal execution`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Execute comet reward funding proposal result:`, result);
      });
      
      console.log(`✅ Comet reward funding proposal execution completed with first admin`);
      console.log(`💰 COMP tokens have been transferred to CometRewards contract`);
    });
  });
  
  describe('Governance Update (Admins and Timelock Delay)', function () {
    // Tests governance update proposal flow for both admins and timelock delay
    let governanceUpdateProposalId: string = '';
    let governanceUpdateExecutionTimestamp: number | null = null;
    
    before(async function () {
      // Set test environment variables
      process.env.TEST = 'true';
      process.env.TEST_HARDHAT_CONFIG = TEST_HARDHAT_CONFIG_PATH;
       
      // Copy template files to e2e root
      await copyDirectory(TEMPLATE_PATH, TEST_DEPLOYMENT_PATH, [TEMPLATE_NAME]);

      await loadInitialConfigurationForMultisigGovernance();

      await reloadHardhatConfigToIncorporateSigner(DEFAULT_PK);
    });

    after(async function () {
      await deleteDirectory();
      await deleteHardhatConfigFile();
      // Clean up test environment variables
      delete process.env.TEST;
      delete process.env.TEST_HARDHAT_CONFIG;
    });

    it('should deploy protocol successfully', async function () {
      this.timeout(PROTOCOL_DEPLOYMENT_TIMEOUT);
      console.log(`🚀 Testing protocol deployment for ${TEMPLATE_NAME}...`);
      
      try {
        // Run deployment command - all internal hardhat commands will now use the test config
        const command = `yes | npx ts-node scripts/deployer/deploy-markets/index.ts --network ${NETWORK_NAME} --deployments all --clean`;
        
        console.log(`📝 Running deployment command: ${command}`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        console.log('Deployment output:', result);
        console.log(`✅ Protocol deployment test passed for ${TEMPLATE_NAME}`);
      } catch (error) {
        console.error('Deployment failed:', error.message);
        throw error;
      }
    });

    it('should propose governance update (admins and timelock delay) with first admin', async function () {
      this.timeout(PROPOSE_PHASE_1_TIMEOUT);
      
      // Test configuration
      const TEST_ADMIN_ADDRESSES = ['0x1234567890123456789012345678901234567890', '0x0987654321098765432109876543210987654321'];
      const TEST_THRESHOLD = 2;
      const TEST_TIMELOCK_DELAY = 3600; // 1 hour in seconds
      
      console.log(`🚀 Testing governance update proposal (admins and timelock delay)`);
      console.log(`👥 Admin addresses: ${TEST_ADMIN_ADDRESSES.join(', ')}`);
      console.log(`🔢 Threshold: ${TEST_THRESHOLD}`);
      console.log(`⏰ Timelock delay: ${TEST_TIMELOCK_DELAY} seconds`);

      // Update infrastructure configuration with test values
      await updateInfrastructureConfiguration(TEST_DEPLOYMENT_PATH, {
        governorAdmins: TEST_ADMIN_ADDRESSES,
        multisigThreshold: TEST_THRESHOLD,
        timelockDelay: TEST_TIMELOCK_DELAY
      });

      await runWithSigner(getAdminPrivateKey(0), async () => {
        console.log(`📝 Using admin private key for governance operations`);
        
        try {
          const command = `npx ts-node scripts/governor/propose/governance-update/index.ts --network ${NETWORK_NAME}`;
          
          console.log(`📝 Running governance update proposal command: ${command}`);
          
          const result = execSync(command, { 
            encoding: 'utf8',
            stdio: 'pipe',
            cwd: process.cwd(),
          });
          
          console.log(`✅ Governance update proposal result:`, result);
          
          governanceUpdateProposalId = extractProposalId(result);
          console.log(`📋 Proposal ID: ${governanceUpdateProposalId}`);
          console.log(`✅ Governance update (admins and timelock delay) proposal completed successfully`);
        } catch (error) {
          console.error(`❌ Governance update (admins and timelock delay) failed:`, error);
          throw error;
        }
      });
    });

    it('should accept governance update proposal with required admin signatures', async function () {      
      if (!governanceUpdateProposalId) {
        throw new Error('⚠️  No governance update proposal ID available to accept');
      }
      
      // Get threshold from environment (assume it exists)
      const threshold = MULTISIG_THRESHOLD;
      console.log(`📋 Required threshold for governance update proposal acceptance: ${threshold}`);
      
      // Get admin signers from environment (assume it exists)
      const adminSigners = ADMIN_PKS;
      const adminPkArray = adminSigners.split(',').map(pk => pk.trim());
      console.log(`📋 Available admin signers: ${adminPkArray.length}`);
      
      // Iterate through required number of admins to meet threshold
      for (let i = 0; i < Math.min(threshold, adminPkArray.length); i++) {
        console.log(`🎯 Accepting governance update proposal with admin ${i + 1}/${threshold}`);
        
        await runWithSigner(getAdminPrivateKey(i), async () => {
          const command = `npx ts-node scripts/governor/accept-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${governanceUpdateProposalId}`;
          
          console.log(`📝 Running accept governance update proposal command: ${command}`);
          console.log(`📝 Using admin private key ${i + 1} for governance update proposal acceptance`);
          
          const result = execSync(command, { 
            encoding: 'utf8',
            stdio: 'pipe',
            cwd: process.cwd(),
          });
          
          console.log(`✅ Admin ${i + 1} governance update acceptance result:`, result);
        });
      }
      
      console.log(`✅ Governance update proposal acceptance completed with ${threshold} admin signatures`);
    });

    it('should queue governance update proposal with first admin', async function () {      
      if (!governanceUpdateProposalId) {
        throw new Error('⚠️  No governance update proposal ID available to queue');
      }
      
      console.log(`🚀 Queueing governance update proposal: ${governanceUpdateProposalId}`);
      
      // Use only the first admin to queue the governance update proposal
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/queue-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${governanceUpdateProposalId}`;
        
        console.log(`📝 Running queue governance update proposal command: ${command}`);
        console.log(`📝 Using first admin private key for governance update proposal queueing`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Queue governance update proposal result:`, result);
        
        // Extract execution timestamp from the output
        const etaMatch = result.match(/ETA: (\d+)/);
        if (etaMatch) {
          governanceUpdateExecutionTimestamp = parseInt(etaMatch[1]);
          console.log(`📅 Governance update execution timestamp captured: ${governanceUpdateExecutionTimestamp}`);
          console.log(`📅 Governance update execution time: ${new Date(governanceUpdateExecutionTimestamp * 1000).toLocaleString()}`);
        } else {
          throw new Error('Could not extract execution timestamp from governance update queue output');
        }
      });
      
      console.log(`✅ Governance update proposal queueing completed with first admin`);
    });

    it('should execute governance update proposal with first admin', async function () {
      this.timeout(EXECUTE_TIMEOUT);
      if (!governanceUpdateProposalId) {
        throw new Error('⚠️  No governance update proposal ID available to execute');
      }
      
      // Get execution timestamp from previous test
      if (!governanceUpdateExecutionTimestamp) {
        throw new Error('⚠️  No execution timestamp available from governance update queue test');
      }
      
      console.log(`🚀 Executing governance update proposal: ${governanceUpdateProposalId}`);
      console.log(`📅 Waiting until execution time: ${new Date(governanceUpdateExecutionTimestamp * 1000).toLocaleString()}`);
      
      // Wait until the execution timestamp is reached
      const currentTime = Math.floor(Date.now() / 1000);
      const timeToWait = governanceUpdateExecutionTimestamp - currentTime;
      
      if (timeToWait > 0) {
        console.log(`⏳ Waiting ${timeToWait} seconds until governance update execution time...`);
        await new Promise(resolve => setTimeout(resolve, timeToWait * 1000));
      }
      
      console.log(`✅ Governance update execution time reached, proceeding with execution`);
      
      // Use only the first admin to execute the governance update proposal
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/execute-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${governanceUpdateProposalId} --execution-type governance-update`;
        
        console.log(`📝 Running execute governance update proposal command: ${command}`);
        console.log(`📝 Using first admin private key for governance update proposal execution`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Execute governance update proposal result:`, result);
      });
      
      console.log(`✅ Governance update proposal execution completed with first admin`);
      console.log(`🔧 New governance configuration and timelock settings are now active`);
    });

    it('should verify governance configuration after update', async function () {
      console.log(`🧪 Verifying governance configuration after admins and timelock delay update`);
      
      try {
        const command = `npx ts-node scripts/governor/test-governor-setup/index.ts --network ${NETWORK_NAME}`;
        
        console.log(`📝 Running governance verification command: ${command}`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log('Governance verification output:', result);
        console.log(`✅ Governance configuration verification passed after admins and timelock delay update`);
      } catch (error) {
        console.error('Governance verification failed:', error.message);
        throw error;
      }
    });
  });

  describe('Governance Update (Admins Only)', function () {
    // Tests governance update proposal flow for admins only
    let governanceUpdateAdminsProposalId: string = '';
    let governanceUpdateAdminsExecutionTimestamp: number | null = null;
    
    before(async function () {
      // Set test environment variables
      process.env.TEST = 'true';
      process.env.TEST_HARDHAT_CONFIG = TEST_HARDHAT_CONFIG_PATH;
       
      // Copy template files to e2e root
      await copyDirectory(TEMPLATE_PATH, TEST_DEPLOYMENT_PATH, [TEMPLATE_NAME]);

      await loadInitialConfigurationForMultisigGovernance();

      await reloadHardhatConfigToIncorporateSigner(DEFAULT_PK);
    });

    after(async function () {
      await deleteDirectory();
      await deleteHardhatConfigFile();
      // Clean up test environment variables
      delete process.env.TEST;
      delete process.env.TEST_HARDHAT_CONFIG;
    });

    it('should deploy protocol successfully', async function () {
      this.timeout(PROTOCOL_DEPLOYMENT_TIMEOUT);
      console.log(`🚀 Testing protocol deployment for ${TEMPLATE_NAME}...`);
      
      try {
        // Run deployment command - all internal hardhat commands will now use the test config
        const command = `yes | npx ts-node scripts/deployer/deploy-markets/index.ts --network ${NETWORK_NAME} --deployments all --clean`;
        
        console.log(`📝 Running deployment command: ${command}`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        console.log('Deployment output:', result);
        console.log(`✅ Protocol deployment test passed for ${TEMPLATE_NAME}`);
      } catch (error) {
        console.error('Deployment failed:', error.message);
        throw error;
      }
    });

    it('should propose governance update (admins only) with first admin', async function () {
      this.timeout(PROPOSE_PHASE_1_TIMEOUT);
      
      // Test configuration
      const TEST_ADMIN_ADDRESSES = ['0x1234567890123456789012345678901234567890', '0x0987654321098765432109876543210987654321'];
      const TEST_THRESHOLD = 2;
      
      console.log(`🚀 Testing governance update proposal (admins only)`);
      console.log(`👥 Admin addresses: ${TEST_ADMIN_ADDRESSES.join(', ')}`);
      console.log(`🔢 Threshold: ${TEST_THRESHOLD}`);

      // Update infrastructure configuration with test values (admins only)
      await updateInfrastructureConfiguration(TEST_DEPLOYMENT_PATH, {
        governorAdmins: TEST_ADMIN_ADDRESSES,
        multisigThreshold: TEST_THRESHOLD
      });

      await runWithSigner(getAdminPrivateKey(0), async () => {
        console.log(`📝 Using admin private key for governance operations`);
        
        try {
          const command = `npx ts-node scripts/governor/propose/governance-update/index.ts --network ${NETWORK_NAME}`;
          
          console.log(`📝 Running governance update proposal command: ${command}`);
          
          const result = execSync(command, { 
            encoding: 'utf8',
            stdio: 'pipe',
            cwd: process.cwd(),
          });
          
          console.log(`✅ Governance update proposal result:`, result);
          
          governanceUpdateAdminsProposalId = extractProposalId(result);
          console.log(`📋 Proposal ID: ${governanceUpdateAdminsProposalId}`);
          console.log(`✅ Governance update (admins only) proposal completed successfully`);
        } catch (error) {
          console.error(`❌ Governance update (admins only) failed:`, error);
          throw error;
        }
      });
    });

    it('should accept governance update proposal with required admin signatures', async function () {      
      if (!governanceUpdateAdminsProposalId) {
        throw new Error('⚠️  No governance update proposal ID available to accept');
      }
      
      // Get threshold from environment (assume it exists)
      const threshold = MULTISIG_THRESHOLD;
      console.log(`📋 Required threshold for governance update proposal acceptance: ${threshold}`);
      
      // Get admin signers from environment (assume it exists)
      const adminSigners = ADMIN_PKS;
      const adminPkArray = adminSigners.split(',').map(pk => pk.trim());
      console.log(`📋 Available admin signers: ${adminPkArray.length}`);
      
      // Iterate through required number of admins to meet threshold
      for (let i = 0; i < Math.min(threshold, adminPkArray.length); i++) {
        console.log(`🎯 Accepting governance update proposal with admin ${i + 1}/${threshold}`);
        
        await runWithSigner(getAdminPrivateKey(i), async () => {
          const command = `npx ts-node scripts/governor/accept-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${governanceUpdateAdminsProposalId}`;
          
          console.log(`📝 Running accept governance update proposal command: ${command}`);
          console.log(`📝 Using admin private key ${i + 1} for governance update proposal acceptance`);
          
          const result = execSync(command, { 
            encoding: 'utf8',
            stdio: 'pipe',
            cwd: process.cwd(),
          });
          
          console.log(`✅ Admin ${i + 1} governance update acceptance result:`, result);
        });
      }
      
      console.log(`✅ Governance update proposal acceptance completed with ${threshold} admin signatures`);
    });

    it('should queue governance update proposal with first admin', async function () {      
      if (!governanceUpdateAdminsProposalId) {
        throw new Error('⚠️  No governance update proposal ID available to queue');
      }
      
      console.log(`🚀 Queueing governance update proposal: ${governanceUpdateAdminsProposalId}`);
      
      // Use only the first admin to queue the governance update proposal
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/queue-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${governanceUpdateAdminsProposalId}`;
        
        console.log(`📝 Running queue governance update proposal command: ${command}`);
        console.log(`📝 Using first admin private key for governance update proposal queueing`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Queue governance update proposal result:`, result);
        
        // Extract execution timestamp from the output
        const etaMatch = result.match(/ETA: (\d+)/);
        if (etaMatch) {
          governanceUpdateAdminsExecutionTimestamp = parseInt(etaMatch[1]);
          console.log(`📅 Governance update execution timestamp captured: ${governanceUpdateAdminsExecutionTimestamp}`);
          console.log(`📅 Governance update execution time: ${new Date(governanceUpdateAdminsExecutionTimestamp * 1000).toLocaleString()}`);
        } else {
          throw new Error('Could not extract execution timestamp from governance update queue output');
        }
      });
      
      console.log(`✅ Governance update proposal queueing completed with first admin`);
    });

    it('should execute governance update proposal with first admin', async function () {
      this.timeout(EXECUTE_TIMEOUT);
      if (!governanceUpdateAdminsProposalId) {
        throw new Error('⚠️  No governance update proposal ID available to execute');
      }
      
      // Get execution timestamp from previous test
      if (!governanceUpdateAdminsExecutionTimestamp) {
        throw new Error('⚠️  No execution timestamp available from governance update queue test');
      }
      
      console.log(`🚀 Executing governance update proposal: ${governanceUpdateAdminsProposalId}`);
      console.log(`📅 Waiting until execution time: ${new Date(governanceUpdateAdminsExecutionTimestamp * 1000).toLocaleString()}`);
      
      // Wait until the execution timestamp is reached
      const currentTime = Math.floor(Date.now() / 1000);
      const timeToWait = governanceUpdateAdminsExecutionTimestamp - currentTime;
      
      if (timeToWait > 0) {
        console.log(`⏳ Waiting ${timeToWait} seconds until governance update execution time...`);
        await new Promise(resolve => setTimeout(resolve, timeToWait * 1000));
      }
      
      console.log(`✅ Governance update execution time reached, proceeding with execution`);
      
      // Use only the first admin to execute the governance update proposal
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/execute-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${governanceUpdateAdminsProposalId} --execution-type governance-update`;
        
        console.log(`📝 Running execute governance update proposal command: ${command}`);
        console.log(`📝 Using first admin private key for governance update proposal execution`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Execute governance update proposal result:`, result);
      });
      
      console.log(`✅ Governance update proposal execution completed with first admin`);
    });

    it('should verify governance configuration after update', async function () {
      console.log(`🧪 Verifying governance configuration after admins only update`);
      
      try {
        const command = `npx ts-node scripts/governor/test-governor-setup/index.ts --network ${NETWORK_NAME}`;
        
        console.log(`📝 Running governance verification command: ${command}`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log('Governance verification output:', result);
        console.log(`✅ Governance configuration verification passed after admins only update`);
      } catch (error) {
        console.error('Governance verification failed:', error.message);
        throw error;
      }
    });
  });

  describe('Governance Update (Timelock Only)', function () {
    // Tests governance update proposal flow for timelock delay only
    let governanceUpdateTimelockProposalId: string = '';
    let governanceUpdateTimelockExecutionTimestamp: number | null = null;
    
    before(async function () {
      // Set test environment variables
      process.env.TEST = 'true';
      process.env.TEST_HARDHAT_CONFIG = TEST_HARDHAT_CONFIG_PATH;
       
      // Copy template files to e2e root
      await copyDirectory(TEMPLATE_PATH, TEST_DEPLOYMENT_PATH, [TEMPLATE_NAME]);

      await loadInitialConfigurationForMultisigGovernance();

      await reloadHardhatConfigToIncorporateSigner(DEFAULT_PK);
    });

    after(async function () {
      await deleteDirectory();
      await deleteHardhatConfigFile();
      // Clean up test environment variables
      delete process.env.TEST;
      delete process.env.TEST_HARDHAT_CONFIG;
    });

    it('should deploy protocol successfully', async function () {
      this.timeout(PROTOCOL_DEPLOYMENT_TIMEOUT);
      console.log(`🚀 Testing protocol deployment for ${TEMPLATE_NAME}...`);
      
      try {
        // Run deployment command - all internal hardhat commands will now use the test config
        const command = `yes | npx ts-node scripts/deployer/deploy-markets/index.ts --network ${NETWORK_NAME} --deployments all --clean`;
        
        console.log(`📝 Running deployment command: ${command}`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        console.log('Deployment output:', result);
        console.log(`✅ Protocol deployment test passed for ${TEMPLATE_NAME}`);
      } catch (error) {
        console.error('Deployment failed:', error.message);
        throw error;
      }
    });

    it('should propose governance update (timelock only) with first admin', async function () {
      this.timeout(PROPOSE_PHASE_1_TIMEOUT);
      
      // Test configuration
      const TEST_TIMELOCK_DELAY = 7200; // 2 hours in seconds
      
      console.log(`🚀 Testing governance update proposal (timelock only)`);
      console.log(`⏰ Timelock delay: ${TEST_TIMELOCK_DELAY} seconds`);

      // Update infrastructure configuration with test values (timelock only)
      await updateInfrastructureConfiguration(TEST_DEPLOYMENT_PATH, {
        timelockDelay: TEST_TIMELOCK_DELAY
      });

      await runWithSigner(getAdminPrivateKey(0), async () => {
        console.log(`📝 Using admin private key for governance operations`);
        
        try {
          const command = `npx ts-node scripts/governor/propose/governance-update/index.ts --network ${NETWORK_NAME}`;
          
          console.log(`📝 Running governance update proposal command: ${command}`);
          
          const result = execSync(command, { 
            encoding: 'utf8',
            stdio: 'pipe',
            cwd: process.cwd(),
          });
          
          console.log(`✅ Governance update proposal result:`, result);
          
          governanceUpdateTimelockProposalId = extractProposalId(result);
          console.log(`📋 Proposal ID: ${governanceUpdateTimelockProposalId}`);
          console.log(`✅ Governance update (timelock only) proposal completed successfully`);
        } catch (error) {
          console.error(`❌ Governance update (timelock only) failed:`, error);
          throw error;
        }
      });
    });

    it('should accept governance update proposal with required admin signatures', async function () {      
      if (!governanceUpdateTimelockProposalId) {
        throw new Error('⚠️  No governance update proposal ID available to accept');
      }
      
      // Get threshold from environment (assume it exists)
      const threshold = MULTISIG_THRESHOLD;
      console.log(`📋 Required threshold for governance update proposal acceptance: ${threshold}`);
      
      // Get admin signers from environment (assume it exists)
      const adminSigners = ADMIN_PKS;
      const adminPkArray = adminSigners.split(',').map(pk => pk.trim());
      console.log(`📋 Available admin signers: ${adminPkArray.length}`);
      
      // Iterate through required number of admins to meet threshold
      for (let i = 0; i < Math.min(threshold, adminPkArray.length); i++) {
        console.log(`🎯 Accepting governance update proposal with admin ${i + 1}/${threshold}`);
        
        await runWithSigner(getAdminPrivateKey(i), async () => {
          const command = `npx ts-node scripts/governor/accept-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${governanceUpdateTimelockProposalId}`;
          
          console.log(`📝 Running accept governance update proposal command: ${command}`);
          console.log(`📝 Using admin private key ${i + 1} for governance update proposal acceptance`);
          
          const result = execSync(command, { 
            encoding: 'utf8',
            stdio: 'pipe',
            cwd: process.cwd(),
          });
          
          console.log(`✅ Admin ${i + 1} governance update acceptance result:`, result);
        });
      }
      
      console.log(`✅ Governance update proposal acceptance completed with ${threshold} admin signatures`);
    });

    it('should queue governance update proposal with first admin', async function () {    
      if (!governanceUpdateTimelockProposalId) {
        throw new Error('⚠️  No governance update proposal ID available to queue');
      }
      
      console.log(`🚀 Queueing governance update proposal: ${governanceUpdateTimelockProposalId}`);
      
      // Use only the first admin to queue the governance update proposal
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/queue-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${governanceUpdateTimelockProposalId}`;
        
        console.log(`📝 Running queue governance update proposal command: ${command}`);
        console.log(`📝 Using first admin private key for governance update proposal queueing`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Queue governance update proposal result:`, result);
        
        // Extract execution timestamp from the output
        const etaMatch = result.match(/ETA: (\d+)/);
        if (etaMatch) {
          governanceUpdateTimelockExecutionTimestamp = parseInt(etaMatch[1]);
          console.log(`📅 Governance update execution timestamp captured: ${governanceUpdateTimelockExecutionTimestamp}`);
          console.log(`📅 Governance update execution time: ${new Date(governanceUpdateTimelockExecutionTimestamp * 1000).toLocaleString()}`);
        } else {
          throw new Error('Could not extract execution timestamp from governance update queue output');
        }
      });
      
      console.log(`✅ Governance update proposal queueing completed with first admin`);
    });

    it('should execute governance update proposal with first admin', async function () {
      this.timeout(EXECUTE_TIMEOUT);
      if (!governanceUpdateTimelockProposalId) {
        throw new Error('⚠️  No governance update proposal ID available to execute');
      }
      
      // Get execution timestamp from previous test
      if (!governanceUpdateTimelockExecutionTimestamp) {
        throw new Error('⚠️  No execution timestamp available from governance update queue test');
      }
      
      console.log(`🚀 Executing governance update proposal: ${governanceUpdateTimelockProposalId}`);
      console.log(`📅 Waiting until execution time: ${new Date(governanceUpdateTimelockExecutionTimestamp * 1000).toLocaleString()}`);
      
      // Wait until the execution timestamp is reached
      const currentTime = Math.floor(Date.now() / 1000);
      const timeToWait = governanceUpdateTimelockExecutionTimestamp - currentTime;
      
      if (timeToWait > 0) {
        console.log(`⏳ Waiting ${timeToWait} seconds until governance update execution time...`);
        await new Promise(resolve => setTimeout(resolve, timeToWait * 1000));
      }
      
      console.log(`✅ Governance update execution time reached, proceeding with execution`);
      
      // Use only the first admin to execute the governance update proposal
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/execute-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${governanceUpdateTimelockProposalId} --execution-type governance-update`;
        
        console.log(`📝 Running execute governance update proposal command: ${command}`);
        console.log(`📝 Using first admin private key for governance update proposal execution`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Execute governance update proposal result:`, result);
      });
      
      console.log(`✅ Governance update proposal execution completed with first admin`);
    });

    it('should verify governance configuration after update', async function () {
      console.log(`🧪 Verifying governance configuration after timelock only update`);
      
      try {
        const command = `npx ts-node scripts/governor/test-governor-setup/index.ts --network ${NETWORK_NAME}`;
        
        console.log(`📝 Running governance verification command: ${command}`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log('Governance verification output:', result);
        console.log(`✅ Governance configuration verification passed after timelock only update`);
      } catch (error) {
        console.error('Governance verification failed:', error.message);
        throw error;
      }
    });
  });

  function getAdminPrivateKey(index: number): string {
    const adminPks = ADMIN_PKS;
    if (!adminPks) {
      throw new Error('TEST_ADMIN_PKS environment variable is not set');
    }
    
    const adminPkArray = adminPks.split(',');
    if (index < 0 || index >= adminPkArray.length) {
      throw new Error(`Admin private key index ${index} is out of range. Available admins: 0-${adminPkArray.length - 1}`);
    }
    
    const adminPk = adminPkArray[index].trim();
    if (!adminPk) {
      throw new Error(`Admin private key at index ${index} is empty or invalid`);
    }
    
    console.log(`📝 Using admin private key at index ${index} from TEST_ADMIN_PKS`);
    return adminPk;
  }
  
  async function copyDirectory(src: string, dest: string, exclude: string[] = []): Promise<void> {
    console.log(`📁 Copying directory from ${src} to ${dest}`);
    try {
      const items = await fs.promises.readdir(src, { withFileTypes: true });
      
      for (const item of items) {
        if (exclude.includes(item.name)) {
          console.log(`⏭️  Skipping excluded item: ${item.name}`);
          continue;
        }

        const srcPath = path.join(src, item.name);
        const destPath = path.join(dest, item.name);

        if (item.isDirectory()) {
          console.log(`📂 Creating directory: ${item.name}`);
          await fs.promises.mkdir(destPath, { recursive: true });
          await copyDirectory(srcPath, destPath, exclude);
        } else {
          console.log(`📄 Copying file: ${item.name}`);
          await fs.promises.copyFile(srcPath, destPath);
        }
      }
      console.log(`✅ Directory copy completed: ${src} -> ${dest}`);
    } catch (error) {
      console.error('❌ Error copying directory:', error);
      throw error;
    }
  }

  async function deleteDirectory(): Promise<void> {
    console.log('🧹 Cleaning up folder...');
    const e2eNetworkPath = path.join(__dirname, '../../deployments', NETWORK_NAME);
    
    try {
      if (fs.existsSync(e2eNetworkPath)) {
        await fs.promises.rm(e2eNetworkPath, { recursive: true, force: true });
        console.log(`✅ Deleted entire ${NETWORK_NAME} folder: ${e2eNetworkPath}`);
      } else {
        console.log(`ℹ️  ${NETWORK_NAME} folder does not exist, nothing to clean up`);
      }
    } catch (error) {
      console.warn(`Warning: Could not delete ${NETWORK_NAME} folder:`, error);
    }
  }

  async function deleteHardhatConfigFile(): Promise<void> {
    console.log('🧹 Cleaning up test hardhat config file...');
    try {
      if (fs.existsSync(TEST_HARDHAT_CONFIG_PATH)) {
        await fs.promises.unlink(TEST_HARDHAT_CONFIG_PATH);
        console.log(`✅ Deleted test hardhat config: ${TEST_HARDHAT_CONFIG_PATH}`);
      } else {
        console.log(`ℹ️  Test hardhat config file does not exist, nothing to clean up`);
      }
    } catch (error) {
      console.warn(`Warning: Could not delete test hardhat config:`, error);
    }
  }

  function setupMockFunctions(
    object: { setMockFunctions: (confirmFn: (prompt: string) => Promise<boolean>, questionFn: (prompt: string) => Promise<string>) => void },
    mockConfirmAnswers: boolean[],
    mockQuestionAnswers: string[]
  ): void {
    object.setMockFunctions(
      // Mock confirm function - consume from array
      async (prompt: string) => {
        console.log(`Mock confirm: ${prompt}`);
        
        if (mockConfirmAnswers.length === 0) {
          console.log(`⚠️  No more confirm answers in mock array, defaulting to true`);
          return true;
        }
        
        const answer = mockConfirmAnswers.shift()!;
        console.log(`📝 Answering confirm with: ${answer}`);
        return answer;
      },
      // Mock question function - consume from array
      async (prompt: string) => {
        console.log(`Mock question: ${prompt}`);
        
        if (mockQuestionAnswers.length === 0) {
          console.log(`⚠️  No more question answers in mock array, defaulting to empty string`);
          return '';
        }
        
        const answer = mockQuestionAnswers.shift()!;
        console.log(`📝 Answering question with: ${answer}`);
        return answer;
      }
    );
  }

  async function loadInitialConfigurationForMultisigGovernance() {
    const timelockDelay = Number(await getTimelockDelay(NETWORK_NAME));
    EXECUTE_TIMEOUT = (2 * 60 * 1000) + timelockDelay * 60 * 1000; // 2 minutes + TIMELOCK_DELAY minutes
    MULTISIG_THRESHOLD = Number(await getMultisigThreshold(NETWORK_NAME));
  }
  
  async function reloadHardhatConfigToIncorporateSigner(signer: string) {
    const dynamicHardhatConfig = new DynamicHardhatConfig(NETWORK_NAME, { ...E2E_NETWORK_CONFIG, accounts:[signer] }, TEST_HARDHAT_CONFIG_PATH, TEST_DEPLOYMENT_PATH);
    await dynamicHardhatConfig.generateTestHardhatConfig();
  }
  
  async function runWithSigner<T>(
    signer: string, 
    operation: () => Promise<T>
  ): Promise<T> {
    const originalTestPk = DEFAULT_PK;
    try {
      // Set the new signer
      await reloadHardhatConfigToIncorporateSigner(signer);
      console.log(`📝 Running operation with signer: ${signer}`);
      // Execute the operation
      return await operation();
    } catch (error) {
      console.error(`❌ Operation failed with signer ${signer}:`, error);
      throw error;
    } finally {
      await reloadHardhatConfigToIncorporateSigner(originalTestPk);
      console.log(`📝 Reverted back to original signer`);
    }
  }

  async function setupTestAccounts(testContext: any): Promise<void> {
    // Fund accounts for local networks
    if(E2E_NETWORK_CONFIG.chainId == "31337") {
      await fundPrivateKeysInAnvil(ADMIN_PKS, E2E_NETWORK_CONFIG.url);
    } else if(E2E_NETWORK_CONFIG.chainId == "1337") {
      await fundPrivateKeysInHardhat(ADMIN_PKS, E2E_NETWORK_CONFIG.url);
    }
    
    // Check if all accounts have sufficient balance
    const allPrivateKeys = [DEFAULT_PK, ...ADMIN_PKS.split(',').map(pk => pk.trim())].filter(pk => pk);
    const hasBalance = await checkAccountBalances(allPrivateKeys, E2E_NETWORK_CONFIG.url);
    if (!hasBalance) {
      console.log('⚠️  Skipping tests: TEST_PK or TEST_ADMIN_PKS accounts have insufficient balance');
      testContext.skip();
    }
  }

});
