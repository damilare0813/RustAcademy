import {
  normalizeStellarNetwork,
  resolveStellarNetwork,
  SUPPORTED_STELLAR_NETWORKS,
} from './network.config';

describe('normalizeStellarNetwork', () => {
  it('returns undefined for unset, empty, and whitespace-only values', () => {
    expect(normalizeStellarNetwork(undefined)).toBeUndefined();
    expect(normalizeStellarNetwork(null)).toBeUndefined();
    expect(normalizeStellarNetwork('')).toBeUndefined();
    expect(normalizeStellarNetwork('   ')).toBeUndefined();
  });

  it('accepts supported names case-insensitively', () => {
    expect(normalizeStellarNetwork('testnet')).toBe('testnet');
    expect(normalizeStellarNetwork('TESTNET')).toBe('testnet');
    expect(normalizeStellarNetwork('mainnet')).toBe('mainnet');
    expect(normalizeStellarNetwork('MAINNET')).toBe('mainnet');
  });

  it('trims surrounding whitespace before matching', () => {
    expect(normalizeStellarNetwork('  testnet  ')).toBe('testnet');
    expect(normalizeStellarNetwork('\t Mainnet \n')).toBe('mainnet');
  });

  it('rejects unknown network values explicitly', () => {
    expect(() => normalizeStellarNetwork('local')).toThrow(
      /Unsupported STELLAR_NETWORK: "local"\. Supported values: testnet, mainnet\./,
    );
  });

  it('rejects unknown values even when wrapped in whitespace', () => {
    expect(() => normalizeStellarNetwork('  localnet  ')).toThrow(
      /Unsupported STELLAR_NETWORK: "localnet"/,
    );
  });

  it('lists every supported network in the rejection message', () => {
    try {
      normalizeStellarNetwork('bogus');
      fail('expected normalizeStellarNetwork to throw');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('bogus');
      for (const network of SUPPORTED_STELLAR_NETWORKS) {
        expect(message).toContain(network);
      }
    }
  });
});

describe('resolveStellarNetwork', () => {
  it('defaults to testnet when unset, empty, or whitespace-only', () => {
    expect(resolveStellarNetwork().network).toBe('testnet');
    expect(resolveStellarNetwork('').network).toBe('testnet');
    expect(resolveStellarNetwork('   ').network).toBe('testnet');
    expect(resolveStellarNetwork().horizonUrl).toBe(
      'https://horizon-testnet.stellar.org',
    );
  });

  it('uses the testnet passphrase for testnet', () => {
    expect(resolveStellarNetwork('Testnet').passphrase).toBe(
      'Test SDF Network ; September 2015',
    );
  });

  it('selects mainnet case-insensitively and with surrounding whitespace', () => {
    expect(resolveStellarNetwork('MAINNET').horizonUrl).toBe(
      'https://horizon.stellar.org',
    );
    expect(resolveStellarNetwork('  mainnet  ').network).toBe('mainnet');
  });

  it('uses the mainnet passphrase for mainnet', () => {
    expect(resolveStellarNetwork('mainnet').passphrase).toBe(
      'Public Global Stellar Network ; September 2015',
    );
  });

  it('rejects unsupported networks', () => {
    expect(() => resolveStellarNetwork('local')).toThrow(
      /Unsupported STELLAR_NETWORK/,
    );
  });
});
