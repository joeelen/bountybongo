/**
 * tests/helpers/token_validator.js
 * Cyberpunk visual styling token verifier.
 * Checks tailwind.config.js for canonical color palettes, glow shadows, and font families.
 */
import fs from 'node:fs';
import path from 'node:path';

export const EXPECTED_CYBERPUNK_TOKENS = {
  colors: {
    'cyber-bg': '#0d0e12',
    'cyber-cyan': '#00f0ff',
    'cyber-red': '#ff0055',
    'cyber-orange': '#ff5e00',
    'cyber-yellow': '#ffaa00',
    'cyber-green': '#39ff14',
    'cyber-text': '#e2e8f0',
    'cyber-muted': '#94a3b8'
  },
  glows: [
    'cyan-glow',
    'red-glow',
    'yellow-glow',
    'orange-glow',
    'green-glow'
  ],
  fonts: [
    'orbitron',
    'rajdhani',
    'inter'
  ]
};

/**
 * Loads and inspects tailwind.config.js in the project root.
 */
export async function loadTailwindConfig(projectRoot = process.cwd()) {
  const configPath = path.join(projectRoot, 'tailwind.config.js');
  if (!fs.existsSync(configPath)) {
    throw new Error(`tailwind.config.js not found at ${configPath}`);
  }

  // Read config text content
  const configContent = fs.readFileSync(configPath, 'utf8');

  // Dynamically import tailwind config
  const moduleUrl = 'file:///' + configPath.replace(/\\/g, '/');
  const tailwindModule = await import(moduleUrl);
  const config = tailwindModule.default || tailwindModule;

  return {
    rawText: configContent,
    config,
    themeColors: config?.theme?.extend?.colors?.cyber || {},
    themeFonts: config?.theme?.extend?.fontFamily || {},
    themeShadows: config?.theme?.extend?.boxShadow || {}
  };
}
