/**
 * Environment configuration with validation
 */

interface EnvConfig {
  appId: string;
  cookieSecret: string;
  databaseUrl: string;
  oAuthServerUrl: string;
  ownerId: string;
  isProduction: boolean;
  forgeApiUrl: string;
  forgeApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  elevenlabsApiKey: string;
  elevenlabsAgentId: string;
}

/**
 * Required environment variables for the application to run
 */
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'ELEVENLABS_API_KEY',
] as const;

/**
 * Optional environment variables with warnings if missing
 */
const OPTIONAL_ENV_VARS = [
  'VITE_APP_ID',
  'OAUTH_SERVER_URL',
  'OWNER_OPEN_ID',
  'BUILT_IN_FORGE_API_URL',
  'BUILT_IN_FORGE_API_KEY',
  'ELEVENLABS_AGENT_ID',
] as const;

/**
 * Validates environment variables and throws descriptive errors if required vars are missing
 */
function validateEnv(): void {
  const missingVars: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  // Check optional variables and warn
  for (const varName of OPTIONAL_ENV_VARS) {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  }

  // Fail fast if required variables are missing
  if (missingVars.length > 0) {
    console.error('\n❌ Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\nPlease set these variables in your .env file or environment.');
    console.error('See .env.example for reference.\n');
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Warn about optional variables
  if (warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn('\n⚠️  Optional environment variables not set:');
    warnings.forEach(varName => {
      console.warn(`   - ${varName}`);
    });
    console.warn('Some features may not work correctly.\n');
  }
}

// Validate environment variables on module load
validateEnv();

export const ENV: EnvConfig = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  elevenlabsApiKey: process.env.ELEVENLABS_API_KEY ?? "",
  elevenlabsAgentId: process.env.ELEVENLABS_AGENT_ID ?? "",
};
