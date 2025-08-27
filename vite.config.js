import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/pos-app1/',   // <-- EXACTLY your repository name with slashes
})
