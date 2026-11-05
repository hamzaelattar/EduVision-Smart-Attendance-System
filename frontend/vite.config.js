
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";

const keyPath = fs.existsSync("./dev-lan-key.pem") ? "./dev-lan-key.pem" : "./dev-key.pem";
const certPath = fs.existsSync("./dev-lan-cert.pem") ? "./dev-lan-cert.pem" : "./dev-cert.pem";
const https = fs.existsSync(keyPath) && fs.existsSync(certPath)
  ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
  : undefined;

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    host: https ? "0.0.0.0" : "127.0.0.1",
    port: 5173,

    // HTTPS for smartphone camera access
    https,

    // Communication with FastAPI
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },

      "/ws": {
        target: "ws://127.0.0.1:8000",
        ws: true,
      },
    },
  },
});
