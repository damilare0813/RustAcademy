import { Networks } from '@stellar/stellar-sdk';

export type StellarNetwork = 'testnet' | 'mainnet';

export interface StellarNetworkConfig {
  network: StellarNetwork;
  horizonUrl: string;
  passphrase: string;
}

export const SUPPORTED_STELLAR_NETWORKS: readonly StellarNetwork[] = [
  'testnet',
  'mainnet',
];

const DEFAULT_STELLAR_NETWORK: StellarNetwork = 'testnet';

function isStellarNetwork(value: string): value is StellarNetwork {
  return (SUPPORTED_STELLAR_NETWORKS as readonly string[]).includes(value);
}

const NETWORKS: Record<StellarNetwork, StellarNetworkConfig> = {
  testnet: {
    network: 'testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    passphrase: Networks.TESTNET,
  },
  mainnet: {
    network: 'mainnet',
    horizonUrl: 'https://horizon.stellar.org',
    passphrase: Networks.PUBLIC,
  },
};

/**
 * Normalize a raw network name to a supported {@link StellarNetwork}.
 *
 * An unset, empty, or whitespace-only value falls back to the default
 * network. Values are accepted case-insensitively and are trimmed of
 * surrounding whitespace. Any other value is rejected with an explicit
 * error naming the offending value and the supported alternatives.
 */
export function normalizeStellarNetwork(
  value: string | null | undefined,
): StellarNetwork | undefined {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === '') return undefined;
  if (isStellarNetwork(normalized)) return normalized;

  const raw = (value as string).trim();
  throw new Error(
    `Unsupported STELLAR_NETWORK: "${raw}". ` +
      `Supported values: ${SUPPORTED_STELLAR_NETWORKS.join(', ')}.`,
  );
}

export function resolveStellarNetwork(value?: string): StellarNetworkConfig {
  const network =
    normalizeStellarNetwork(value) ?? DEFAULT_STELLAR_NETWORK;

  return NETWORKS[network];
}
