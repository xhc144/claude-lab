// Realistic sample mail for end-to-end tests and screenshots.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const MailComposer = require('nodemailer/lib/mail-composer');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const H = 3600_000;
const D = 24 * H;

function build(opts) {
  return new Promise((resolve, reject) => {
    const node = new MailComposer(opts).compile();
    node.keepBcc = true;
    node.build((err, buf) => (err ? reject(err) : resolve(buf)));
  });
}

const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');

export async function seed(srv, now = Date.now()) {
  const png = fs.readFileSync(path.join(root, 'build/icon.png'));
  const msgs = [];
  const add = (user, mailbox, o) => msgs.push({ user, mailbox, o });
  const A = 'alice@hy.test';

  add(A, 'INBOX', {
    from: '张伟 <zhangwei@hy.test>', to: 'Alice 林 <alice@hy.test>', cc: '李娜 <lina@hy.test>',
    subject: 'Q4 产品路线图评审（周四 14:00）', date: new Date(now - 0.6 * H), messageId: '<roadmap-q4@hy.test>',
    html: `<div style="font-family:sans-serif"><p>Alice，你好：</p><p>周四下午两点在 3 号会议室评审 Q4 路线图，议程如下：</p>
      <table style="border-collapse:collapse;margin:12px 0"><tr style="background:#f4efe7"><th style="padding:6px 12px;text-align:left">时间</th><th style="padding:6px 12px;text-align:left">议题</th><th style="padding:6px 12px;text-align:left">负责人</th></tr>
      <tr><td style="padding:6px 12px">14:00</td><td style="padding:6px 12px">统一收件箱与智能分类</td><td style="padding:6px 12px">张伟</td></tr>
      <tr><td style="padding:6px 12px">14:30</td><td style="padding:6px 12px">同步引擎性能（10 万封邮件冷启动）</td><td style="padding:6px 12px">李娜</td></tr>
      <tr><td style="padding:6px 12px">15:10</td><td style="padding:6px 12px">Windows 安装包与自动更新</td><td style="padding:6px 12px">Alice</td></tr></table>
      <p>路线图草案见附件，有问题可以先在文档里评论。</p><p>谢谢！<br>张伟</p></div>`,
    attachments: [{ filename: 'Q4 路线图草案.pdf', content: pdf, contentType: 'application/pdf' }, { filename: '时间线.xlsx', content: Buffer.from('PK fake xlsx'), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }]
  });
  add(A, 'INBOX', {
    from: 'GitHub <notifications@github.com>', to: A, subject: '[hongyan/mail] 支持 IMAP IDLE 实时推送 (PR #128)',
    date: new Date(now - 1.4 * H), headers: { 'List-Id': 'hongyan/mail <mail.hongyan.github.com>', 'List-Unsubscribe': '<https://github.com/notifications/unsubscribe/abc>' },
    html: '<p><b>@lina</b> requested your review on this pull request.</p><blockquote>新增独立的 IDLE 连接用于收件箱推送；断线后指数退避重连。</blockquote><p><a href="https://github.com/hongyan/mail/pull/128">View it on GitHub</a></p>'
  });
  add(A, 'INBOX', {
    from: '李娜 <lina@hy.test>', to: A, subject: 'Re: 周五团建地点投票', date: new Date(now - 2.2 * H),
    inReplyTo: '<teambuild-1@hy.test>', references: '<teambuild-1@hy.test>', messageId: '<teambuild-2@hy.test>',
    text: '我投香山！天气预报说周五晴，可以顺便看红叶 🍁\n\n另外我可以负责订车。\n\n> 大家好，周五团建有三个候选：香山、798、密云水库，请回复投票。\n> —— Alice'
  });
  add(A, 'Sent', {
    from: 'Alice 林 <alice@hy.test>', to: '产品组 <team@hy.test>', subject: '周五团建地点投票', date: new Date(now - 26 * H), messageId: '<teambuild-1@hy.test>',
    text: '大家好，周五团建有三个候选：香山、798、密云水库，请回复投票。\n—— Alice'
  });
  add(A, 'INBOX', {
    from: '京东 <newsletter@jd.example>', to: A, subject: '双十一预售开启｜爆款低至 5 折，限时领券', date: new Date(now - 3 * H),
    headers: { 'List-Unsubscribe': '<https://jd.example/unsub?u=alice>, <mailto:unsub@jd.example?subject=unsubscribe>', Precedence: 'bulk' },
    html: `<div style="background:#c81623;padding:28px;text-align:center;color:#fff;font-family:sans-serif"><h1 style="margin:0;font-size:30px">11.11 全球好物节</h1><p style="opacity:.9">预售开启 · 定金立减 · 跨店满减</p>
      <img src="https://img.jd.example/banner-1111.jpg" width="560" height="200" alt="活动主图" style="display:block;margin:12px auto;background:#fff3"><a href="https://jd.example/1111" style="display:inline-block;margin-top:10px;padding:10px 26px;background:#fff;color:#c81623;border-radius:20px;text-decoration:none;font-weight:bold">立即抢购</a></div>
      <img src="https://track.jd.example/open.gif?u=alice" width="1" height="1">`
  });
  add(A, 'INBOX', {
    from: '招商银行信用卡 <creditcard@cmbchina.example>', to: A, subject: '您的 10 月信用卡电子账单已出，请及时还款', date: new Date(now - 5 * H),
    headers: { 'Auto-Submitted': 'auto-generated' },
    html: '<p>尊敬的林女士：</p><p>您本期账单金额为 <b>¥ 3,286.40</b>，最后还款日为 2026 年 11 月 5 日。</p><p>本邮件由系统自动发送，请勿直接回复。</p>'
  });
  add(A, 'INBOX', {
    from: '王芳 <wangfang@hy.test>', to: A, subject: '合同扫描件和签字页', date: new Date(now - 7 * H), messageId: '<contract@hy.test>',
    html: '<p>Alice：</p><p>合同扫描件和签字页都在附件里了，签字页请打印后签名，周三前寄回即可。</p><p>王芳</p>',
    attachments: [{ filename: '签字页.png', content: png, contentType: 'image/png' }, { filename: '服务合同（扫描件）.pdf', content: pdf, contentType: 'application/pdf' }]
  });
  add(A, 'INBOX', {
    from: 'Trip.com <noreply@trip.example>', to: A, subject: '行程确认：CA1501 北京首都 → 上海虹桥 10月16日', date: new Date(now - 20 * H),
    html: '<h2 style="font-family:sans-serif">您的机票已出票</h2><p>航班 CA1501 · 10月16日 08:00 起飞 · 座位 32A</p><p>请提前 2 小时到达机场办理值机。</p>'
  });
  add(A, 'INBOX', {
    from: '陈晨 <chenchen@hy.test>', to: A, subject: '周末一起去爬山吗？', date: new Date(now - 27 * H),
    text: '这周末天气很好，要不要一起去爬山？\n路线我看好了，上午九点出发，下午三点前下山。\n你要是有空就回我一下～'
  });
  add(A, 'INBOX', {
    from: 'LinkedIn <messages-noreply@linkedin.com>', to: A, subject: '你本周出现在 12 次搜索中', date: new Date(now - 30 * H),
    headers: { 'List-Unsubscribe': '<https://linkedin.com/unsub>' }, html: '<p>看看是谁在关注你的资料。</p>'
  });
  add(A, 'INBOX', {
    from: 'The Weekly Brief <hello@weeklybrief.example>', to: A, subject: 'Design systems that scale — and the ones that don’t', date: new Date(now - 2.4 * D),
    headers: { 'List-Unsubscribe': '<https://weeklybrief.example/u/1>' },
    html: `<div style="max-width:600px;margin:0 auto;font-family:Georgia,serif;color:#222"><h1 style="font-size:28px">Design systems that scale</h1>
      <p style="font-size:17px;line-height:1.6">Every team eventually builds a component library. Few build a <em>system</em>. This week we look at three companies that got it right…</p>
      <img src="https://cdn.weeklybrief.example/hero.png" width="600" height="300" alt="hero"><p style="font-size:17px;line-height:1.6">Read the full story on our site.</p></div>`
  });
  add(A, 'INBOX', {
    from: '微博 <notice@weibo.com>', to: A, subject: '有 3 位朋友赞了你的微博', date: new Date(now - 3.2 * D), html: '<p>快去看看吧</p>'
  });
  add(A, 'INBOX', {
    from: '人力资源部 <hr@hy.test>', to: A, subject: '2026 年度员工体检安排', date: new Date(now - 5 * D),
    html: '<p>各位同事：</p><p>今年体检将于 11 月 3 日至 14 日进行，请在 OA 系统中预约时段。</p>'
  });
  add(A, 'INBOX', {
    from: 'Notion <notify@mail.notion.so>', to: A, subject: 'Lina commented on “Q4 Roadmap”', date: new Date(now - 6 * D), html: '<p>“同步引擎那部分需要补充压测数据”</p>'
  });
  add(A, 'INBOX', {
    from: '张伟 <zhangwei@hy.test>', to: A, subject: '上月 OKR 回顾', date: new Date(now - 18 * D), text: '附上回顾记录，下次例会过一遍。'
  });
  add(A, 'INBOX', {
    from: 'Apple <no_reply@email.apple.com>', to: A, subject: '你的收据：iCloud+ 50GB', date: new Date(now - 40 * D), html: '<p>感谢你的购买。</p>'
  });
  add(A, 'INBOX', {
    from: '李娜 <lina@hy.test>', to: A, subject: '年会节目征集', date: new Date(now - 75 * D), text: '大家有什么好点子吗？'
  });

  add('bob@hy.test', 'INBOX', { from: 'Carol <carol@hy.test>', to: 'bob@hy.test', subject: 'Lunch tomorrow?', date: new Date(now - 1 * H), text: 'There is a new noodle place near the office. 12:15?' });
  add('bob@hy.test', 'INBOX', { from: 'IT Support <it@hy.test>', to: 'bob@hy.test', subject: 'Welcome to the team, Bob!', date: new Date(now - 4 * D), text: 'Your laptop is ready for pickup.' });

  for (const m of msgs) {
    const raw = await build({ ...m.o, headers: { ...(m.o.headers || {}) } });
    srv.deliver(m.user, raw, m.mailbox);
  }
  // A few messages arrive already read
  return msgs.length;
}
