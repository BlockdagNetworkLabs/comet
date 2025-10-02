
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
import infrastructureRelationConfig from '../../deployments/e2e-network/_infrastructure/relations';
import daiRelationConfig from '../../deployments/e2e-network/dai/relations';
import usdcRelationConfig from '../../deployments/e2e-network/usdc/relations';

const testConfig: HardhatUserConfig = {
  "solidity": {
    "compilers": [
      {
        "version": "0.8.15",
        "settings": {
          "optimizer": {
            "enabled": true,
            "runs": 1,
            "details": {
              "yulDetails": {
                "optimizerSteps": "dhfoDgvulfnTUtnIf [xa[r]scLM cCTUtTOntnfDIul Lcul Vcul [j] Tpeul xa[rul] xa[r]cL gvif CTUca[r]LsTOtfDnca[r]Iulc] jmul[jul] VcTOcul jmul"
              }
            }
          },
          "outputSelection": {
            "*": {
              "*": [
                "evm.deployedBytecode.sourceMap",
                "abi",
                "evm.bytecode",
                "evm.deployedBytecode",
                "evm.methodIdentifiers",
                "metadata"
              ],
              "": [
                "ast"
              ]
            }
          },
          "viaIR": true
        }
      },
      {
        "version": "0.5.16",
        "settings": {
          "optimizer": {
            "enabled": true,
            "runs": 200
          },
          "outputSelection": {
            "*": {
              "*": [
                "evm.deployedBytecode.sourceMap",
                "abi",
                "evm.bytecode",
                "evm.deployedBytecode",
                "evm.methodIdentifiers",
                "metadata"
              ],
              "": [
                "ast"
              ]
            }
          }
        }
      }
    ],
    "overrides": {}
  },
  "networks": {
    "e2e-network": {"chainId":31337,"url":"http://127.0.0.1:8545","accounts":["ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"],"gas":"auto","gasPrice":"auto"}
  },
  "etherscan": {
    "apiKey": {
      "mainnet": "9MUAIJWFUM2P1PVM9NWWDZNP1IZF9C6I8G",
      "sepolia": "9MUAIJWFUM2P1PVM9NWWDZNP1IZF9C6I8G",
      "avalanche": "blabla",
      "avalancheFujiTestnet": "blabla",
      "polygon": "blabla",
      "arbitrumOne": "blabla",
      "arbitrumTestnet": "blabla",
      "arbitrum": "blabla",
      "optimisticEthereum": "blabla",
      "mantle": "blabla",
      "unichain": "9MUAIJWFUM2P1PVM9NWWDZNP1IZF9C6I8G",
      "scroll": "blabla"
    },
    "customChains": [
      {
        "network": "arbitrum",
        "chainId": 42161,
        "urls": {
          "apiURL": "https://api.arbiscan.io/api",
          "browserURL": "https://arbiscan.io/"
        }
      },
      {
        "network": "base",
        "chainId": 8453,
        "urls": {
          "apiURL": "https://api.basescan.org/api",
          "browserURL": "https://basescan.org/"
        }
      },
      {
        "network": "scroll",
        "chainId": 534352,
        "urls": {
          "apiURL": "https://api.scrollscan.com/api",
          "browserURL": "https://scrollscan.com/"
        }
      },
      {
        "network": "unichain",
        "chainId": 130,
        "urls": {
          "apiURL": "https://unichain.blockscout.com/api",
          "browserURL": "https://unichain.blockscout.com/"
        }
      },
      {
        "network": "mantle",
        "chainId": 5000,
        "urls": {
          "apiURL": "https://explorer.mantle.xyz/api",
          "browserURL": "https://explorer.mantle.xyz/"
        }
      },
      {
        "network": "ronin",
        "chainId": 2020,
        "urls": {
          "apiURL": "https://explorer-kintsugi.roninchain.com/v2/2020",
          "browserURL": "https://app.roninchain.com"
        }
      },
      {
        "network": "bdag-primordial",
        "chainId": 1043,
        "urls": {
          "apiURL": "",
          "browserURL": "https://primordial.bdagscan.com/"
        }
      }
    ]
  },
  "typechain": {
    "outDir": "build/types",
    "target": "ethers-v5",
    "alwaysGenerateOverloads": false,
    "tsNocheck": false
  },
  "deploymentManager": {
    "relationConfigMap": {
      "comptrollerV2": {
        "delegates": {}
      },
      "comet": {
        "delegates": {
          "field": {
            "slot": "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
          }
        },
        "relations": {
          "baseToken": {},
          "cometExt": {},
          "assetListFactory": {},
          "baseTokenPriceFeed": {},
          "assets": {},
          "assetPriceFeeds": {},
          "cometAdmin": {
            "field": {
              "slot": "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"
            }
          }
        }
      },
      "comet:implementation": {
        "artifact": "contracts/Comet.sol:Comet",
        "delegates": {}
      },
      "configurator": {
        "delegates": {
          "field": {
            "slot": "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
          }
        },
        "relations": {
          "configuratorAdmin": {
            "field": {
              "slot": "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"
            }
          },
          "cometFactory": {}
        }
      },
      "cometAdmin": {
        "relations": {
          "timelock": {}
        }
      },
      "timelock": {
        "relations": {
          "governor": {}
        }
      },
      "governor": {
        "artifact": "contracts/IProxy.sol:IProxy",
        "delegates": {
          "field": {
            "slot": "0x10d6a54a4754c8869d6886b5f5d7fbfa5b4522237ea5c60d11bc4e7a1ff9390b"
          }
        },
        "relations": {
          "COMP": {}
        }
      },
      "governor:implementation": {
        "artifact": "contracts/IGovernorBravo.sol:IGovernorBravo"
      },
      "COMP": {
        "artifact": "contracts/IComp.sol:IComp"
      },
      "FiatTokenProxy": {
        "artifact": "contracts/ERC20.sol:ERC20",
        "relations": {
          "fiatTokenAdmin": {
            "field": {
              "slot": "0x10d6a54a4754c8869d6886b5f5d7fbfa5b4522237ea5c60d11bc4e7a1ff9390b"
            }
          }
        },
        "delegates": {
          "field": {
            "slot": "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3"
          }
        }
      },
      "rewards": {
        "relations": {
          "rewardToken": {}
        }
      }
    },
    "networks": {
      "e2e-network": {_infrastructure: infrastructureRelationConfig,dai: daiRelationConfig,usdc: usdcRelationConfig}
    }
  },
  "scenario": {
    "bases": [
      {
        "name": "mainnet",
        "network": "mainnet",
        "deployment": "usdc",
        "allocation": 1
      },
      {
        "name": "mainnet-weth",
        "network": "mainnet",
        "deployment": "weth"
      },
      {
        "name": "mainnet-usdt",
        "network": "mainnet",
        "deployment": "usdt"
      },
      {
        "name": "mainnet-wsteth",
        "network": "mainnet",
        "deployment": "wsteth"
      },
      {
        "name": "mainnet-usds",
        "network": "mainnet",
        "deployment": "usds"
      },
      {
        "name": "mainnet-wbtc",
        "network": "mainnet",
        "deployment": "wbtc"
      },
      {
        "name": "development",
        "network": "hardhat",
        "deployment": "dai"
      },
      {
        "name": "fuji",
        "network": "fuji",
        "deployment": "usdc"
      },
      {
        "name": "sepolia-usdc",
        "network": "sepolia",
        "deployment": "usdc"
      },
      {
        "name": "sepolia-weth",
        "network": "sepolia",
        "deployment": "weth"
      },
      {
        "name": "polygon",
        "network": "polygon",
        "deployment": "usdc",
        "auxiliaryBase": "mainnet"
      },
      {
        "name": "polygon-usdt",
        "network": "polygon",
        "deployment": "usdt",
        "auxiliaryBase": "mainnet"
      },
      {
        "name": "arbitrum-usdc.e",
        "network": "arbitrum",
        "deployment": "usdc.e",
        "auxiliaryBase": "mainnet"
      },
      {
        "name": "arbitrum-usdt",
        "network": "arbitrum",
        "deployment": "usdt",
        "auxiliaryBase": "mainnet"
      },
      {
        "name": "arbitrum-usdc",
        "network": "arbitrum",
        "deployment": "usdc",
        "auxiliaryBase": "mainnet"
      },
      {
        "name": "arbitrum-weth",
        "network": "arbitrum",
        "deployment": "weth",
        "auxiliaryBase": "mainnet"
      },
      {
        "name": "base-usdbc",
        "network": "base",
        "deployment": "usdbc",
        "auxiliaryBase": "mainnet"
      },
      {
        "name": "base-weth",
        "network": "base",
        "deployment": "weth",
        "auxiliaryBase": "mainnet"
      },
      {
        "name": "base-usdc",
        "network": "base",
        "deployment": "usdc",
        "auxiliaryBase": "mainnet"
      },
      {
        "name": "base-aero",
        "network": "base",
        "deployment": "aero",
        "auxiliaryBase": "mainnet"
      },
      {
        "name": "base-usds",
        "network": "base",
        "deployment": "usds",
        "auxiliaryBase": "mainnet"
      },
      {
        "name": "optimism-usdc",
        "network": "optimism",
        "deployment": "usdc",
        "auxiliaryBase": "mainnet"
      },
      {
        "name": "optimism-usdt",
        "network": "optimism",
        "deployment": "usdt",
        "auxiliaryBase": "mainnet"
      },
      {
        "name": "optimism-weth",
        "network": "optimism",
        "deployment": "weth",
        "auxiliaryBase": "mainnet"
      },
      {
        "name": "mantle-usde",
        "network": "mantle",
        "deployment": "usde",
        "auxiliaryBase": "mainnet"
      },
      {
        "name": "unichain-usdc",
        "network": "unichain",
        "deployment": "usdc",
        "auxiliaryBase": "mainnet"
      },
      {
        "name": "unichain-weth",
        "network": "unichain",
        "deployment": "weth",
        "auxiliaryBase": "mainnet"
      },
      {
        "name": "scroll-usdc",
        "network": "scroll",
        "deployment": "usdc",
        "auxiliaryBase": "mainnet"
      },
      {
        "name": "ronin-weth",
        "network": "ronin",
        "deployment": "weth",
        "auxiliaryBase": "mainnet"
      },
      {
        "name": "ronin-wron",
        "network": "ronin",
        "deployment": "wron",
        "auxiliaryBase": "mainnet"
      }
    ]
  },
  "mocha": {
    "timeout": 150000,
    "reporter": "mocha-multi-reporters",
    "reporterOptions": {
      "reporterEnabled": [
        "spec",
        "json"
      ],
      "jsonReporterOptions": {
        "output": "test-results.json"
      }
    }
  },
  "paths": {
    "tests": "/Users/trabajo/Documents/SpaceDev/BlockDAG/comet/test",
    "root": "/Users/trabajo/Documents/SpaceDev/BlockDAG/comet",
    "configFile": "/Users/trabajo/Documents/SpaceDev/BlockDAG/comet/hardhat.config.ts",
    "sources": "/Users/trabajo/Documents/SpaceDev/BlockDAG/comet/contracts",
    "cache": "/Users/trabajo/Documents/SpaceDev/BlockDAG/comet/cache",
    "artifacts": "/Users/trabajo/Documents/SpaceDev/BlockDAG/comet/artifacts"
  },
  "contractSizer": {
    "alphaSort": true,
    "disambiguatePaths": false,
    "runOnCompile": true,
    "strict": false,
    "only": [],
    "except": [],
    "outputFile": null,
    "unit": "KiB"
  },
  "gasReporter": {
    "enabled": false,
    "currency": "USD",
    "gasPrice": 200
  },
  "defaultNetwork": "hardhat"
};

export default testConfig;
