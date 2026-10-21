import {cp,readdir,rm} from 'node:fs/promises';
// Commit build output at repository root to keep the existing GitHub Pages setup working.
await rm('assets',{recursive:true,force:true});
for (const name of await readdir('dist')) await cp(`dist/${name}`,name,{recursive:true});
