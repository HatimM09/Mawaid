import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefreshPlugin from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const browserFiles = ['src/**/*.{js,jsx}', 'public/**/*.{js,jsx}']

export default defineConfig([
  globalIgnores([
    'dist',
    'android',
    'native/dist',
    'privacy-site',
    '.agents',
    'supabase/functions/**/*.ts',
    'capacitor.config.ts',
    '**/*.d.ts',
  ]),

  // ── Browser app code ──
  {
    files: browserFiles,
    extends: [js.configs.recommended, reactHooks.configs['recommended-latest']],
    plugins: { 'react-refresh': reactRefreshPlugin },
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: { ecmaVersion: 'latest', ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // ── Service worker (src/sw.js) — self + clients + fetch globals ──
  {
    files: ['src/sw.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.browser, ...globals.serviceworker },
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }] },
  },

  // ── Node-side code: cloud functions, WhatsApp bot, build scripts ──
  {
    files: ['functions/**/*.js', 'whatsapp-bot-service/**/*.js', 'scripts/**/*.{js,mjs}', 'api/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.node,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'react-hooks/rules-of-hooks': 'off',
    },
  },

  // ── Config / build files ──
  {
    files: ['*.config.{js,mjs,cjs}', 'vite.config.js', 'eslint.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.node,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }] },
  },
])
