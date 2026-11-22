import { defineConfig } from "vite";

// Tauri на Android подключается к dev-серверу по сети,
// поэтому нужно слушать все интерфейсы (host: true)
// и жёстко фиксировать порт 1420 (strictPort).
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: true,
    hmr: {
      protocol: "ws",
      // С телефона "localhost" — это сам телефон, поэтому хостом HMR
      // должен быть адрес компьютера (TAURI_DEV_HOST задаёт tauri CLI).
      host: process.env.TAURI_DEV_HOST,
    },
  },
});
