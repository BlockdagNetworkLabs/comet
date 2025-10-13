# Faucet Tool

A simple TypeScript utility to request test tokens from a faucet contract. Located in `tools/faucet/`.

## Quick Start

1. Navigate to the tool:
   ```bash
   cd tools/faucet
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Configure in `faucet.ts`:
   ```typescript
   const CONFIG: FaucetConfig = {
     faucetAddress: "0x949b2175F38BF40e30A3A68D506B2999acEC4b85",
     rpcUrl: "https://your-rpc-url.com",
     privateKey: "YOUR_PRIVATE_KEY",  // ⚠️ Never commit this!
     tokens: [
       { address: "0xC6F11e6124D8c4864951229652497c782EC17e38" }, // DAI
       { address: "0xf24B549f81c9de7a99e5247Bc29328B4CAf44dF3" }, // WBTC
       { address: "0x76b6383fB0bAeE78fF330Ae4E5674cF60798f651" }, // WETH
     ]
   };
   ```

4. Run the script:
   ```bash
   yarn dev
   ```

## What It Does

The script will:
- Request tokens from the faucet for each configured token address
- Check if cooldown has passed (skips tokens still in cooldown)
- Show balance before and after each drip
- Log transaction hashes and results

## Example Output

```
Starting faucet drip for wallet: 0x1234...5678
Number of tokens: 3
---

Processing token: 0xC6F1...7e38
Token: DAI (18 decimals)
Balance before drip: 0.0 DAI
Drip transaction sent: 0xabcd...ef01
Balance after drip: 1000.0 DAI
✅ Successfully dripped DAI
---

Processing token: 0xf24B...4dF3
Cannot drip yet. 24h cooldown not met.
❌ Failed to drip WBTC
---
```

## Security

⚠️ **Never commit your private key to version control!**

For safer usage, use environment variables:

```bash
export FAUCET_ADDRESS="0x949b2175F38BF40e30A3A68D506B2999acEC4b85"
export RPC_URL="https://rpc.blockdag.network"
export PRIVATE_KEY="0x..."

yarn dev
```

Update config to use them:
```typescript
const CONFIG: FaucetConfig = {
  faucetAddress: process.env.FAUCET_ADDRESS || "",
  rpcUrl: process.env.RPC_URL || "",
  privateKey: process.env.PRIVATE_KEY || "",
  tokens: [...]
};
```

## Troubleshooting

**"Cannot drip yet. 24h cooldown not met"**  
→ Wait for the cooldown to expire, then run again

**Transaction fails**  
→ Check you have enough native tokens for gas

**RPC errors**  
→ Verify your RPC URL is correct and accessible

---

*Part of the BlockDAG development toolkit*
