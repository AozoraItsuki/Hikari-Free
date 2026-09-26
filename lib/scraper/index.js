import path from 'path';
import { ScraperLoader } from './scraper.js';
const loader = new ScraperLoader({
  baseDir: path.resolve('./lib/scraper'),
  verbose: true,
  ignore: ['index.js', 'scraper.js'],
  ignorePattern: /(^|\/)\.|node_modules/,
  onReload: null,
  onRemove: null,
});
await loader.init();
const scrap = loader.scraper;
export default scrap;
