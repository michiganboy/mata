import { execSync } from 'child_process';

const args = process.argv.slice(2);
const envVars: Record<string, string> = {};
const bypassLoginSites: string[] = [];

let hasSite = false;
let hasPath = false;

args.forEach(arg => {
  if (arg.startsWith('--bypass-login')) {
    const [, value] = arg.split('=');
    if (value && value !== 'true') {
      bypassLoginSites.push(value);
    } else {
      envVars['BYPASS_LOGIN_ALL'] = 'true';
    }
  } else if (arg.startsWith('--')) {
    const [key, value] = arg.replace('--', '').split('=');
    if (key && value !== undefined) {
      if (key === 'path') {
        envVars['SINGLE_PAGE_PATH'] = value;
        hasPath = true;
      } else if (key === 'site') {
        envVars['SITE'] = value;
        hasSite = true;
      } else {
        envVars[key.toUpperCase()] = value;
      }
    }
  }
});

if (hasPath && !hasSite) {
  console.error('Error: The --path argument can only be used when a --site is specified.');
  process.exit(1);
}

if (bypassLoginSites.length > 0) {
  envVars['BYPASS_LOGIN_SITES'] = bypassLoginSites.join(',');
}

console.log('Parsed environment variables:', envVars);

const command = `cross-env ${Object.entries(envVars).map(([k, v]) => `${k}=${v}`).join(' ')} npx playwright test`;

console.log('Executing command:', command);

try {
  execSync(command, { stdio: 'inherit' });
} catch (error) {
  process.exit(1);
}