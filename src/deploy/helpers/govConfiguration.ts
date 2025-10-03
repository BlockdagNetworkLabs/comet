import * as fs from 'fs';
import * as path from 'path';

export interface GovConfiguration {
  governorSigners: string[];
  multisigThreshold: number;
  timelockDelay: number;
  gracePeriod: number;
  minimumDelay: number;
  maximumDelay: number;
}

/**
 * Fetches governance configuration from the _infrastructure folder for a given deployment network
 * @param deploymentNetwork - The deployment network (e.g., 'local', 'mainnet', 'polygon')
 * @returns Promise<GovConfiguration> - The governance configuration object
 * @throws Error if the configuration file doesn't exist or is invalid
 */
export async function getGovConfiguration(deploymentNetwork: string): Promise<GovConfiguration> {
    const infrastructurePath = path.join(
      process.cwd(),
      'deployments',
      deploymentNetwork,
      '_infrastructure',
      'configuration.json'
    );
  
    try {
      // Check if the configuration file exists
      if (!fs.existsSync(infrastructurePath)) {
        throw new Error(`Governance configuration file not found at: ${infrastructurePath}`);
      }
  
      // Read and parse the configuration file
      const configContent = await fs.promises.readFile(infrastructurePath, 'utf8');
      const config = JSON.parse(configContent) as GovConfiguration;
  
      // Validate required fields
      const requiredFields: (keyof GovConfiguration)[] = [
        'governorSigners',
        'multisigThreshold',
        'timelockDelay',
        'gracePeriod',
        'minimumDelay',
        'maximumDelay'
      ];
  
      for (const field of requiredFields) {
        if (config[field] === undefined || config[field] === null) {
          throw new Error(`Missing required field '${field}' in governance configuration`);
        }
      }
  
      // Validate governorSigners format (array of addresses)
      if (Array.isArray(config.governorSigners)) {
        const addressRegex = /^0x[a-fA-F0-9]{40}$/;
        
        for (const address of config.governorSigners) {
          if (typeof address !== 'string' || !addressRegex.test(address)) {
            throw new Error(`Invalid address format in governorSigners: ${address}`);
          }
        }
      } else {
        throw new Error('governorSigners must be an array');
      }
  
      // Validate numeric fields
      const numericFields: (keyof GovConfiguration)[] = [
        'multisigThreshold',
        'timelockDelay',
        'gracePeriod',
        'minimumDelay',
        'maximumDelay'
      ];
  
      for (const field of numericFields) {
        if (typeof config[field] !== 'number' || config[field] < 0) {
          throw new Error(`Field '${field}' must be a positive number`);
        }
      }
  
      // Validate multisigThreshold is not greater than number of signers
      if (config.multisigThreshold > config.governorSigners.length) {
        throw new Error(`multisigThreshold (${config.multisigThreshold}) cannot be greater than number of signers (${config.governorSigners.length})`);
      }
  
      // Validate timelock delay constraints
      if (config.timelockDelay < config.minimumDelay) {
        throw new Error(`timelockDelay (${config.timelockDelay}) cannot be less than minimumDelay (${config.minimumDelay})`);
      }
  
      if (config.timelockDelay > config.maximumDelay) {
        throw new Error(`timelockDelay (${config.timelockDelay}) cannot be greater than maximumDelay (${config.maximumDelay})`);
      }
  
      if (config.minimumDelay > config.maximumDelay) {
        throw new Error(`minimumDelay (${config.minimumDelay}) cannot be greater than maximumDelay (${config.maximumDelay})`);
      }
  
      // Validate grace period is reasonable (should be positive and not too large)
      if (config.gracePeriod <= 0) {
        throw new Error(`gracePeriod (${config.gracePeriod}) must be greater than 0`);
      }
  
      // Validate grace period is not excessive (e.g., not more than 1 year)
      const MAX_GRACE_PERIOD = 365 * 24 * 60 * 60; // 1 year in seconds
      if (config.gracePeriod > MAX_GRACE_PERIOD) {
        throw new Error(`gracePeriod (${config.gracePeriod}) is too large (max: ${MAX_GRACE_PERIOD} seconds)`);
      }
  
      return config;
  
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON format in governance configuration file: ${error.message}`);
      }
      throw error;
    }
}

/**
 * Gets the governance signers as an array of addresses
 * @param deploymentNetwork - The deployment network
 * @returns Promise<string[]> - Array of governance signer addresses
 */
export async function getGovSigners(deploymentNetwork: string): Promise<string[]> {
  const config = await getGovConfiguration(deploymentNetwork);
  return config.governorSigners; // Already an array
}

/**
 * Gets the multisig threshold for the deployment network
 * @param deploymentNetwork - The deployment network
 * @returns Promise<number> - The multisig threshold
 */
export async function getMultisigThreshold(deploymentNetwork: string): Promise<number> {
  const config = await getGovConfiguration(deploymentNetwork);
  return config.multisigThreshold;
}

/**
 * Gets the timelock delay for the deployment network
 * @param deploymentNetwork - The deployment network
 * @returns Promise<number> - The timelock delay in seconds
 */
export async function getTimelockDelay(deploymentNetwork: string): Promise<number> {
  const config = await getGovConfiguration(deploymentNetwork);
  return config.timelockDelay;
}

/**
 * Gets the grace period for the deployment network
 * @param deploymentNetwork - The deployment network
 * @returns Promise<number> - The grace period in seconds
 */
export async function getGracePeriod(deploymentNetwork: string): Promise<number> {
    const config = await getGovConfiguration(deploymentNetwork);
    return config.gracePeriod;
}
  
/**
 * Gets the minimum delay for the deployment network
 * @param deploymentNetwork - The deployment network
 * @returns Promise<number> - The minimum delay in seconds
 */
export async function getMinimumDelay(deploymentNetwork: string): Promise<number> {
const config = await getGovConfiguration(deploymentNetwork);
return config.minimumDelay;
}
  
/**
 * Gets the maximum delay for the deployment network
 * @param deploymentNetwork - The deployment network
 * @returns Promise<number> - The maximum delay in seconds
 */
export async function getMaximumDelay(deploymentNetwork: string): Promise<number> {
const config = await getGovConfiguration(deploymentNetwork);
return config.maximumDelay;
}