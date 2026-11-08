import typegpu from 'unplugin-typegpu/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // The plugin compiles 'use gpu' functions, so shader modules can be resolved to WGSL in tests.
  plugins: [typegpu()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
