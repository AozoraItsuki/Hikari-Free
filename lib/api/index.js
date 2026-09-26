import path from 'path';
import { ApiLoader } from './api.js';
const loader = new ApiLoader({
  baseDir: path.resolve('./lib/api'),
  verbose: true,
  ignore: ['index.js', 'api.js'],
  ignorePattern: /(^|\/)\.|node_modules/,
  onReload: null,
  onRemove: null,
});
await loader.init();
const api = loader.api;
export default api;
