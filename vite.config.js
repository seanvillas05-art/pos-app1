import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT: use your repo name here
export default defineConfig({
  plugins: [react()],
  base: '/pos-app1/', // <-- because your repo is pos-app1
})
