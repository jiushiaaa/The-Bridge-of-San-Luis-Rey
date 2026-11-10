import { createRoot } from 'react-dom/client';
import StyleLabPage from './StyleLabPage';
import { startTabPill } from './tab-pill';
import './fonts.css';
import './style-lab.css';
import './variants/v5-eink-editorial.css';
import './variants/v6-eink-editorial.css';
import './intro/intro-lab.css';

createRoot(document.getElementById('style-lab-root')!).render(<StyleLabPage />);
startTabPill();
