import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    env: { CREDENTIAL_ENCRYPTION_KEY: "7f2db39d1244ac6052c3e271b53fefa61fe3c878ef8f94d16ed6ab0a23fe4660" },
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
})
