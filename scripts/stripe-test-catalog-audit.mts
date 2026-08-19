import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { reconcileStripeTestCatalog } from '@/lib/seveno-stripe-server';

const envNames = {
  campaign_credit_1_launch: 'STRIPE_PRICE_CAMPAIGN_CREDIT_1_TEST',
  campaign_credit_3_launch: 'STRIPE_PRICE_CAMPAIGN_CREDIT_3_TEST',
  campaign_credit_10_launch: 'STRIPE_PRICE_CAMPAIGN_CREDIT_10_TEST',
  campaign_extension_30d_launch: 'STRIPE_PRICE_CAMPAIGN_EXTENSION_30D_TEST',
  qualified_candidates_10_launch: 'STRIPE_PRICE_QUALIFIED_CANDIDATES_10_TEST',
} as const;
const envPath = resolve(process.cwd(), '.env.local');
const updateLocalPrice = async (replacement: { productCode: keyof typeof envNames; effectivePriceId: string }) => {
  let env = readFileSync(envPath, 'utf8');
  const name = envNames[replacement.productCode];
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  if (!pattern.test(env)) throw new Error(`La variable locale ${name} est absente.`);
  env = env.replace(pattern, `${name}=${replacement.effectivePriceId}`);
  writeFileSync(envPath, env, { encoding: 'utf8', mode: 0o600 });
};
const results = await reconcileStripeTestCatalog({ onPriceReplaced: updateLocalPrice });
const replacements = results.filter((result) => result.priceReplaced);
console.log({
  checkedProducts: results.length,
  replacedPrices: replacements.length,
  appliedTaxCodes: results.filter((result) => result.taxCodeApplied).length,
});
