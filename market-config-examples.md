# Ejemplos de Configuraciones de Market con Diferentes Niveles de Rewards

## 1. Configuración Normal (Balanced)

Para un market establecido con actividad constante:

```json
{
  "name": "Compound USDC",
  "symbol": "cUSDCv3",
  "baseToken": "USDC",
  "baseTokenAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "borrowMin": "100e6",
  "governor": "0x6d903f6003cca6255d85cca4d3b5e5146dc33925",
  "pauseGuardian": "0xbbf3f1421d886e9b2c5d716b5192ac998af2012c",
  "baseTokenPriceFeed": "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
  "storeFrontPriceFactor": 0.6,
  "targetReserves": "5000000e6",
  "rates": {
    "supplyKink": 0.8,
    "supplySlopeLow": 0.0325,
    "supplySlopeHigh": 0.4,
    "supplyBase": 0,
    "borrowKink": 0.8,
    "borrowSlopeLow": 0.035,
    "borrowSlopeHigh": 0.25,
    "borrowBase": 0.015
  },
  "tracking": {
    "indexScale": "1e15",
    "baseSupplySpeed": "289351851851e0",
    "baseBorrowSpeed": "289351851851e0",
    "baseMinForRewards": "1000e6"
  },
  "rewardTokenAddress": "0xc00e94Cb662C3520282E6f5717214004A7f26888",
  "assets": {
    "WETH": {
      "address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "priceFeed": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
      "decimals": "18",
      "borrowCF": 0.8,
      "liquidateCF": 0.85,
      "liquidationFactor": 0.9,
      "supplyCap": "100000e18"
    },
    "WBTC": {
      "address": "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      "priceFeed": "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
      "decimals": "8",
      "borrowCF": 0.75,
      "liquidateCF": 0.8,
      "liquidationFactor": 0.85,
      "supplyCap": "5000e8"
    }
  }
}
```

**Características:**
- ✅ ~25 COMP/día para suppliers
- ✅ ~25 COMP/día para borrowers
- ✅ Total: ~50 COMP/día (~$18,250/año a $1 COMP)
- ✅ Ratio 1:1 balanceado

---

## 2. Configuración High Rewards (Agresiva)

Para lanzamiento de nuevo market o para atraer liquidez rápidamente:

```json
{
  "name": "Compound USDS",
  "symbol": "cUSDSv3",
  "baseToken": "USDS",
  "baseTokenAddress": "0xdC035D45d973E3EC169d2276DDab16f1e407384F",
  "borrowMin": "10e18",
  "governor": "0x6d903f6003cca6255d85cca4d3b5e5146dc33925",
  "pauseGuardian": "0xbbf3f1421d886e9b2c5d716b5192ac998af2012c",
  "baseTokenPriceFeed": "0xfF30586cD0F29eD462364C7e81375FC0C71219b1",
  "storeFrontPriceFactor": 0.6,
  "targetReserves": "10000000e18",
  "rates": {
    "supplyKink": 0.85,
    "supplySlopeLow": 0.04,
    "supplySlopeHigh": 0.5,
    "supplyBase": 0,
    "borrowKink": 0.85,
    "borrowSlopeLow": 0.045,
    "borrowSlopeHigh": 0.35,
    "borrowBase": 0.02
  },
  "tracking": {
    "indexScale": "1e15",
    "baseSupplySpeed": "1157407407407e0",
    "baseBorrowSpeed": "1736111111111e0",
    "baseMinForRewards": "500e18"
  },
  "rewardTokenAddress": "0xc00e94Cb662C3520282E6f5717214004A7f26888",
  "assets": {
    "WETH": {
      "address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "priceFeed": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
      "decimals": "18",
      "borrowCF": 0.82,
      "liquidateCF": 0.87,
      "liquidationFactor": 0.92,
      "supplyCap": "50000e18"
    },
    "wstETH": {
      "address": "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
      "priceFeed": "0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8",
      "decimals": "18",
      "borrowCF": 0.8,
      "liquidateCF": 0.85,
      "liquidationFactor": 0.9,
      "supplyCap": "25000e18"
    }
  }
}
```

**Características:**
- 🚀 ~100 COMP/día para suppliers
- 🚀 ~150 COMP/día para borrowers
- 🚀 Total: ~250 COMP/día (~$91,250/año a $1 COMP)
- 🎯 Ratio 1:1.5 (más incentivo para borrowing = mayor utilización)
- 💡 Umbral mínimo reducido (500 tokens) para atraer más usuarios

---

## 3. Configuración Low Rewards (Conservadora)

Para markets maduros con buena liquidez o para conservar tokens de rewards:

```json
{
  "name": "Compound WETH",
  "symbol": "cWETHv3",
  "baseToken": "WETH",
  "baseTokenAddress": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "borrowMin": "0.01e18",
  "governor": "0x6d903f6003cca6255d85cca4d3b5e5146dc33925",
  "pauseGuardian": "0xbbf3f1421d886e9b2c5d716b5192ac998af2012c",
  "baseTokenPriceFeed": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  "storeFrontPriceFactor": 0.55,
  "targetReserves": "50000e18",
  "rates": {
    "supplyKink": 0.9,
    "supplySlopeLow": 0.025,
    "supplySlopeHigh": 0.35,
    "supplyBase": 0,
    "borrowKink": 0.9,
    "borrowSlopeLow": 0.03,
    "borrowSlopeHigh": 0.2,
    "borrowBase": 0.01
  },
  "tracking": {
    "indexScale": "1e15",
    "baseSupplySpeed": "57870370370e0",
    "baseBorrowSpeed": "115740740740e0",
    "baseMinForRewards": "5000e18"
  },
  "rewardTokenAddress": "0xc00e94Cb662C3520282E6f5717214004A7f26888",
  "assets": {
    "WBTC": {
      "address": "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      "priceFeed": "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
      "decimals": "8",
      "borrowCF": 0.75,
      "liquidateCF": 0.8,
      "liquidationFactor": 0.85,
      "supplyCap": "3000e8"
    },
    "cbETH": {
      "address": "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704",
      "priceFeed": "0xF017fcB346A1885194689bA23Eff2fE6fA5C483b",
      "decimals": "18",
      "borrowCF": 0.82,
      "liquidateCF": 0.87,
      "liquidationFactor": 0.92,
      "supplyCap": "10000e18"
    }
  }
}
```

**Características:**
- 📉 ~5 COMP/día para suppliers
- 📉 ~10 COMP/día para borrowers
- 📉 Total: ~15 COMP/día (~$5,475/año a $1 COMP)
- 🎯 Ratio 1:2 (doble incentivo para borrowing)
- 🔒 Umbral mínimo alto (5,000 tokens) para usuarios serios

---

## Comparación Rápida

| Configuración | Supply/día | Borrow/día | Total/día | Costo Anual* | Uso Recomendado |
|--------------|-----------|-----------|----------|-------------|-----------------|
| **Low** | 5 COMP | 10 COMP | 15 COMP | ~$5,475 | Markets maduros |
| **Normal** | 25 COMP | 25 COMP | 50 COMP | ~$18,250 | Markets establecidos |
| **High** | 100 COMP | 150 COMP | 250 COMP | ~$91,250 | Nuevos markets |

*Asumiendo precio de COMP = $1

---

## Cómo Calcular los Valores de Speed

### Fórmula:
```
rewardsPerDay = (speed × 86400) / indexScale
```

### Ejemplo para obtener 25 COMP/día:
```
speed = (25 × 1e15) / 86400
speed = 25000000000000000 / 86400
speed = 289351851851.85
speed ≈ 289351851851e0
```

### Calculadora rápida (con indexScale = 1e15):

| COMP/día deseado | Speed necesario |
|------------------|-----------------|
| 5 | 57870370370e0 |
| 10 | 115740740740e0 |
| 25 | 289351851851e0 |
| 50 | 578703703703e0 |
| 100 | 1157407407407e0 |
| 150 | 1736111111111e0 |
| 200 | 2314814814814e0 |

---

## Estrategias de Ratio Supply:Borrow

### 1. Balanceado (1:1)
- **Cuándo usar**: Market maduro con buena utilización
- **Efecto**: Incentiva igualmente ambos lados
- **Ejemplo**: Normal config

### 2. Borrow-Heavy (1:1.5 o 1:2)
- **Cuándo usar**: Necesitas aumentar utilización del market
- **Efecto**: Más incentivo para pedir prestado
- **Ejemplo**: High config (1:1.5), Low config (1:2)

### 3. Supply-Heavy (1.5:1 o 2:1)
- **Cuándo usar**: Necesitas más liquidez en el market
- **Efecto**: Más incentivo para depositar
- **Ejemplo**: Útil cuando hay alta demanda de préstamos

---

## Consideraciones Importantes

1. **Funding del Contrato**: Asegúrate de tener suficientes tokens en CometRewards
   - Low config: ~5,475 COMP/año
   - Normal config: ~18,250 COMP/año
   - High config: ~91,250 COMP/año

2. **baseMinForRewards**: Ajusta según el valor del token base
   - Tokens caros (WETH): umbral bajo (0.1-1 token)
   - Tokens baratos (USDC/DAI): umbral alto (100-10,000 tokens)

3. **Decimales**: Los valores de speed deben ajustarse según los decimales del token
   - 18 decimals: usa los ejemplos tal cual
   - 6 decimals: divide speed entre 1e12
   - 8 decimals: divide speed entre 1e10

4. **Monitoreo**: Revisa regularmente
   - Utilización del market
   - Costo efectivo de rewards vs. fees generados
   - Competencia con otros protocolos
   - Ajusta rewards según métricas

5. **Gradual Reduction**: Para markets nuevos
   - Mes 1-3: High rewards
   - Mes 4-6: Normal rewards  
   - Mes 7+: Low rewards o eliminar




