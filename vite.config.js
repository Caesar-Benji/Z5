import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Base path matches the GitHub repo name so assets resolve correctly
// when served from https://<user>.github.io/Mission-Check-List/
export default defineConfig({
  plugins: [react()],
  base: "/Mission-Check-List/",
  server: { port: 5173 },
});
