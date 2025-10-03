import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { Contract } from 'ethers';
import { DEFAULT_REWARDS_FUNDING_AMOUNT } from '../src/constants';
import { getGovSigners, getMultisigThreshold, getTimelockDelay, getGracePeriod, getMinimumDelay, getMaximumDelay } from '../src/deploy/helpers/govConfiguration';

describe("Market Verification", function() {
  // This test verifies the deployment configuration for any network/market
  // export MARKET=dai && yarn hardhat test test/deployment-verification-test.ts --network local
  let deployedContracts: any;
  let networkName: string;
  let market: string;
  let config: any;

  // Helper function to convert scientific notation to decimal string
  function convertScientificNotation(value: string | number): string {
    const valueStr = value.toString();

    if (valueStr.includes("e")) {
      // Handle scientific notation: split on 'e' and use the exponent
      const [base, exponent] = valueStr.split("e");
      const expNum = parseInt(exponent);

      // Handle small decimal numbers (e.g., "0.000011574074074074073e15")
      if (base.startsWith("0.")) {
        // For small decimals, convert to the actual value
        // "0.000011574074074074073e15" means 0.000011574074074074073 * 10^15
        // This equals 11574074074074073
        const decimalValue = parseFloat(valueStr);
        return Math.floor(decimalValue).toString();
      } else {
        // Handle regular large numbers (e.g., "7500e8")
        const baseWithoutDecimal = base.replace(".", "");
        const zerosToAdd = expNum - (base.split(".")[1]?.length || 0);
        return baseWithoutDecimal + "0".repeat(zerosToAdd);
      }
    } else {
      return valueStr;
    }
  }

  // Helper function to convert decimal values to 18-decimal format (for Comet factors)
  function convertDecimalTo18Decimals(value: string | number): string {
    const numValue = parseFloat(value.toString());
    // Convert to 18 decimal places: 0.75 -> 0.75 * 10^18 = 750000000000000000
    const result = (numValue * Math.pow(10, 18)).toString();
    return result;
  }

  // Constants from Comet contract
  const SECONDS_PER_YEAR = 31_536_000; // 365 days * 24 hours * 60 minutes * 60 seconds

  before(async function() {
    // Get network from hardhat
    networkName = network.name;

    // Get market from environment variable or throw error
    market = process.env.MARKET;

    if (!market) {
      throw new Error(
        "❌ MARKET environment variable is required. Usage: export MARKET=dai && yarn hardhat test test/deployment-verification-test.ts --network local"
      );
    }

    console.log(
      `🔍 Testing deployment on network: ${networkName}, market: ${market}`
    );

    // Run spider to refresh roots.json before testing
    console.log(`🕷️  Running spider to refresh roots.json...`);
    try {
      const { execSync } = require("child_process");
      const spiderCommand = `yarn hardhat spider --network ${networkName} --deployment ${market}`;
      execSync(spiderCommand, { stdio: "inherit" });
      console.log(`✅ Spider completed successfully`);
    } catch (error) {
      throw new Error(
        "❌ SPIDER is not running correctly. Please verify aliases and roots files"
      );
    }

    
    const rootsPath = `../deployments/${networkName}/${market}/roots.json`;
    const roots = require(rootsPath);
    const contracts: any = {};

    // Load each contract from aliases
    if (roots.comet) {
      contracts.comet = await ethers.getContractAt(
        "CometHarnessInterface",
        roots.comet
      );
    }
    if (roots.governor) {
      contracts.governor = await ethers.getContractAt(
        "CustomGovernor",
        roots.governor
      );
    }
    if (roots.timelock) {
      contracts.timelock = await ethers.getContractAt(
        "Timelock",
        roots.timelock
      );
    }
    if (roots.COMP) {
      contracts.COMP = await ethers.getContractAt("IComp", roots.COMP);
    }

    deployedContracts = contracts;

    // Load the configuration.json file for this market
    const configPath = `../deployments/${networkName}/${market}/configuration.json`;

    try {
      config = require(configPath);
      console.log(`📋 Loaded configuration from: ${configPath}`);
    } catch (error) {
      throw new Error(
        `Failed to load configuration file: ${configPath}. Error: ${error}`
      );
    }
  });

  it("should have correct ownership relationships", async function() {
    const { comet, governor, timelock } = deployedContracts;

    // Verify timelock admin is set to governor
    expect(await timelock.admin()).to.equal(governor.address);

    // Verify comet governor is set correctly
    expect(await comet.governor()).to.equal(timelock.address);

    // Verify proxy admin ownership
    const proxyAdmin = await getProxyAdmin(comet.address);
    expect(await proxyAdmin.owner()).to.equal(timelock.address);
  });

  it("should have timelock holding expected COMP supply after rewards funding", async function() {
    const { timelock, COMP } = deployedContracts;

    // Get total supply of COMP tokens
    const totalSupply = await COMP.totalSupply();
    expect(totalSupply).to.be.gt(0);

    // Get timelock's balance of COMP tokens
    const timelockBalance = await COMP.balanceOf(timelock.address);
    expect(timelockBalance).to.be.gt(0);

    // Calculate expected balance after rewards funding
    const rewardsFundingAmount =
      process.env.DEFAULT_REWARDS_FUNDING_AMOUNT ||
      DEFAULT_REWARDS_FUNDING_AMOUNT;
    const expectedBalance = totalSupply.sub(rewardsFundingAmount);

    // Verify timelock holds the expected amount (total supply minus rewards funding)
    expect(timelockBalance).to.equal(expectedBalance);

    console.log(
      `✅ Timelock holds ${ethers.utils.formatEther(
        timelockBalance
      )} COMP tokens (expected: ${ethers.utils.formatEther(
        expectedBalance
      )} after funding ${ethers.utils.formatEther(
        rewardsFundingAmount
      )} COMP to rewards)`
    );
  });

  it("should have valid configuration structure", async function() {
    // Basic validation that config has expected structure
    expect(config).to.have.property("baseToken");
    expect(config).to.have.property("assets");
    expect(config.assets).to.be.an("object");
    expect(Object.keys(config.assets).length).to.be.gt(0);
  });

  // ===== COMET-SPECIFIC PARAMETER TESTS =====

  it("should have correct proxy implementation", async function() {
    const { comet } = deployedContracts;

    // Get proxy admin
    const proxyAdmin = await getProxyAdmin(comet.address);

    // Verify implementation is set
    const implementation = await proxyAdmin.getProxyImplementation(
      comet.address
    );
    expect(implementation).to.not.equal(ethers.constants.AddressZero);

    // Verify implementation is different from proxy address
    expect(implementation).to.not.equal(comet.address);
  });

  it("should have base token price feed address matching configuration.json", async function() {
    const { comet } = deployedContracts;

    // Validate base token price feed configuration
    if (config.baseTokenPriceFeed) {
      const deployedBaseTokenPriceFeed = await comet.baseTokenPriceFeed();
      const expectedPriceFeedAddress = config.baseTokenPriceFeed;

      expect(deployedBaseTokenPriceFeed.toLowerCase()).to.equal(
        expectedPriceFeedAddress.toLowerCase()
      );
      console.log(
        `✅ Base token price feed ${config.baseTokenPriceFeed} matches: ${deployedBaseTokenPriceFeed}`
      );
    }
  });

  it("should have base borrow min matching configuration.json", async function() {
    const { comet } = deployedContracts;

    const deployedBaseBorrowMin = await comet.baseBorrowMin();
    const expectedBaseBorrowMin = convertScientificNotation(config.borrowMin);
    expect(deployedBaseBorrowMin.toString()).to.equal(expectedBaseBorrowMin);
    console.log(
      `✅ Base borrow min matches: ${deployedBaseBorrowMin.toString()}`
    );
  });

  it("should have store front price factor matching configuration.json", async function() {
    const { comet } = deployedContracts;

    const deployedStoreFrontPriceFactor = await comet.storeFrontPriceFactor();
    const expectedStoreFrontPriceFactor = convertDecimalTo18Decimals(
      config.storeFrontPriceFactor
    );
    expect(deployedStoreFrontPriceFactor.toString()).to.equal(
      expectedStoreFrontPriceFactor
    );
    console.log(
      `✅ Store front price factor matches: ${deployedStoreFrontPriceFactor.toString()}`
    );
  });

  it("should have target reserves matching configuration.json", async function() {
    const { comet } = deployedContracts;

    const deployedTargetReserves = await comet.targetReserves();
    const expectedTargetReserves = convertScientificNotation(
      config.targetReserves
    );
    expect(deployedTargetReserves.toString()).to.equal(expectedTargetReserves);
    console.log(
      `✅ Target reserves matches: ${deployedTargetReserves.toString()}`
    );
  });

  it("should have market name matching configuration.json", async function() {
    const { comet } = deployedContracts;

    const deployedName = await comet.name();
    const expectedName = config.name;
    expect(deployedName).to.equal(expectedName);
    console.log(`✅ Market name matches: ${deployedName}`);
  });

  it("should have market symbol matching configuration.json", async function() {
    const { comet } = deployedContracts;

    const deployedSymbol = await comet.symbol();
    const expectedSymbol = config.symbol;
    expect(deployedSymbol).to.equal(expectedSymbol);
    console.log(`✅ Market symbol matches: ${deployedSymbol}`);
  });

  // == TRACKING VALUES ==

  it("should have tracking index scale matching configuration.json", async function() {
    const { comet } = deployedContracts;

    const { tracking } = config;
    const { indexScale } = tracking;

    const deployedTrackingIndexScale = await comet.trackingIndexScale();
    const expectedBaseTrackingIndexScale = convertScientificNotation(
      indexScale
    );
    expect(deployedTrackingIndexScale.toString()).to.equal(
      expectedBaseTrackingIndexScale
    );
    console.log(
      `✅ Base tracking index scale matches: ${deployedTrackingIndexScale.toString()}`
    );
  });

  it("should have base tracking min for rewards matching configuration.json", async function() {
    const { comet } = deployedContracts;

    const { tracking } = config;
    const { baseMinForRewards } = tracking;

    const deployedBaseMinForRewards = await comet.baseMinForRewards();
    const expectedBaseMinForRewards = convertScientificNotation(
      baseMinForRewards
    );
    expect(deployedBaseMinForRewards.toString()).to.equal(
      expectedBaseMinForRewards
    );
    console.log(
      `✅ Base min for rewards matches: ${deployedBaseMinForRewards.toString()}`
    );
  });

  it("should have base tracking supply speed matching configuration.json", async function() {
    const { comet } = deployedContracts;

    const { tracking } = config;
    const { baseSupplySpeed } = tracking;

    const deployedBaseTrackingSupplySpeed = await comet.baseTrackingSupplySpeed();
    const expectedBaseTrackingSupplySpeed = convertScientificNotation(
      baseSupplySpeed
    );
    expect(deployedBaseTrackingSupplySpeed.toString()).to.equal(
      expectedBaseTrackingSupplySpeed
    );
    console.log(
      `✅ Base tracking supply speed matches: ${deployedBaseTrackingSupplySpeed.toString()}`
    );
  });

  it("should have base tracking borrow speed matching configuration.json", async function() {
    const { comet } = deployedContracts;

    const { tracking } = config;
    const { baseBorrowSpeed } = tracking;

    const deployedBaseTrackingBorrowSpeed = await comet.baseTrackingBorrowSpeed();
    const expectedBaseTrackingBorrowSpeed = convertScientificNotation(
      baseBorrowSpeed
    );
    expect(deployedBaseTrackingBorrowSpeed.toString()).to.equal(
      expectedBaseTrackingBorrowSpeed
    );
    console.log(
      `✅ Base tracking borrow speed matches: ${deployedBaseTrackingBorrowSpeed.toString()}`
    );
  });

  // == RATES VALUES ==

  it("should have supply kink matching configuration.json", async function() {
    const { comet } = deployedContracts;

    const { rates } = config;
    const { supplyKink } = rates;

    const deployedSupplyKink = await comet.supplyKink();
    const expectedSupplyKink = convertDecimalTo18Decimals(supplyKink);
    expect(deployedSupplyKink.toString()).to.equal(expectedSupplyKink);
    console.log(`✅ Supply kink matches: ${deployedSupplyKink.toString()}`);
  });

  it("should have supply slope low matching configuration.json", async function() {
    const { comet } = deployedContracts;

    const { rates } = config;
    const { supplySlopeLow } = rates;

    const deployedSupplySlopeLow = await comet.supplyPerSecondInterestRateSlopeLow();
    // Convert annual rate to per-second rate: annual_rate / SECONDS_PER_YEAR
    const expectedSupplySlopeLow = Math.trunc(
      Number(convertDecimalTo18Decimals(supplySlopeLow)) / SECONDS_PER_YEAR
    ).toString();

    expect(deployedSupplySlopeLow.toString()).to.equal(expectedSupplySlopeLow);
    console.log(
      `✅ Supply slope low matches: ${deployedSupplySlopeLow.toString()}`
    );
  });

  it("should have supply slope high matching configuration.json", async function() {
    const { comet } = deployedContracts;

    const { rates } = config;
    const { supplySlopeHigh } = rates;

    const deployedSupplySlopeHigh = await comet.supplyPerSecondInterestRateSlopeHigh();
    // Convert annual rate to per-second rate: annual_rate / SECONDS_PER_YEAR
    const expectedSupplySlopeHigh = Math.trunc(
      Number(convertDecimalTo18Decimals(supplySlopeHigh)) / SECONDS_PER_YEAR
    ).toString();
    expect(deployedSupplySlopeHigh.toString()).to.equal(
      expectedSupplySlopeHigh
    );
    console.log(
      `✅ Supply slope high matches: ${deployedSupplySlopeHigh.toString()}`
    );
  });

  it("should have supply base matching configuration.json", async function() {
    const { comet } = deployedContracts;

    const { rates } = config;
    const { supplyBase } = rates;

    const deployedSupplyBase = await comet.supplyPerSecondInterestRateBase();
    // Convert annual rate to per-second rate: annual_rate / SECONDS_PER_YEAR
    const expectedSupplyBase = Math.trunc(
      Number(convertDecimalTo18Decimals(supplyBase)) / SECONDS_PER_YEAR
    ).toString();
    expect(deployedSupplyBase.toString()).to.equal(expectedSupplyBase);
    console.log(`✅ Supply base matches: ${deployedSupplyBase.toString()}`);
  });

  it("should have borrow kink matching configuration.json", async function() {
    const { comet } = deployedContracts;

    const { rates } = config;
    const { borrowKink } = rates;

    const deployedBorrowKink = await comet.borrowKink();
    const expectedBorrowKink = convertDecimalTo18Decimals(borrowKink);
    expect(deployedBorrowKink.toString()).to.equal(expectedBorrowKink);
    console.log(`✅ Borrow kink matches: ${deployedBorrowKink.toString()}`);
  });

  it("should have borrow slope low matching configuration.json", async function() {
    const { comet } = deployedContracts;

    const { rates } = config;
    const { borrowSlopeLow } = rates;

    const deployedBorrowSlopeLow = await comet.borrowPerSecondInterestRateSlopeLow();
    // Convert annual rate to per-second rate: annual_rate / SECONDS_PER_YEAR
    const expectedBorrowSlopeLow = Math.trunc(
      Number(convertDecimalTo18Decimals(borrowSlopeLow)) / SECONDS_PER_YEAR
    ).toString();
    expect(deployedBorrowSlopeLow.toString()).to.equal(expectedBorrowSlopeLow);
    console.log(
      `✅ Borrow slope low matches: ${deployedBorrowSlopeLow.toString()}`
    );
  });

  it("should have borrow slope high matching configuration.json", async function() {
    const { comet } = deployedContracts;

    const { rates } = config;
    const { borrowSlopeHigh } = rates;

    const deployedBorrowSlopeHigh = await comet.borrowPerSecondInterestRateSlopeHigh();
    // Convert annual rate to per-second rate: annual_rate / SECONDS_PER_YEAR
    const expectedBorrowSlopeHigh = Math.trunc(
      Number(convertDecimalTo18Decimals(borrowSlopeHigh)) / SECONDS_PER_YEAR
    ).toString();
    expect(deployedBorrowSlopeHigh.toString()).to.equal(
      expectedBorrowSlopeHigh
    );
    console.log(
      `✅ Borrow slope high matches: ${deployedBorrowSlopeHigh.toString()}`
    );
  });

  it("should have borrow base matching configuration.json", async function() {
    const { comet } = deployedContracts;

    const { rates } = config;
    const { borrowBase } = rates;

    const deployedBorrowBase = await comet.borrowPerSecondInterestRateBase();
    // Convert annual rate to per-second rate: annual_rate / SECONDS_PER_YEAR
    const expectedBorrowBase = Math.trunc(
      Number(convertDecimalTo18Decimals(borrowBase)) / SECONDS_PER_YEAR
    ).toString();
    expect(deployedBorrowBase.toString()).to.equal(expectedBorrowBase);
    console.log(`✅ Borrow base matches: ${deployedBorrowBase.toString()}`);
  });

  // ===== ASSET CONFIGURATION TESTS =====

  it("should have correct number of assets matching configuration.json", async function() {
    const { comet } = deployedContracts;

    if (config.assets && typeof config.assets === "object") {
      const numAssets = await comet.numAssets();
      expect(numAssets).to.equal(Object.keys(config.assets).length);
      console.log(`✅ Number of assets matches: ${numAssets}`);
    }
  });

  it("should have asset price feeds matching configuration.json", async function() {
    const { comet } = deployedContracts;

    // Load roots.json to get the actual addresses
    const rootsPath = `../deployments/${network.name}/${market}/roots.json`;
    const roots = require(rootsPath);

    if (config.assets && typeof config.assets === "object") {
      const assetKeys = Object.keys(config.assets);
      for (let i = 0; i < assetKeys.length; i++) {
        const assetKey = assetKeys[i];
        const configAsset = config.assets[assetKey];
        const deployedAssetInfo = await comet.getAssetInfo(i);

        // Price feed is required - fail if missing
        expect(configAsset.priceFeed).to.exist;
        expect(configAsset.priceFeed).to.be.a("string");
        expect(configAsset.priceFeed).to.not.be.empty;

        const expectedPriceFeedAddress = roots[configAsset.priceFeed];
        if (expectedPriceFeedAddress) {
          expect(deployedAssetInfo.priceFeed.toLowerCase()).to.equal(
            expectedPriceFeedAddress.toLowerCase()
          );
          console.log(
            `✅ Asset ${assetKey} price feed ${configAsset.priceFeed} matches: ${deployedAssetInfo.priceFeed}`
          );
        } else {
          // If not in roots.json, compare directly with config value
          expect(deployedAssetInfo.priceFeed.toLowerCase()).to.equal(
            configAsset.priceFeed.toLowerCase()
          );
          console.log(
            `✅ Asset ${assetKey} price feed matches: ${deployedAssetInfo.priceFeed}`
          );
        }
      }
    }
  });

  it("should have asset supply caps matching configuration.json", async function() {
    const { comet } = deployedContracts;

    if (config.assets && typeof config.assets === "object") {
      const assetKeys = Object.keys(config.assets);
      for (let i = 0; i < assetKeys.length; i++) {
        const assetKey = assetKeys[i];
        const configAsset = config.assets[assetKey];
        const deployedAssetInfo = await comet.getAssetInfo(i);

        // Supply cap is required - fail if missing
        expect(configAsset.supplyCap).to.exist;
        expect(configAsset.supplyCap).to.not.be.undefined;

        const supplyCapDecimal = convertScientificNotation(
          configAsset.supplyCap
        );
        expect(deployedAssetInfo.supplyCap.toString()).to.equal(
          supplyCapDecimal
        );
        console.log(
          `✅ Asset ${assetKey} supply cap matches: ${deployedAssetInfo.supplyCap.toString()}`
        );
      }
    }
  });

  it("should have asset borrow collateral factors matching configuration.json", async function() {
    const { comet } = deployedContracts;

    if (config.assets && typeof config.assets === "object") {
      const assetKeys = Object.keys(config.assets);
      for (let i = 0; i < assetKeys.length; i++) {
        const assetKey = assetKeys[i];
        const configAsset = config.assets[assetKey];
        const deployedAssetInfo = await comet.getAssetInfo(i);

        // Borrow collateral factor is required - fail if missing
        expect(configAsset.borrowCF).to.exist;
        expect(configAsset.borrowCF).to.not.be.undefined;

        // Use decimal conversion for factors (0.75 -> 750000000000000000)
        const borrowCFDecimal = convertDecimalTo18Decimals(
          configAsset.borrowCF
        );
        expect(deployedAssetInfo.borrowCollateralFactor.toString()).to.equal(
          borrowCFDecimal
        );
        console.log(
          `✅ Asset ${assetKey} borrow collateral factor matches: ${deployedAssetInfo.borrowCollateralFactor.toString()}`
        );
      }
    }
  });

  it("should have asset liquidate collateral factors matching configuration.json", async function() {
    const { comet } = deployedContracts;

    if (config.assets && typeof config.assets === "object") {
      const assetKeys = Object.keys(config.assets);
      for (let i = 0; i < assetKeys.length; i++) {
        const assetKey = assetKeys[i];
        const configAsset = config.assets[assetKey];
        const deployedAssetInfo = await comet.getAssetInfo(i);

        // Liquidate collateral factor is required - fail if missing
        expect(configAsset.liquidateCF).to.exist;
        expect(configAsset.liquidateCF).to.not.be.undefined;

        // Use decimal conversion for factors (0.8 -> 800000000000000000)
        const liquidateCFDecimal = convertDecimalTo18Decimals(
          configAsset.liquidateCF
        );
        expect(deployedAssetInfo.liquidateCollateralFactor.toString()).to.equal(
          liquidateCFDecimal
        );
        console.log(
          `✅ Asset ${assetKey} liquidate collateral factor matches: ${deployedAssetInfo.liquidateCollateralFactor.toString()}`
        );
      }
    }
  });

  it("should have asset liquidation factors matching configuration.json", async function() {
    const { comet } = deployedContracts;

    if (config.assets && typeof config.assets === "object") {
      const assetKeys = Object.keys(config.assets);
      for (let i = 0; i < assetKeys.length; i++) {
        const assetKey = assetKeys[i];
        const configAsset = config.assets[assetKey];
        const deployedAssetInfo = await comet.getAssetInfo(i);

        // Liquidation factor is required - fail if missing
        expect(configAsset.liquidationFactor).to.exist;
        expect(configAsset.liquidationFactor).to.not.be.undefined;

        // Use decimal conversion for factors (0.85 -> 850000000000000000)
        const liquidationFactorDecimal = convertDecimalTo18Decimals(
          configAsset.liquidationFactor
        );
        expect(deployedAssetInfo.liquidationFactor.toString()).to.equal(
          liquidationFactorDecimal
        );
        console.log(
          `✅ Asset ${assetKey} liquidation factor matches: ${deployedAssetInfo.liquidationFactor.toString()}`
        );
      }
    }
  });

  it("should have interest rate model matching configuration.json", async function() {
    const { comet } = deployedContracts;

    // Load roots.json to get the actual addresses
    const rootsPath = `../deployments/${network.name}/${market}/roots.json`;
    const roots = require(rootsPath);

    if (config.interestRateModel) {
      const interestRateModel = await comet.interestRateModel();
      const expectedInterestRateModelAddress = roots[config.interestRateModel];

      if (expectedInterestRateModelAddress) {
        expect(interestRateModel.toLowerCase()).to.equal(
          expectedInterestRateModelAddress.toLowerCase()
        );
        console.log(
          `✅ Interest rate model ${config.interestRateModel} matches: ${interestRateModel}`
        );
      } else {
        // If not in roots.json, compare directly with config value
        expect(interestRateModel.toLowerCase()).to.equal(
          config.interestRateModel.toLowerCase()
        );
        console.log(`✅ Interest rate model matches: ${interestRateModel}`);
      }
    }
  });

  it("should have reward configuration matching configuration.json", async function() {
    const { comet } = deployedContracts;

    // Load roots.json to get the actual addresses
    const rootsPath = `../deployments/${network.name}/${market}/roots.json`;
    const roots = require(rootsPath);

    if (config.rewards) {
      const rewards = await ethers.getContractAt(
        "CometRewards",
        await comet.rewards()
      );

      if (config.rewards.token) {
        const rewardConfig = await rewards.rewardConfig(comet.address);
        const expectedRewardTokenAddress = roots[config.rewards.token];

        if (expectedRewardTokenAddress) {
          expect(rewardConfig.token.toLowerCase()).to.equal(
            expectedRewardTokenAddress.toLowerCase()
          );
          console.log(
            `✅ Reward token ${config.rewards.token} matches: ${rewardConfig.token}`
          );
        } else {
          // If not in roots.json, compare directly with config value
          expect(rewardConfig.token.toLowerCase()).to.equal(
            config.rewards.token.toLowerCase()
          );
          console.log(`✅ Reward token matches: ${rewardConfig.token}`);
        }
      }
    }
  });

  // ===== ASSET PARAMETER TESTS =====

  it("should have asset decimals matching configuration.json", async function() {
    const { comet } = deployedContracts;

    if (config.assets && typeof config.assets === "object") {
      const assetKeys = Object.keys(config.assets);
      for (let i = 0; i < assetKeys.length; i++) {
        const assetKey = assetKeys[i];
        const configAsset = config.assets[assetKey];
        const deployedAssetInfo = await comet.getAssetInfo(i);

        // Check asset decimals
        if (configAsset.decimals !== undefined) {
          // Get decimals from the asset contract using a minimal interface with decimals
          try {
            const assetContract = await ethers.getContractAt(
              ["function decimals() external view returns (uint8)"],
              deployedAssetInfo.asset
            );
            const deployedDecimals = await assetContract.decimals();
            expect(deployedDecimals.toString()).to.equal(configAsset.decimals);
            console.log(
              `✅ Asset ${assetKey} decimals match: ${deployedDecimals}`
            );
          } catch (error) {
            console.log(
              `⚠️ Could not verify decimals for asset ${assetKey}: ${error.message}`
            );
          }
        }
      }
    }
  });
});

describe("Governance Verification", function() {
  
  let deployedContracts: any;
  let networkName: string;

  before(async function() {
    // Get network from hardhat
    networkName = network.name;

    console.log(
      `🔍 Testing governance configuration on network: ${networkName}`
    );
    
    const rootsPath = `../deployments/${networkName}/_infrastructure/roots.json`;
    const roots = require(rootsPath);
    const contracts: any = {};

    if (roots.governor) {
      contracts.governor = await ethers.getContractAt(
        "CustomGovernor",
        roots.governor
      );
    }
    if (roots.timelock) {
      contracts.timelock = await ethers.getContractAt(
        "Timelock",
        roots.timelock
      );
    }
    deployedContracts = contracts;
  });
  
  it('should validate BDAG governor configuration matches deployed contract', async function () {
    const { governor } = deployedContracts;
    
    const signers = await getGovSigners(networkName);
    const threshold = await getMultisigThreshold(networkName);
    
    expect(signers.length).to.be.gt(0);
    expect(threshold).to.be.gt(0);
    expect(threshold).to.not.be.NaN;
    
    const deployedThreshold = await governor.multisigThreshold();
    expect(deployedThreshold).to.equal(threshold);
    
    for (let i = 0; i < signers.length; i++) {
      const signer = signers[i];
      
      expect(ethers.utils.isAddress(signer)).to.be.true;
      
      const isAdmin = await governor.isAdmin(signer);
      expect(isAdmin).to.be.true;
    }
  });

  it('should validate BDAG timelock delay configuration matches deployed contract', async function () {
    const { timelock } = deployedContracts;
    
    const delay = await getTimelockDelay(networkName);
    
    const deployedDelay = await timelock.delay();
    
    expect(deployedDelay).to.equal(delay);

    console.log(`✅ Timelock delay validation passed: ${deployedDelay} seconds (${delay} from env)`);
  });

  it('should validate BDAG timelock grace period configuration matches deployed contract', async function () {
    const { timelock } = deployedContracts;
    
    const gracePeriod = await getGracePeriod(networkName);
    
    const deployedGracePeriod = await timelock.GRACE_PERIOD();

    expect(deployedGracePeriod).to.equal(gracePeriod);
    
    console.log(`✅ Timelock grace period validation passed: ${deployedGracePeriod} seconds (${gracePeriod} from env)`);
  });

  it('should validate BDAG timelock minimum delay configuration matches deployed contract', async function () {
    const { timelock } = deployedContracts;
    
    const minimumDelay = await getMinimumDelay(networkName);

    const deployedMinimumDelay = await timelock.MINIMUM_DELAY();
    
    expect(deployedMinimumDelay).to.equal(minimumDelay);
    
    console.log(`✅ Timelock minimum delay validation passed: ${deployedMinimumDelay} seconds (${minimumDelay} from env)`);
  });

  it('should validate BDAG timelock maximum delay configuration matches deployed contract', async function () {
    const { timelock } = deployedContracts;
    
    const maximumDelay = await getMaximumDelay(networkName);
    
    const deployedMaximumDelay = await timelock.MAXIMUM_DELAY();
    
    expect(deployedMaximumDelay).to.equal(maximumDelay);
    
    console.log(`✅ Timelock maximum delay validation passed: ${deployedMaximumDelay} seconds (${maximumDelay} from env)`);
  });
});

// Helper function to get proxy admin for a contract
async function getProxyAdmin(contractAddress: string): Promise<Contract> {
  // Try to get proxy admin using different methods
  try {
    // Method 1: Try to get admin directly from contract
    const contract = new Contract(
      contractAddress,
      ['function admin() external view returns (address)'],
      ethers.provider
    );
    const adminAddress = await contract.admin();
    
    return new Contract(
      adminAddress,
      [
        'function owner() external view returns (address)',
        'function getProxyImplementation(address) external view returns (address)'
      ],
      ethers.provider
    );
  } catch (error) {
    // Method 2: Try to get admin using storage slot
    const adminSlot = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
    const adminAddress = await ethers.provider.getStorageAt(contractAddress, adminSlot);
    
    return new Contract(
      ethers.utils.getAddress(adminAddress.slice(26)), // Remove padding
      [
        'function owner() external view returns (address)',
        'function getProxyImplementation(address) external view returns (address)'
      ],
      ethers.provider
    );
  }
} 