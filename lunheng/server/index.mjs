// Lunheng server entry point.
import { createApp } from './app.mjs';
import { log, setLogLevel } from './util/log.mjs';

const app = await createApp();
setLogLevel(app.config.logLevel);
const { host, port } = app.config;

app.server.listen(port, host, () => {
  const shown = host.includes(':') ? `[${host}]` : host;
  log.info(`论衡 Lunheng 研究实验室已启动：http://${shown}:${port}/`);
  log.info(`数据目录：${app.config.dataDir}`);
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    log.warn('服务监听在非本机地址：请在 HTTPS 反向代理之后部署，并设置 LUNHENG_SECURE_COOKIES=1。');
  }
  if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
    log.warn('检测到 HTTPS_PROXY，但 Node 默认不让 fetch 走代理；请通过 npm start 启动，或设置 NODE_USE_ENV_PROXY=1。');
  }
});

let closing = false;
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    if (closing) process.exit(1);
    closing = true;
    log.info('正在保存研究进度并关闭…');
    try { await app.close(); } catch (err) { log.error(err.message); }
    process.exit(0);
  });
}
