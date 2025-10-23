export interface VaultAgentSummary {
  id: string;
  name: string;
  model: string;
  modelId: string;
  vaultAddress: `0x${string}`;
  leaderAddress: `0x${string}`;
  logsUrl: string;
  dashboardUrl: string;
}

export interface RiskSnapshot {
  copyRatio: number;
  maxLeverage: number;
  maxNotionalUsd: number;
  slippageBps: number;
  refreshAccountIntervalMs: number;
}

export const RISK_SNAPSHOT: RiskSnapshot = {
  copyRatio: 1,
  maxLeverage: 10,
  maxNotionalUsd: 1_000_000,
  slippageBps: 25,
  refreshAccountIntervalMs: 60_000,
};

export const VAULT_AGENTS: VaultAgentSummary[] = [
  {
    id: "deepseek-chat-v3.1",
    name: "DeepSeek V3.1",
    model: "DeepSeek V3.1",
    modelId: "deepseek-chat-v3.1",
    vaultAddress: "0x250ca707028959f86c92e410235856622d27306f",
    leaderAddress: "0xc20ac4dc4188660cbf555448af52694ca62b0734",
    logsUrl: "https://userapi-compute.eigencloud.xyz/logs/0x4418BA3C4a1E52BBd8f1133fA136CCED3807c6f9",
    dashboardUrl: "https://nof1.ai/models/deepseek-chat-v3.1",
  },
  {
    id: "qwen3-max",
    name: "Qwen3 Max",
    model: "Qwen3 Max",
    modelId: "qwen3-max",
    vaultAddress: "0x391d287ddf3ec911de7e211b4b33364361e194b9",
    leaderAddress: "0x7a8fd8bba33e37361ca6b0cb4518a44681bad2f3",
    logsUrl: "https://userapi-compute.eigencloud.xyz/logs/0xfFE88cADD07B343C79d8e617853A1e140c695860",
    dashboardUrl: "https://nof1.ai/models/qwen3-max",
  },
  {
    id: "grok-4",
    name: "Grok 4",
    model: "Grok 4",
    modelId: "grok-4",
    vaultAddress: "0xd3e4cd447dc6657716b56ac11f38825fa8cd60ac",
    leaderAddress: "0x56d652e62998251b56c8398fb11fcfe464c08f84",
    logsUrl: "https://userapi-compute.eigencloud.xyz/logs/0x9abb8630488a02Ec3410C26785f661fa49218140",
    dashboardUrl: "https://nof1.ai/models/grok-4",
  },
];

