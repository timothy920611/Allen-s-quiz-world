import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({root:'app',base:'./',build:{outDir:'../dist',emptyOutDir:true,rollupOptions:{input:{index:resolve('app/index.html'),admin:resolve('app/admin.html'),review:resolve('app/see_quiz.html')}}}});
