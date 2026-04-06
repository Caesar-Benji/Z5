import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Base path matches the GitHub repo name. New repo is "Z5".
export default defineConfig({
  plugins: [react()],
  base: "/Z5/",
  server: { port: 5173 },
});
