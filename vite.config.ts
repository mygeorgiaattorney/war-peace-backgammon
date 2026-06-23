import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves this app from:
// https://mygeorgiaattorney.github.io/war-peace-backgammon/
export default defineConfig({
  base: "/war-peace-backgammon/",
  plugins: [react()],
});
