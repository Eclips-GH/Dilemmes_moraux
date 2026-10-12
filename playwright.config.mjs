import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

// Utilise Edge déjà installé sur Windows ; aucun profil personnel n'est ouvert.
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:18080",
    headless: true,
    acceptDownloads: true,
    trace: "retain-on-failure",
    launchOptions: existsSync(edge) ? { executablePath: edge } : {},
  },
  webServer: {
    command: "node server.js",
    url: "http://127.0.0.1:18080/test",
    reuseExistingServer: false,
    env: { NODE_ENV: "test", HOST: "127.0.0.1", PORT: "18080", TRUST_PROXY: "false" },
  },
});
