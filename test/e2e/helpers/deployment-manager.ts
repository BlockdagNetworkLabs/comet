import * as fs from 'fs';
import * as path from 'path';

export interface ProtocolDiscoveryOptions {
  excludeInfrastructure?: boolean;
  excludeTemplates?: boolean;
  validateDeployFile?: boolean;
  sort?: boolean;
}

/**
 * Discovers protocol deployments in a given path
 * @param discoveryPath - Path to search for deployments
 * @param options - Configuration options for discovery
 * @returns Array of deployment names
 */
export async function discoverDeployments(
  discoveryPath: string, 
  options: ProtocolDiscoveryOptions = {}
): Promise<string[]> {
  const {
    excludeInfrastructure = true,
    excludeTemplates = true,
    validateDeployFile = true,
    sort = true
  } = options;

  console.log(`🔍 Discovering protocol deployments in: ${discoveryPath}`);
  
  try {
    const items = await fs.promises.readdir(discoveryPath, { withFileTypes: true });
    const deployments: string[] = [];
    
    for (const item of items) {
      // Skip non-directories
      if (!item.isDirectory()) {
        continue;
      }

      const deploymentName = item.name;
      
      // Skip infrastructure if requested
      if (excludeInfrastructure && deploymentName === '_infrastructure') {
        console.log(`⏭️  Skipping infrastructure: ${deploymentName}`);
        continue;
      }
      
      // Skip templates if requested
      if (excludeTemplates && deploymentName.startsWith('_template')) {
        console.log(`⏭️  Skipping template: ${deploymentName}`);
        continue;
      }
      
      // Skip other special directories starting with _
      if (excludeTemplates && deploymentName.startsWith('_')) {
        console.log(`⏭️  Skipping special directory: ${deploymentName}`);
        continue;
      }

      // Validate deploy.ts file if requested
      if (validateDeployFile) {
        const deployPath = path.join(discoveryPath, deploymentName, 'deploy.ts');
        if (!fs.existsSync(deployPath)) {
          console.log(`⚠️  Skipping ${deploymentName} - no deploy.ts found`);
          continue;
        }
      }

      deployments.push(deploymentName);
      console.log(`✅ Discovered protocol deployment: ${deploymentName}`);
    }

    if (sort) {
      deployments.sort();
    }

    console.log(`📋 Found ${deployments.length} protocol deployments: ${deployments.join(', ')}`);
    return deployments;
    
  } catch (error) {
    console.error('❌ Error discovering protocol deployments:', error);
    throw error;
  }
}

/**
 * Discovers markets from copied deployment directory (for runtime)
 * @param deploymentPath - Path to deployment directory
 * @returns Array of market names
 */
export async function discoverMarkets(deploymentPath: string): Promise<string[]> {
  return discoverDeployments(deploymentPath, {
    excludeInfrastructure: true,
    excludeTemplates: true,
    validateDeployFile: true, // Markets must have deploy.ts
    sort: true
  });
}

/**
 * Discovers all assets in a specific market deployment by reading its configuration file
 * @param networkPath - Path to the network deployment directory
 * @param marketName - Name of the market to analyze
 * @returns Promise<string[]> - Array of asset names found in the configuration
 */
export async function discoverAssetsInMarket(
  networkPath: string,
  marketName: string
): Promise<string[]> {
  const marketPath = path.join(networkPath, marketName);
  const configPath = path.join(marketPath, 'configuration.json');
  
  console.log(`🔍 Discovering assets in market: ${marketName}`);
  console.log(`📁 Market path: ${marketPath}`);
  console.log(`📋 Configuration file: ${configPath}`);
  
  try {
    // Check if market directory exists
    if (!fs.existsSync(marketPath)) {
      throw new Error(`Market directory does not exist: ${marketPath}`);
    }
    
    // Check if configuration file exists
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file does not exist: ${configPath}`);
    }
    
    // Read configuration
    const configContent = await fs.promises.readFile(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    // Extract asset names from the assets object
    const assets = config.assets || {};
    const assetNames = Object.keys(assets);
    
    console.log(`📋 Found ${assetNames.length} assets: ${assetNames.join(', ')}`);
    return assetNames;
    
  } catch (error) {
    console.error(`❌ Error discovering assets in market ${marketName}:`, error);
    throw error;
  }
}

/**
 * Gets a specific configuration value from a nested path
 * @param networkPath - Path to the network deployment directory
 * @param marketName - Name of the market to read from
 * @param configPath - Nested path to the configuration value (e.g., "assets.wbtc.borrowCF")
 * @returns Promise<any> - The configuration value at the specified path
 */
export async function getConfigurationValue(
  networkPath: string,
  marketName: string,
  configPath: string
): Promise<any> {
  const marketPath = path.join(networkPath, marketName);
  const configFilePath = path.join(marketPath, 'configuration.json');
  
  console.log(`📖 Reading configuration value: ${configPath} from market: ${marketName}`);
  
  try {
    // Check if market directory exists
    if (!fs.existsSync(marketPath)) {
      throw new Error(`Market directory does not exist: ${marketPath}`);
    }
    
    // Check if configuration file exists
    if (!fs.existsSync(configFilePath)) {
      throw new Error(`Configuration file does not exist: ${configFilePath}`);
    }
    
    // Read configuration
    const configContent = await fs.promises.readFile(configFilePath, 'utf8');
    const config = JSON.parse(configContent);
    
    // Helper function to get nested property
    const getNestedProperty = (obj: any, path: string): any => {
      const normalizedPath = path.replace(/\//g, '.');
      const keys = normalizedPath.split('.');
      
      let current = obj;
      for (const key of keys) {
        if (!(key in current)) {
          return undefined;
        }
        current = current[key];
      }
      return current;
    };
    
    const value = getNestedProperty(config, configPath);
    
    if (value !== undefined) {
      console.log(`✅ Found configuration value at ${configPath}: ${JSON.stringify(value)}`);
    } else {
      console.log(`⚠️  Configuration value not found at path: ${configPath}`);
    }
    
    return value;
    
  } catch (error) {
    console.error(`❌ Error reading configuration value ${configPath} from market ${marketName}:`, error);
    throw error;
  }
}

/**
 * Gets configuration values for all assets in a market at a specific path
 * @param networkPath - Path to the network deployment directory
 * @param marketName - Name of the market to read from
 * @param configPath - Configuration path to search across assets (e.g., "borrowCF", "collateralFactor")
 * @returns Promise<Record<string, any>> - Mapping of asset keys to their configuration values
 */
export async function getAllAssetsConfiguration(
  networkPath: string,
  marketName: string,
  configPath: string
): Promise<Record<string, any>> {
  console.log(`🔍 Getting configuration for all assets in market: ${marketName}`);
  
  // Discover all assets in the market
  const assetKeys = await discoverAssetsInMarket(networkPath, marketName);
  
  if (assetKeys.length === 0) {
    console.log(`⚠️  No assets found in market ${marketName}`);
    return {};
  }
  
  // Use the existing function to get configuration for all discovered assets
  return await getAssetsConfiguration(networkPath, marketName, assetKeys, configPath);
}

/**
 * Gets configuration values for multiple assets at a specific path
 * @param networkPath - Path to the network deployment directory
 * @param marketName - Name of the market to read from
 * @param assetKeys - Array of asset keys to search for (e.g., ["wbtc", "weth", "usdc"])
 * @param configPath - Configuration path to search across assets (e.g., "borrowCF", "collateralFactor")
 * @returns Promise<Record<string, any>> - Mapping of asset keys to their configuration values
 */
export async function getAssetsConfiguration(
  networkPath: string,
  marketName: string,
  assetKeys: string[],
  configPath: string
): Promise<Record<string, any>> {
  const marketPath = path.join(networkPath, marketName);
  const configFilePath = path.join(marketPath, 'configuration.json');
  
  console.log(`📖 Reading assets configuration for market: ${marketName}`);
  console.log(`📋 Asset keys: ${assetKeys.join(', ')}`);
  console.log(`🔍 Configuration path: ${configPath}`);
  
  try {
    // Check if market directory exists
    if (!fs.existsSync(marketPath)) {
      throw new Error(`Market directory does not exist: ${marketPath}`);
    }
    
    // Check if configuration file exists
    if (!fs.existsSync(configFilePath)) {
      throw new Error(`Configuration file does not exist: ${configFilePath}`);
    }
    
    // Read configuration
    const configContent = await fs.promises.readFile(configFilePath, 'utf8');
    const config = JSON.parse(configContent);
    
    // Helper function to get nested property
    const getNestedProperty = (obj: any, path: string): any => {
      const normalizedPath = path.replace(/\//g, '.');
      const keys = normalizedPath.split('.');
      
      let current = obj;
      for (const key of keys) {
        if (!(key in current)) {
          return undefined;
        }
        current = current[key];
      }
      return current;
    };
    
    const assetsConfig: Record<string, any> = {};
    
    // Build the full path for each asset and get the value
    for (const assetKey of assetKeys) {
      const fullPath = `assets.${assetKey}.${configPath}`;
      const value = getNestedProperty(config, fullPath);
      
      if (value !== undefined) {
        assetsConfig[assetKey] = value;
        console.log(`✅ ${assetKey}.${configPath}: ${JSON.stringify(value)}`);
      } else {
        console.log(`⚠️  ${assetKey}.${configPath}: not found`);
        assetsConfig[assetKey] = undefined;
      }
    }
    
    const foundCount = Object.values(assetsConfig).filter(v => v !== undefined).length;
    console.log(`📊 Found ${foundCount}/${assetKeys.length} asset configurations for path: ${configPath}`);
    
    return assetsConfig;
    
  } catch (error) {
    console.error(`❌ Error reading assets configuration for market ${marketName}:`, error);
    throw error;
  }
}

/**
 * Modifies configuration parameters for testing a specific market
 * Supports nested paths using dot notation (e.g., "assets.wbtc.borrowCF") or slash notation (e.g., "assets/wbtc/borrowCF")
 * @param networkPath - Path to the network deployment directory
 * @param marketName - Name of the market to modify
 * @param parameterModifications - Object containing parameter modifications with nested path support
 * @returns Promise<void>
 */
export async function modifyMarketParameters(
  networkPath: string,
  marketName: string,
  parameterModifications: Record<string, any>
): Promise<void> {
  const marketPath = path.join(networkPath, marketName);
  const configPath = path.join(marketPath, 'configuration.json');
  
  console.log(`🔧 Modifying parameters for market: ${marketName}`);
  console.log(`📁 Market path: ${marketPath}`);
  console.log(`📋 Configuration file: ${configPath}`);
  
  try {
    // Check if market directory exists
    if (!fs.existsSync(marketPath)) {
      throw new Error(`Market directory does not exist: ${marketPath}`);
    }
    
    // Check if configuration file exists
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file does not exist: ${configPath}`);
    }
    
    // Read current configuration
    const configContent = await fs.promises.readFile(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    console.log(`📖 Current configuration loaded`);
    console.log(`🔧 Applying modifications:`, parameterModifications);
    
    // Helper function to set nested property
    const setNestedProperty = (obj: any, path: string, value: any): boolean => {
      // Convert slash notation to dot notation
      const normalizedPath = path.replace(/\//g, '.');
      const keys = normalizedPath.split('.');
      
      let current = obj;
      
      // Navigate to the parent of the target property
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current)) {
          console.log(`⚠️  Creating missing parent object: ${keys.slice(0, i + 1).join('.')}`);
          current[key] = {};
        }
        current = current[key];
      }
      
      // Set the final property
      const finalKey = keys[keys.length - 1];
      const oldValue = current[finalKey];
      current[finalKey] = value;
      
      console.log(`✅ Modified ${path}: ${JSON.stringify(oldValue)} → ${JSON.stringify(value)}`);
      return true;
    };
    
    // Helper function to get nested property
    const getNestedProperty = (obj: any, path: string): any => {
      const normalizedPath = path.replace(/\//g, '.');
      const keys = normalizedPath.split('.');
      
      let current = obj;
      for (const key of keys) {
        if (!(key in current)) {
          return undefined;
        }
        current = current[key];
      }
      return current;
    };
    
    // Apply modifications
    let modified = false;
    for (const [key, value] of Object.entries(parameterModifications)) {
      // Check if this is a nested path (contains dots or slashes)
      if (key.includes('.') || key.includes('/')) {
        const oldValue = getNestedProperty(config, key);
        if (oldValue !== undefined) {
          setNestedProperty(config, key, value);
          modified = true;
        } else {
          console.log(`⚠️  Nested parameter ${key} not found in configuration, creating it`);
          setNestedProperty(config, key, value);
          modified = true;
        }
      } else {
        // Handle top-level properties (backward compatibility)
        if (config[key] !== undefined) {
          const oldValue = config[key];
          config[key] = value;
          console.log(`✅ Modified ${key}: ${JSON.stringify(oldValue)} → ${JSON.stringify(value)}`);
          modified = true;
        } else {
          console.log(`⚠️  Parameter ${key} not found in configuration, adding it`);
          config[key] = value;
          modified = true;
        }
      }
    }
    
    if (modified) {
      // Write modified configuration back to file
      const modifiedConfigContent = JSON.stringify(config, null, 2);
      await fs.promises.writeFile(configPath, modifiedConfigContent, 'utf8');
      console.log(`💾 Configuration file updated successfully`);
    } else {
      console.log(`ℹ️  No modifications were applied`);
    }
    
  } catch (error) {
    console.error(`❌ Error modifying market parameters for ${marketName}:`, error);
    throw error;
  }
}