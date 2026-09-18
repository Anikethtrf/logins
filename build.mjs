import {copyFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('.', import.meta.url)));
await mkdir('extension',{recursive:true});
for(const file of ['index.html','styles.css','app.js','api.js','crypto.js','config.js','logo.svg'])await copyFile(file,'extension/'+file);
console.log('Extension assets updated. Website is ready to serve from the project root.');
