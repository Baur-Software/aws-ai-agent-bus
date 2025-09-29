// Logo utility functions for MCP server branding
// Uses multiple online logo repositories for professional branding

export interface LogoInfo {
  logoUrl: string | null;
  fallbackLetter: string;
  bgColor: string;
  brandName?: string;
}

// Brand mappings for Simple Icons (https://simpleicons.org/)
const SIMPLE_ICONS_MAPPINGS: Record<string, string> = {
  'github': 'github',
  'slack': 'slack',
  'stripe': 'stripe',
  'aws': 'amazonaws',
  'amazon': 'amazonaws',
  'google': 'google',
  'azure': 'microsoftazure',
  'microsoft': 'microsoft',
  'docker': 'docker',
  'kubernetes': 'kubernetes',
  'k8s': 'kubernetes',
  'atlassian': 'atlassian',
  'jira': 'atlassian',
  'confluence': 'atlassian',
  'couchbase': 'couchbase',
  'elasticsearch': 'elasticsearch',
  'heroku': 'heroku',
  'mongodb': 'mongodb',
  'grafana': 'grafana',
  'neon': 'neon',
  'terraform': 'terraform',
  'cloudflare': 'cloudflare',
  'vercel': 'vercel',
  'netlify': 'netlify',
  'salesforce': 'salesforce',
  'hubspot': 'hubspot',
  'notion': 'notion',
  'discord': 'discord',
  'telegram': 'telegram',
  'twitter': 'twitter',
  'x': 'x',
  'linkedin': 'linkedin',
  'youtube': 'youtube',
  'twilio': 'twilio',
  'sendgrid': 'sendgrid',
  'redis': 'redis',
  'postgresql': 'postgresql',
  'postgres': 'postgresql',
  'mysql': 'mysql',
  'sqlite': 'sqlite',
  'firebase': 'firebase',
  'supabase': 'supabase',
  'openai': 'openai',
  'anthropic': 'anthropic',
  'claude': 'anthropic',
  'chatgpt': 'openai',
  'linear': 'linear',
  'figma': 'figma',
  'sketch': 'sketch',
  'adobe': 'adobe',
  'photoshop': 'adobe',
  'illustrator': 'adobe',
  'shopify': 'shopify',
  'woocommerce': 'woocommerce',
  'wordpress': 'wordpress',
  'webflow': 'webflow',
  'airtable': 'airtable',
  'zapier': 'zapier',
  'mailchimp': 'mailchimp',
  'zendesk': 'zendesk',
  'intercom': 'intercom',
  'mixpanel': 'mixpanel',
  'segment': 'segment',
  'amplitude': 'amplitude',
  'datadog': 'datadog',
  'sentry': 'sentry',
  'rollbar': 'rollbar',
  'bugsnag': 'bugsnag',
  'pagerduty': 'pagerduty',
  'newrelic': 'newrelic',
  'splunk': 'splunk',
  'elastic': 'elasticsearch',
  'kibana': 'kibana',
  'logstash': 'logstash',
  'jenkins': 'jenkins',
  'circleci': 'circleci',
  'travis': 'travisci',
  'gitlab': 'gitlab',
  'bitbucket': 'bitbucket',
  'sourcetree': 'sourcetree',
  'git': 'git',
  'npm': 'npm',
  'yarn': 'yarn',
  'pnpm': 'pnpm',
  'bun': 'bun',
  'deno': 'deno',
  'node': 'nodedotjs',
  'nodejs': 'nodedotjs',
  'react': 'react',
  'vue': 'vuedotjs',
  'angular': 'angular',
  'svelte': 'svelte',
  'solid': 'solid',
  'nextjs': 'nextdotjs',
  'nuxt': 'nuxtdotjs',
  'gatsby': 'gatsby',
  'vite': 'vite',
  'webpack': 'webpack',
  'rollup': 'rollupdotjs',
  'parcel': 'parcel',
  'babel': 'babel',
  'typescript': 'typescript',
  'javascript': 'javascript',
  'python': 'python',
  'java': 'openjdk',
  'kotlin': 'kotlin',
  'swift': 'swift',
  'rust': 'rust',
  'go': 'go',
  'golang': 'go',
  'php': 'php',
  'ruby': 'ruby',
  'rails': 'rubyonrails',
  'django': 'django',
  'flask': 'flask',
  'laravel': 'laravel',
  'symfony': 'symfony',
  'spring': 'spring',
  'fastapi': 'fastapi',
  'express': 'express',
  'nestjs': 'nestjs',
  'prisma': 'prisma',
  'sequelize': 'sequelize',
  'typeorm': 'typeorm',
  'mongoose': 'mongoose'
};

/**
 * Get brand logo information for a service name
 * @param serviceName - The name of the service/server
 * @returns LogoInfo object with logo URL, fallback, and styling
 */
export function getServiceLogo(serviceName: string): LogoInfo {
  const name = serviceName.toLowerCase();

  // Find matching brand key
  let brandKey: string | null = null;
  let matchedKeyword: string | null = null;

  for (const [keyword, brand] of Object.entries(SIMPLE_ICONS_MAPPINGS)) {
    if (name.includes(keyword)) {
      brandKey = brand;
      matchedKeyword = keyword;
      break;
    }
  }

  // Generate logo URL from Simple Icons CDN
  const logoUrl = brandKey ? `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${brandKey}.svg` : null;

  return {
    logoUrl,
    fallbackLetter: serviceName.charAt(0).toUpperCase(),
    bgColor: logoUrl ? 'bg-white' : 'bg-gradient-to-br from-blue-500 to-purple-600',
    brandName: matchedKeyword ? SIMPLE_ICONS_MAPPINGS[matchedKeyword] : undefined
  };
}

/**
 * Get logo URL with fallback sources
 * @param serviceName - The name of the service/server
 * @param domain - Optional domain for domain-based logo services
 * @returns Array of logo URLs to try in order
 */
export function getLogoUrls(serviceName: string, domain?: string): string[] {
  const urls: string[] = [];

  // Primary: Simple Icons
  const simpleIconsLogo = getServiceLogo(serviceName);
  if (simpleIconsLogo.logoUrl) {
    urls.push(simpleIconsLogo.logoUrl);
  }

  // Secondary: Clearbit (if domain available)
  if (domain) {
    urls.push(`https://logo.clearbit.com/${domain}`);
  }

  // Tertiary: Logo.dev (requires API key - placeholder for future)
  // if (domain && process.env.LOGO_DEV_TOKEN) {
  //   urls.push(`https://img.logo.dev/${domain}?token=${process.env.LOGO_DEV_TOKEN}`);
  // }

  return urls;
}

/**
 * Create a logo component with automatic fallback handling
 * @param serviceName - The name of the service
 * @param domain - Optional domain for additional logo sources
 * @param className - CSS classes for the logo
 * @returns Object with logo props and fallback info
 */
export function createLogoProps(serviceName: string, domain?: string, className = "w-8 h-8 object-contain") {
  const logoInfo = getServiceLogo(serviceName);
  const urls = getLogoUrls(serviceName, domain);

  return {
    logoInfo,
    urls,
    primaryUrl: urls[0] || null,
    className,
    alt: `${serviceName} logo`,
    fallbackElement: {
      letter: logoInfo.fallbackLetter,
      bgColor: 'bg-gradient-to-br from-blue-500 to-purple-600',
      textClass: 'text-white font-bold text-lg'
    }
  };
}