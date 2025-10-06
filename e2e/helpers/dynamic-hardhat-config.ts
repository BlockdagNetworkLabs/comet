import { discoverMarkets } from './deployment-manager';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'hardhat';

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
      // Fix: Calculate relative path from the e2e directory, not from helpers/
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
        // Fix: Calculate relative path from the e2e directory, not from helpers/
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
      ...config,
      networks: {
        'NETWORK_NAME_PLACEHOLDER':'NETWORK_PLACEHOLDER'
      },
      deploymentManager: {
        relationConfigMap: config!.deploymentManager!.relationConfigMap!,
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

    // Calculate relative paths for task imports
    const taskImports = [
      'deployment_manager/task.ts',
      'spider/task.ts', 
      'scenario/task.ts',
      'governor/task.ts'
    ].map(taskPath => {
      const fullTaskPath = path.join(__dirname, '../../tasks', taskPath);
      const relativePath = path.relative(path.dirname(this.testHardhatConfigPath), fullTaskPath).replace(/\\/g, '/');
      return `import '${relativePath}';`;
    }).join('\n');

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

// Hardhat tasks - dynamically calculated paths
${taskImports}

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
    const discoveredMarkets = await discoverMarkets(this.testDeploymentPath);
    await this.updateHardhatEnvironment(discoveredMarkets);
  }

}
