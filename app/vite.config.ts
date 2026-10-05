import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  appType: 'mpa', // a missing public/dive.json is a 404, not index.html
  plugins: [react(), tailwindcss(), viteSingleFile()],
})
