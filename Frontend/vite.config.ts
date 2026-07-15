/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Pin the API base URL so MSW handlers match regardless of local .env files.
    env: { VITE_API_URL: 'http://localhost:5000/api' },
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: [
        'src/test/**',
        'src/**/*.test.*',
        'src/main.tsx',
        // Dead code slated for removal (see AGENTS.md Testing Rules / cleanup phase):
        'src/modules/payments/components/AgreementForm.tsx',
        'src/**/registrars.store.ts',
        'src/**/*.mock.ts',
        'src/modules/auth/pages/VerifyCNIC.tsx',
      ],
    },
  },
})
