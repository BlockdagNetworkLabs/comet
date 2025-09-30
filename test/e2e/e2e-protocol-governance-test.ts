import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import hre from 'hardhat';
import { DeploymentManager } from '../../plugins/deployment_manager';
import { Deployed } from '../../plugins/deployment_manager';
import relationConfigMap from '../../deployments/relations';
import { execSync } from 'child_process';

// Configuration
const TEMP_HARDHAT_CONFIG_FILE_NAME = 'temp-hardhat.config.ts';
//IMPORTANT! If NETWORK_NAME is changed, 
//you need to change the network name in the templates/[markets]/deploy.ts file 
//where the infraestructure is loaded
const NETWORK_NAME = 'e2e-network';
const TEMPLATES = ['_template-1'];
let E2E_NETWORK_CONFIG = {
  chainId: 31337, 
  url: 'http://127.0.0.1:8545', 
} as any;

//Dont touch this configuration onyl for devs
const {
  REMOTE_ACCOUNTS,
  ETH_PK,
  MNEMONIC,
} = process.env;
function* deriveAccounts(pk: string, n: number = 10) {
  for (let i = 0; i < n; i++)
    yield (BigInt('0x' + pk) + BigInt(i)).toString(16);
}
E2E_NETWORK_CONFIG = {
  ...E2E_NETWORK_CONFIG,
  accounts: REMOTE_ACCOUNTS ? 'remote' : (ETH_PK ? [...deriveAccounts(ETH_PK)] : { mnemonic: MNEMONIC }),
  gas: 'auto',
  gasPrice: 'auto',
}; 

const testHardhatConfigPath = path.join(__dirname, TEMP_HARDHAT_CONFIG_FILE_NAME);

describe('E2E Protocol Governance Test Suite', function () {
  // Global variables
  let discoveredMarkets: string[] = [];
  let deploymentManager: DeploymentManager;
  let deployedContracts: Deployed;

  // Run tests for each template
  TEMPLATES.forEach(templateName => {
    describe(`Template: ${templateName}`, function () {

      before(async function () {
        // Set up local paths
        const templatePath = path.join(__dirname, templateName);
        const e2ePath = path.join(__dirname, '../../deployments', NETWORK_NAME);

        // Set test environment variables
        
        process.env.TEST = 'true';
        process.env.TEST_HARDHAT_CONFIG = testHardhatConfigPath;

        // Copy template files to e2e root
        await copyDirectory(templatePath, e2ePath, [templateName]);

        // First discover markets
        await discoverMarkets(templateName, e2ePath);
        console.log(`📋 Discovered markets: ${discoveredMarkets.join(', ')}`);

        // Update hardhat environment with network registration and relation configs
        await updateHardhatEnvironment(templateName, e2ePath);

        // Initialize deployment manager
        deploymentManager = new DeploymentManager(NETWORK_NAME, NETWORK_NAME, hre, {
          writeCacheToDisk: false,
          importRetries: 0,
        });

        // Start the appropriate network based on chain ID
        //await tryStartNetwork();
      });

      after(async function () {
        // console.log("🛑 Killing network...");
        // await tryKillNetwork();
        // console.log("✅ Network killed successfully");

        console.log('🧹 Cleaning up folder...');
        await cleanupEntireNetworkFolder();
        console.log('✅ folder cleanup completed');

        // Clean up test environment variables
        delete process.env.TEST;
        delete process.env.TEST_HARDHAT_CONFIG;

        // Clean up test hardhat config file
        await cleanupTestHardhatConfig();
      });

      it('should have copied template files', async function () {
        // Set up local paths for verification
        const e2ePath = path.join(__dirname, '../../deployments', NETWORK_NAME);
        
        // Verify that the template files were copied
        const infrastructurePath = path.join(e2ePath, '_infrastructure');
        expect(fs.existsSync(infrastructurePath)).to.be.true;

        // Verify specific files exist
        expect(fs.existsSync(path.join(infrastructurePath, 'deploy.ts'))).to.be.true;
        expect(fs.existsSync(path.join(infrastructurePath, 'relations.ts'))).to.be.true;

        // Verify each discovered market has its files
        for (const market of discoveredMarkets) {
          const marketPath = path.join(e2ePath, market);
          expect(fs.existsSync(marketPath)).to.be.true;
          expect(fs.existsSync(path.join(marketPath, 'deploy.ts'))).to.be.true;
          console.log(`✅ ${market} files verification passed`);
        }

        console.log(`✅ ${templateName} files verification passed`);
      });

      it('should deploy protocol successfully', async function () {
        console.log(`🚀 Testing protocol deployment for ${templateName}...`);
        
        try {
          // Run deployment command - all internal hardhat commands will now use the test config
          const command = `yes | npx ts-node scripts/deployer/deploy-markets/index.ts --network ${NETWORK_NAME} --deployments all --clean`;
          
          console.log(`📝 Running deployment command: ${command}`);
          console.log(`📝 Test mode enabled with hardhat config: ${process.env.TEST_HARDHAT_CONFIG}`);
          
          const result = execSync(command, { 
            encoding: 'utf8',
            stdio: 'inherit',
            cwd: process.cwd(),
          });
          console.log('Deployment output:', result);
          console.log(`✅ Protocol deployment test passed for ${templateName}`);
        } catch (error) {
          console.error('Deployment failed:', error.message);
          throw error;
        }
      });
    });
  });

  async function tryStartNetwork(): Promise<void> {
    if (E2E_NETWORK_CONFIG.chainId === 31337) {
      console.log('🚀 Starting Anvil network...');
      spawn('anvil', ['--port', '8545', '--chain-id', '31337'], {
        stdio: 'pipe',
        detached: true
      });
    } else if (E2E_NETWORK_CONFIG.chainId === 1337) {
      console.log('🚀 Starting Hardhat network...');
      spawn('npx', ['hardhat', 'node', '--port', '8545'], {
        stdio: 'pipe',
        detached: true
      });
    } else {
      console.log(`ℹ️  Unsupported chain ID: ${E2E_NETWORK_CONFIG.chainId}, skipping network startup`);
      return;
    }

    // Wait a bit for the network to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('✅ Network should be ready');
  }

  async function copyDirectory(src: string, dest: string, exclude: string[] = []): Promise<void> {
    try {
      const items = await fs.promises.readdir(src, { withFileTypes: true });
      
      for (const item of items) {
        if (exclude.includes(item.name)) {
          continue;
        }

        const srcPath = path.join(src, item.name);
        const destPath = path.join(dest, item.name);

        if (item.isDirectory()) {
          await fs.promises.mkdir(destPath, { recursive: true });
          await copyDirectory(srcPath, destPath, exclude);
        } else {
          await fs.promises.copyFile(srcPath, destPath);
        }
      }
    } catch (error) {
      console.error('Error copying directory:', error);
      throw error;
    }
  }

  async function discoverMarkets(templateName: string, e2ePath: string): Promise<void> {
    discoveredMarkets = []; // Reset the global array

    try {
      const items = await fs.promises.readdir(e2ePath, { withFileTypes: true });
      
      for (const item of items) {
        // Skip _infrastructure, template folders, and non-directories
        if (item.name === '_infrastructure' || item.name.startsWith('_template-') || !item.isDirectory()) {
          continue;
        }

        const deploymentName = item.name;
        const deployPath = path.join(e2ePath, deploymentName, 'deploy.ts');
        
        // Check if the folder has a deploy.ts file (indicating it's a market)
        if (fs.existsSync(deployPath)) {
          discoveredMarkets.push(deploymentName);
          console.log(`✅ Discovered market: ${deploymentName}`);
        } else {
          console.log(`⚠️  Skipping ${deploymentName} - no deploy.ts found`);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not discover markets for ${templateName}:`, error);
    }
  }

  async function updateHardhatEnvironment(templateName: string, e2ePath: string): Promise<void> {

    const { imports, configEntries } = await getRelationConfigs(templateName, e2ePath);
    
    // Now create the test hardhat config file with the imports and config
    await createTestHardhatConfig(imports, configEntries);
  }

  async function getRelationConfigs(templateName: string, e2ePath: string): Promise<{imports: string[], configEntries: string[]}> {
    const imports: string[] = [];
    const configEntries: string[] = [];

    // Load infrastructure relation config first
    const infrastructureRelationPath = path.join(e2ePath, '_infrastructure', 'relations.ts');
    if (fs.existsSync(infrastructureRelationPath)) {
      const relativePath = path.relative(__dirname, infrastructureRelationPath).replace(/\\/g, '/');
      const importName = `infrastructureRelationConfig`;
      imports.push(`import ${importName} from '${relativePath}';`.replace(".ts", ""));
      
      configEntries.push(`_infrastructure: ${importName}`);
      console.log(`✅ Loaded infrastructure relation config for ${templateName}`);
    } else {
      throw new Error(`No relations.ts found for ${templateName}`);
    }

    // Load relation configs for each discovered market
    for (const market of discoveredMarkets) {
      const relationPath = path.join(e2ePath, market, 'relations.ts');
      
      if (fs.existsSync(relationPath)) {
        const relativePath = path.relative(__dirname, relationPath).replace(/\\/g, '/');
        const importName = `${market}RelationConfig`;
        imports.push(`import ${importName} from '${relativePath}';`.replace(".ts", ""));
        
        configEntries.push(`${market}: ${importName}`);
        console.log(`✅ Loaded ${market} relation config for ${templateName}`);
      } else {
        throw new Error(`No relations.ts found for ${market} in ${templateName}`);
      }
    }

    return { imports, configEntries };
  }

  async function createTestHardhatConfig(imports: string[], configEntries: string[]): Promise<void> {
  
    const cleanConfig = {
      ...hre.config,
      networks: {
        'NETWORK_NAME_PLACEHOLDER':'NETWORK_PLACEHOLDER'
      },
      deploymentManager: {
        relationConfigMap: hre.config.deploymentManager.relationConfigMap,
        networks: {
          'NETWORK_NAME_PLACEHOLDER':'DEPLOYMENT_MANAGER_CONFIG_PLACEHOLDER'
        }
      },
    };

    const cleanConfigString = JSON.stringify(cleanConfig, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }, 2).replaceAll("NETWORK_NAME_PLACEHOLDER", NETWORK_NAME)
    .replace("\"NETWORK_PLACEHOLDER\"", () => JSON.stringify(E2E_NETWORK_CONFIG))
    .replace("\"DEPLOYMENT_MANAGER_CONFIG_PLACEHOLDER\"",`{${configEntries.join(',')}}`);
  

    const testConfig = `
import 'dotenv/config';

import { HardhatUserConfig, task } from 'hardhat/config';
import '@compound-finance/hardhat-import';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@typechain/hardhat';
import 'hardhat-chai-matchers';
import 'hardhat-change-network';
import 'hardhat-contract-sizer';
import 'hardhat-cover';
import 'hardhat-gas-reporter';

// Hardhat tasks - adjust paths to be relative to test/e2e/
import '../../tasks/deployment_manager/task.ts';
import '../../tasks/spider/task.ts';
import '../../tasks/scenario/task.ts';
import '../../tasks/governor/task.ts';

// Dynamic relation configs
${imports.join('\n')}

const testConfig: HardhatUserConfig = ${cleanConfigString};

export default testConfig;
`;
    // Write the test config file
    await fs.promises.writeFile(testHardhatConfigPath, testConfig, 'utf8');
    console.log(`✅ Created test hardhat config: ${testHardhatConfigPath}`);
  }

  async function tryKillNetwork(): Promise<void> {
    try {
      console.log('🛑 Killing network processes on port 8545...');
      
      // Find and kill processes using port 8545
      const result = execSync('lsof -ti:8545', { encoding: 'utf8', stdio: 'pipe' });
      const pids = result.trim().split('\n').filter(pid => pid);
      
      for (const pid of pids) {
        try {
          execSync(`kill -TERM ${pid}`, { stdio: 'pipe' });
          console.log(`✅ Killed process ${pid}`);
        } catch (error) {
          // Process might already be dead
        }
      }
      
      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Force kill any remaining processes
      execSync('pkill -f "anvil.*8545"', { stdio: 'pipe' });
      execSync('pkill -f "hardhat.*node.*8545"', { stdio: 'pipe' });
      
      console.log('✅ Network cleanup completed');
    } catch (error) {
      console.log('ℹ️  No network processes found on port 8545');
    }
  }

  async function cleanupEntireNetworkFolder(): Promise<void> {
    // const e2eNetworkPath = path.join(__dirname, '../../deployments', NETWORK_NAME);
    
    // try {
    //   if (fs.existsSync(e2eNetworkPath)) {
    //     await fs.promises.rm(e2eNetworkPath, { recursive: true, force: true });
    //     console.log(`✅ Deleted entire ${NETWORK_NAME} folder: ${e2eNetworkPath}`);
    //   } else {
    //     console.log(`ℹ️  ${NETWORK_NAME} folder does not exist, nothing to clean up`);
    //   }
    // } catch (error) {
    //   console.warn(`Warning: Could not delete ${NETWORK_NAME} folder:`, error);
    // }
  }

  async function cleanupTestHardhatConfig(): Promise<void> {
    // try {
    //   if (fs.existsSync(testHardhatConfigPath)) {
    //     await fs.promises.unlink(testHardhatConfigPath);
    //     console.log(`✅ Deleted test hardhat config: ${testHardhatConfigPath}`);
    //   }
    // } catch (error) {
    //   console.warn(`Warning: Could not delete test hardhat config:`, error);
    // }
  }

  async function buildDeploymentManagerConfig(templateName: string, e2ePath: string): Promise<any> {
    const config: any = {};

    // Load infrastructure relation config
    try {
      const infrastructureRelationPath = path.join(e2ePath, '_infrastructure', 'relations.ts');
      if (fs.existsSync(infrastructureRelationPath)) {
        delete require.cache[require.resolve(infrastructureRelationPath)];
        const infrastructureRelationConfig = require(infrastructureRelationPath).default;
        config._infrastructure = infrastructureRelationConfig;
        console.log(`✅ Loaded infrastructure relation config for ${templateName}`);
      }
    } catch (error) {
      console.warn(`Warning: Could not load infrastructure relation config for ${templateName}:`, error);
      config._infrastructure = relationConfigMap;
    }

    // Load relation configs for each discovered market
    for (const market of discoveredMarkets) {
      const relationPath = path.join(e2ePath, market, 'relations.ts');
      
      if (fs.existsSync(relationPath)) {
        try {
          delete require.cache[require.resolve(relationPath)];
          const deploymentRelationConfig = require(relationPath).default;
          config[market] = deploymentRelationConfig;
          console.log(`✅ Loaded ${market} relation config for ${templateName}`);
        } catch (error) {
          console.warn(`Warning: Could not load ${market} relation config for ${templateName}:`, error);
          config[market] = relationConfigMap;
        }
      } else {
        console.log(`ℹ️  No relations.ts found for ${market} in ${templateName}, using base relation config`);
        config[market] = relationConfigMap;
      }
    }

    return config;
  }
});

