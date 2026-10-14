// 薪火纪 EMBERSTACK — entry point.

import { App } from './app.js';

const app = new App(document.getElementById('app'));
window.__emberstack = app;
app.show('title');
