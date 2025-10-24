## Architecture

### System Flow

![Copytrading Agent Flow](./Flowchart.png)

### Overview

This project is a Hyperliquid copy-trading agent. It mirrors a leader account's positions onto a follower account (wallet or vault) in near real-time while enforcing explicit risk controls. It combines:

- HTTP API for authoritative state reads and order submission
- WebSocket subscriptions for low-latency leader fills
- Periodic reconciliation to repair drift

Key guarantees:
- Deterministic, stateless startup (no DB); state is derived from Hyperliquid
- Defensive risk envelope (copy ratio, leverage cap, notional cap, slippage cap)
- Graceful degradation: WebSocket for speed, HTTP reconciliation for correctness

---

## Components

### Orchestrator
- `src/index.ts`
  - Loads config
  - Creates Hyperliquid clients (HTTP + WebSocket)
  - Instantiates services (metadata, subscriptions, executor, reconciler)
  - Starts subscriptions and periodic reconciliation loop
  - Runs a background poll loop that periodically re-syncs follower state
  - Handles SIGINT/SIGTERM for clean shutdown

### Configuration
- `src/config/index.ts`
  - Types: `HyperliquidEnvironment`, `RiskConfig`, `CopyTradingConfig`
  - Validates and loads environment variables
  - Enforces strict optional property typing (only includes optional fields when present)

### Hyperliquid Clients
- `src/clients/hyperliquid.ts`
  - Exports `createHyperliquidClients(config)` producing:
    - `InfoClient` (HTTP)
    - `ExchangeClient` (HTTP)
    - `SubscriptionClient` (WebSocket)
    - `HttpTransport`, `WebSocketTransport`
    - `followerAccount` (viem account)
    - `followerTradingAddress` (wallet or vault address)
  - Includes a Node.js WebSocket adapter to satisfy the SDK’s DOM WebSocket contract (binaryType, dispatchEvent) while running under Node. Reconnect uses infinite retries.

### Domain State
- `src/domain/traderState.ts` — Base class `TraderStateStore`
  - Holds `positions: Map<string, PositionSnapshot>` and `metrics: AccountMetrics`
  - `applyClearinghouseState` applies full snapshots (authoritative)
  - `handleFillEvent` applies incremental updates from WebSocket fills
  - Robust fill handling covers: open, add, reduce, close, flip direction
- `src/domain/leaderState.ts`
  - Extends `TraderStateStore`
  - `computeTargets(risk)` scales leader positions by `copyRatio`
- `src/domain/followerState.ts`
  - Extends `TraderStateStore`
  - `computeDeltas(targets, risk)` returns `PositionDelta[]` subject to:
    - `maxLeverage` × follower equity
    - `maxNotionalUsd`
    - Generates close deltas for positions present only on follower
- `src/domain/types.ts` — shared domain types

### Services
- `src/services/marketMetadata.ts`
  - Caches asset metadata (asset ID, size decimals, max leverage) and mark prices
  - `ensureLoaded` and `refreshMarkPrices` are used by the executor
- `src/services/subscriptions.ts`
  - Subscribes to leader `userFills`
  - Updates leader state and triggers sync callback
- `src/services/reconciler.ts`
  - Periodically fetches full clearinghouse state for leader and follower
  - Corrects drift and rehydrates state after reconnects
- `src/services/tradeExecutor.ts`
  - Computes targets and deltas
  - Builds IOC limit orders with slippage control
  - Submits batch orders via `ExchangeClient`
  - Skips “dust” deltas with a configurable epsilon

### Utilities
- `src/utils/logger.ts` — Structured console logger with `LOG_LEVEL`
- `src/utils/math.ts` — Safe numeric helpers: `toFloat`, `round`, `clamp`, `safeDivide`

---

## Runtime Flows

### Startup
1. `loadConfig()` reads and validates environment variables
2. `createHyperliquidClients()` initializes transports and clients
3. Market metadata service is constructed (loaded lazily)
4. Subscription service connects to leader fills
5. Reconciler performs an initial reconciliation and starts its interval
6. Background poll loop periodically calls `syncWithLeader()`

### Live Sync Path (WebSocket)
1. `SubscriptionService.start()` subscribes to `userFills` for leader
2. On event: `LeaderState.handleFillEvent()` applies incremental updates
3. `TradeExecutor.syncWithLeader()` computes deltas and submits orders

### Periodic Reconciliation Path (HTTP)
1. `Reconciler.reconcileOnce()` fetches leader and follower clearinghouse states
2. `LeaderState.applyClearinghouseState()` and `FollowerState.applyClearinghouseState()` replace state
3. Next loop tick scheduled by `setInterval`

### Shutdown
1. Stop WebSocket subscriptions
2. Stop reconciliation interval
3. Close WebSocket transport
4. Exit process

---

## Risk Model

All risk enforcement happens before order construction:
- `copyRatio`: Scales target sizes from leader positions
- Leverage cap: `maxLeverage × accountValueUsd` limits allowed notional
- Global notional cap: `maxNotionalUsd`
- Slippage: `maxSlippageBps` limits price deviation when building IOC limits
- Dust threshold: minimum absolute delta size (`1e-6`) to avoid noise trades

Reduce-only behavior is set when closing or reducing existing positions to avoid unintended increases in exposure.

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `HYPERLIQUID_ENVIRONMENT` | No | `mainnet` | Hyperliquid network: `mainnet` or `testnet` |
| `LEADER_ADDRESS` | Yes | — | EVM address of the leader to follow |
| `FOLLOWER_PRIVATE_KEY` | Yes | — | Follower wallet private key (hex with `0x`) |
| `FOLLOWER_VAULT_ADDRESS` | No | — | Vault address if trading via a vault |
| `COPY_RATIO` | No | `1` | Multiplier for follower position size |
| `MAX_LEVERAGE` | No | `10` | Max leverage cap for follower |
| `MAX_NOTIONAL_USD` | No | `250000` | Global per-position notional cap |
| `MAX_SLIPPAGE_BPS` | No | `25` | Max slippage in basis points |
| `RECONCILIATION_INTERVAL_MS` | No | `60000` | Reconciliation interval |
| `REFRESH_ACCOUNT_INTERVAL_MS` | No | `5000` | Poll loop interval |
| `AGGREGATE_FILLS` | No | `true` | Aggregate leader fills by time window |
| `INVERSE` | No | `false` | If true, invert copy direction (long↔short) |
| `LOG_LEVEL` | No | `info` | `debug` | `info` | `warn` | `error` |

Example:

```bash
export HYPERLIQUID_ENVIRONMENT=testnet
export LEADER_ADDRESS=0xleader...
export FOLLOWER_PRIVATE_KEY=0xabc...
export FOLLOWER_VAULT_ADDRESS=0xvault...
export COPY_RATIO=0.5
export MAX_LEVERAGE=5
export MAX_NOTIONAL_USD=100000
export MAX_SLIPPAGE_BPS=25
export RECONCILIATION_INTERVAL_MS=60000
export REFRESH_ACCOUNT_INTERVAL_MS=5000
export AGGREGATE_FILLS=true
export INVERSE=false
export LOG_LEVEL=info
```

---

## Error Handling & Resilience

- WebSocket:
  - Infinite reconnects via `WebSocketTransport.reconnect.maxRetries = Infinity`
  - Node adapter fulfills DOM `WebSocket` interface (binaryType, dispatchEvent)
  - `wsTransport.ready().catch(...)` logs initial connection failures (non-blocking)
- Reconciliation:
  - Exceptions are caught and logged per tick; loop continues
- Trade execution:
  - Metadata is ensured fresh before order building
  - Batch submission; any exchange-side errors propagate to logs/caller

---

## Performance Characteristics

- WebSocket-first design for low latency; reconciliation and polling ensure eventual consistency
- Mark prices cached and refreshed to avoid redundant HTTP overhead
- Orders are IOC to minimize stale resting risk
- Minimal in-memory indexes (maps) for O(1) lookups by coin

---

## Security Considerations

- Private key is provided via environment variable; never logged
- Vault trading supported via `defaultVaultAddress` (no extra privileges in code)
- No persistent storage; secrets remain in process memory only

---

## Extensibility

- Additional subscriptions: `orderUpdates`, `userEvents`, `openOrders` can be added in `SubscriptionService`
- Alternative execution strategies: switch IOC to post-only, TWAP, or split orders
- Risk policy extensions: per-asset caps, dynamic copy ratio, cooldown windows
- Integrations: emit metrics to Prometheus, add health endpoints, structured JSON logging

---

## Source Map

- Orchestrator: `src/index.ts`
- Config: `src/config/index.ts`
- Clients: `src/clients/hyperliquid.ts`
- Domain: `src/domain/{types, traderState, leaderState, followerState}.ts`
- Services: `src/services/{marketMetadata, subscriptions, reconciler, tradeExecutor}.ts`
- Utils: `src/utils/{logger, math}.ts`


