import React from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/list.css';
import './styles/reader.css';
import './styles/composer.css';
import './styles/overlays.css';
import './styles/onboarding.css';
import './styles/settings.css';
import { App } from './App';

document.documentElement.dataset.platform = window.hy?.platform || 'win32';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </React.StrictMode>
);
