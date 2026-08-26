import './ui/styles.css';
import { Game } from './Game';
import { registerProductionAssets } from './assets/registerProductionAssets';

const root = document.getElementById('app');
if (!root) throw new Error('#app root element not found');

registerProductionAssets().finally(() => {
  new Game(root);
});
