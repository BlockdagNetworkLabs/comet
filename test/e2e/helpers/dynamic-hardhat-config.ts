import { hre } from "../../helpers";
import * as fs from 'fs';
import * as path from 'path';

export class DynamicHardhatConfig {
  private networkName: string;
  private e2eNetworkConfig: any;
  private testHardhatConfigPath: string;
  private testDeploymentPath: string;

  constructor(
    networkName: string,
    e2eNetworkConfig: any,
    testHardhatConfigPath: string,
    testDeploymentPath: string
  ) {
    this.networkName = networkName;
    this.e2eNetworkConfig = {
        ...e2eNetworkConfig,
        gas: 'auto',
        gasPrice: 'auto',
    };
    this.testHardhatConfigPath = testHardhatConfigPath;
    this.testDeploymentPath = testDeploymentPath;
  }

  private async discoverMarkets(): Promise<string[]> {
    const discoveredMarkets: string[] = [];

    try {
      const items = await fs.promises.readdir(this.testDeploymentPath, { withFileTypes: true });
      
      for (const item of items) {
        // Skip _infrastructure, template folders, and non-directories
        if (item.name === '_infrastructure' || item.name.startsWith('_template-') || !item.isDirectory()) {
          continue;
        }

        const deploymentName = item.name;
        const deployPath = path.join(this.testDeploymentPath, deploymentName, 'deploy.ts');
        
        // Check if the folder has a deploy.ts file (indicating it's a market)
        if (fs.existsSync(deployPath)) {
          discoveredMarkets.push(deploymentName);
          console.log(`✅ Discovered market: ${deploymentName}`);
        } else {
          console.log(`⚠️  Skipping ${deploymentName} - no deploy.ts found`);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not discover markets:`, error);
    }

    console.log(`📋 Discovered markets: ${discoveredMarkets.join(', ')}`);

    return discoveredMarkets;
  }

  private async updateHardhatEnvironment(discoveredMarkets: string[]): Promise<void> {
    const { imports, configEntries } = await this.getRelationConfigs(discoveredMarkets);
    
    // Now create the test hardhat config file with the imports and config
    await this.createTestHardhatConfig(imports, configEntries);
  }

  private async getRelationConfigs(discoveredMarkets: string[]): Promise<{imports: string[], configEntries: string[]}> {
    const imports: string[] = [];
    const configEntries: string[] = [];

    // Load infrastructure relation config first
    const infrastructureRelationPath = path.join(this.testDeploymentPath, '_infrastructure', 'relations.ts');
    if (fs.existsSync(infrastructureRelationPath)) {
      // Fix: Calculate relative path from the test/e2e/ directory, not from helpers/
      const relativePath = path.relative(path.join(__dirname, '..'), infrastructureRelationPath).replace(/\\/g, '/');
      const importName = `infrastructureRelationConfig`;
      imports.push(`import ${importName} from '${relativePath}';`.replace(".ts", ""));
      
      configEntries.push(`_infrastructure: ${importName}`);
      console.log(`✅ Loaded infrastructure relation config`);
    } else {
      throw new Error(`No relations.ts found for infrastructure`);
    }

    // Load relation configs for each discovered market
    for (const market of discoveredMarkets) {
      const relationPath = path.join(this.testDeploymentPath, market, 'relations.ts');
      
      if (fs.existsSync(relationPath)) {
        // Fix: Calculate relative path from the test/e2e/ directory, not from helpers/
        const relativePath = path.relative(path.join(__dirname, '..'), relationPath).replace(/\\/g, '/');
        const importName = `${market}RelationConfig`;
        imports.push(`import ${importName} from '${relativePath}';`.replace(".ts", ""));
        
        configEntries.push(`${market}: ${importName}`);
        console.log(`✅ Loaded ${market} relation config`);
      } else {
        throw new Error(`No relations.ts found for ${market}`);
      }
    }
    return { imports, configEntries };
  }

  private async createTestHardhatConfig(imports: string[], configEntries: string[]): Promise<void> {
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
    }, 2).replaceAll("NETWORK_NAME_PLACEHOLDER", this.networkName)
    .replace("\"NETWORK_PLACEHOLDER\"", () => JSON.stringify(this.e2eNetworkConfig))
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
    await fs.promises.writeFile(this.testHardhatConfigPath, testConfig, 'utf8');
    console.log(`✅ Created test hardhat config: ${this.testHardhatConfigPath}`);
  }

  async generateTestHardhatConfig(): Promise<void> {
    const discoveredMarkets = await this.discoverMarkets();
    await this.updateHardhatEnvironment(discoveredMarkets);
  }

}
