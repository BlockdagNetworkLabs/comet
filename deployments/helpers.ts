import { DeploymentManager } from "../plugins/deployment_manager";
import { FaucetToken } from "../build/types";
import {
  getPriceFeeds,
  getTokenAddresses,
} from "../src/deploy/NetworkConfiguration";

/**
 * Generic helper function to get an existing token contract
 * Works with any network and token type
 */
export async function getExistingToken(
  deploymentManager: DeploymentManager,
  symbol: string,
  address: string,
  contractPath: string = "contracts/test/FaucetToken.sol:StandardToken"
): Promise<FaucetToken> {
  const tracer = deploymentManager.tracer();
  const existing = await deploymentManager.existing(
    symbol,
    address,
    deploymentManager.network,
    contractPath
  );
  tracer(`Loaded existing token ${symbol} from ${address}`);
  return existing as FaucetToken;
}

/**
 * Helper function to get multiple existing tokens
 * Automatically loads token addresses from configuration.json via NetworkConfiguration
 */
export async function getExistingTokens(
  deploymentManager: DeploymentManager,
  contractPath: string = "contracts/test/FaucetToken.sol:StandardToken"
): Promise<Record<string, FaucetToken>> {
  const tokenAddresses = await getTokenAddresses(deploymentManager);
  const tokens: Record<string, FaucetToken> = {};

  for (const [symbol, address] of Object.entries(tokenAddresses)) {
    tokens[symbol] = await getExistingToken(
      deploymentManager,
      symbol,
      address,
      contractPath
    );
  }

  return tokens;
}

/**
 * Helper function to setup price feeds from configuration
 * Automatically adds price feed contracts to the deployment manager
 */
export async function setupPriceFeeds(
  deploymentManager: DeploymentManager
): Promise<void> {
  // Get price feed addresses from configuration and add them to the deployment
  const priceFeedsConfig = await getPriceFeeds(deploymentManager);

  // Add price feeds to the deployment manager's contract map
  for (const [tokenName, priceFeedAddress] of Object.entries(
    priceFeedsConfig
  )) {
    const alias = `${tokenName.toLowerCase()}:priceFeed`;
    await deploymentManager.existing(
      alias,
      priceFeedAddress as string,
      deploymentManager.network,
      "contracts/vendor/@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol:AggregatorV3Interface"
    );
  }
}

/**
 * Helper function to get an existing contract by address
 * Generic version that works with any contract type
 */
export async function getExistingContract(
  deploymentManager: DeploymentManager,
  alias: string,
  address: string,
  contractPath: string
): Promise<any> {
  return await deploymentManager.existing(
    alias,
    address,
    deploymentManager.network,
    contractPath
  );
}
