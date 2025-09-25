import { MARKETPLACE_CONFIGS } from '../data/appConfigsMarketplace';
import type { AppConfig } from '../contexts/KVStoreContext';

export interface MarketplaceSeederResult {
  success: boolean;
  seeded: number;
  skipped: number;
  errors: string[];
}

/**
 * Seed KV store with marketplace app configs
 * Compact implementation following token-economy principles
 */
export async function seedMarketplace(
  kvStore: any,
  options: {
    force?: boolean; // Overwrite existing
    dryRun?: boolean; // Just check what would be done
  } = {}
): Promise<MarketplaceSeederResult> {
  const result: MarketplaceSeederResult = {
    success: true,
    seeded: 0,
    skipped: 0,
    errors: []
  };

  console.log(`🌱 Seeding marketplace: ${MARKETPLACE_CONFIGS.length} configs, force=${options.force}, dryRun=${options.dryRun}`);

  for (const config of MARKETPLACE_CONFIGS) {
    try {
      const key = `app-config-${config.id}`;
      const exists = await kvStore.exists(key);

      if (exists && !options.force) {
        result.skipped++;
        continue;
      }

      if (options.dryRun) {
        console.log(`Would ${exists ? 'update' : 'create'}: ${config.name}`);
        result.seeded++;
        continue;
      }

      // Set config with timestamp
      const configWithMeta: AppConfig = {
        ...config,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const success = await kvStore.setAppConfig(configWithMeta);
      if (success) {
        result.seeded++;
        console.log(`✅ ${config.name} (${config.category})`);
      } else {
        result.errors.push(`Failed to save ${config.name}`);
      }
    } catch (err: any) {
      result.errors.push(`${config.name}: ${err.message}`);
      result.success = false;
    }
  }

  console.log(`📦 Marketplace seeded: ${result.seeded} created, ${result.skipped} skipped, ${result.errors.length} errors`);
  return result;
}

/**
 * Get marketplace config by ID for quick lookup
 */
export function getMarketplaceConfig(appId: string): AppConfig | undefined {
  return MARKETPLACE_CONFIGS.find(config => config.id === appId);
}

/**
 * Get marketplace configs by category
 */
export function getMarketplaceConfigsByCategory(category: string): AppConfig[] {
  return MARKETPLACE_CONFIGS.filter(config =>
    config.category.toLowerCase() === category.toLowerCase()
  );
}

/**
 * Get all marketplace categories
 */
export function getMarketplaceCategories(): string[] {
  const categories = new Set(MARKETPLACE_CONFIGS.map(config => config.category));
  return Array.from(categories).sort();
}