import { createRoot } from 'react-dom/client';
import GameStyleSwitcher from './GameStyleSwitcher';
import { startTabPill } from './tab-pill';
import './fonts.css';
import './game-variants.css';

document.documentElement.classList.add('gsl-dev');

const host = document.createElement('div');
host.id = 'style-lab-switcher';
document.body.prepend(host);

createRoot(host).render(<GameStyleSwitcher />);
startTabPill();
