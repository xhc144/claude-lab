// Local, header-based smart categories (主要 / 通知 / 推广 / 社交). Nothing leaves the computer.
import type { Category } from '../../shared/types';

export interface ClassifyInput {
  fromAddr: string;
  fromName: string;
  subject: string;
  headers: Record<string, string>;
}

const SOCIAL_DOMAINS = [
  'facebookmail.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com', 'pinterest.com',
  'reddit.com', 'redditmail.com', 'tiktok.com', 'youtube.com', 'discord.com', 'quora.com', 'tumblr.com',
  'weibo.com', 'weibo.cn', 'douban.com', 'zhihu.com', 'xiaohongshu.com', 'bilibili.com', 'meetup.com', 'mastodon.social',
  'snapchat.com', 'telegram.org', 'line.me', 'kakao.com', 'vk.com', 'nextdoor.com', 'strava.com', 'goodreads.com'
];

const NOTIFY_DOMAINS = [
  'github.com', 'gitlab.com', 'bitbucket.org', 'atlassian.net', 'atlassian.com', 'slack.com', 'notion.so', 'figma.com',
  'google.com', 'accounts.google.com', 'apple.com', 'id.apple.com', 'microsoft.com', 'microsoftonline.com', 'paypal.com',
  'alipay.com', 'service.alipay.com', 'tenpay.com', 'wechat.com', 'amazon.com', 'amazonses.com',
  'stripe.com', 'vercel.com', 'netlify.com', 'cloudflare.com', 'aws.amazon.com', 'digitalocean.com', 'heroku.com',
  'zoom.us', 'calendly.com', 'docusign.net', 'dropbox.com', 'jd.com', 'taobao.com', '12306.cn', 'ctrip.com',
  'uber.com', 'airbnb.com', 'booking.com', 'trip.com', 'didiglobal.com', 'sf-express.com', 'dhl.com', 'fedex.com', 'ups.com'
];

const SOCIAL_LOCAL = /^(notification|notifications|notify|friend|friends|messages?|invitations?|connections?)[-_.]?/i;
const NOREPLY = /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|noreply|donotreply|mailer[-_.]?daemon|postmaster|bounce)/i;
const NOTIFY_LOCAL = /^(alert|alerts|notification|notifications|notify|security|account|accounts|support|service|billing|invoice|receipt|receipts|orders?|shipping|delivery|auto[-_.]?confirm|confirm|verify|verification|system|admin|info@?$|calendar|reminder|status|ci|builds?|jira|team)/i;
const PROMO_LOCAL = /^(news|newsletter|newsletters|marketing|promo|promotions?|offers?|deals?|sales?|hello|hi|team|digest|weekly|updates?|edm|events?|campaign|shop|store|club|vip)/i;

const PROMO_SUBJECT = /(\d+\s*%\s*(off|折)|折扣|优惠|促销|特惠|特价|限时|秒杀|大促|满减|领券|优惠券|红包|会员日|新品|上新|直播|抽奖|免费领|立减|低至|\bsale\b|\bdeal(s)?\b|\boffer\b|discount|coupon|% off|free shipping|black friday|cyber monday|limited time|exclusive|new arrivals|webinar|newsletter|digest|this week)/i;
const NOTIFY_SUBJECT = /(验证码|校验码|动态码|登录提醒|安全提醒|登录通知|账单|发票|订单|已发货|物流|快递|支付|付款|收款|退款|到账|提醒|通知|预约|确认|密码重置|重置密码|verification code|verify your|security alert|sign[- ]in|login attempt|password reset|reset your password|receipt|invoice|your order|order confirmation|has shipped|delivery|payment|statement|reminder|notification|alert|confirm your|two-factor|2fa|one-time|otp|\[github\]|pull request|merge request|build (failed|passed)|pipeline|deployment)/i;

const domainOf = (addr: string) => addr.split('@')[1]?.toLowerCase() || '';
const localOf = (addr: string) => addr.split('@')[0]?.toLowerCase() || '';
const matchesDomain = (domain: string, list: string[]) => list.some((d) => domain === d || domain.endsWith('.' + d));

export function classify(input: ClassifyInput): Category {
  const { fromAddr, subject, headers } = input;
  const domain = domainOf(fromAddr);
  const local = localOf(fromAddr);
  const h = (k: string) => headers[k] || '';

  const isList = !!(h('list-unsubscribe') || h('list-id') || h('list-unsubscribe-post'));
  const precedence = h('precedence').toLowerCase();
  const bulk = precedence === 'bulk' || precedence === 'list' || precedence === 'junk' || !!h('x-campaign') || !!h('x-campaignid') ||
    /campaign|mailchimp|sendgrid|mailgun|sendcloud|edm|marketo|hubspot|braze|klaviyo|constantcontact|sailthru|exacttarget/i.test(h('x-mailer') + ' ' + h('feedback-id') + ' ' + h('x-sg-eid') + ' ' + h('x-mc-user'));
  const auto = /auto-(generated|replied|notified)/i.test(h('auto-submitted')) || !!h('x-autoreply') || !!h('x-auto-response-suppress');

  if (matchesDomain(domain, SOCIAL_DOMAINS) || (SOCIAL_LOCAL.test(local) && /social|friend|follow|关注|好友|评论|点赞|赞了|回复了你|mentioned you|commented|liked|followed/i.test(subject))) {
    return 'social';
  }

  let promo = 0;
  let notify = 0;
  if (isList) promo += 2;
  if (bulk) promo += 2;
  if (PROMO_LOCAL.test(local)) promo += 1;
  if (PROMO_SUBJECT.test(subject)) promo += 2;
  if (NOTIFY_SUBJECT.test(subject)) notify += 3;
  if (NOTIFY_LOCAL.test(local)) notify += 1;
  if (NOREPLY.test(local)) notify += 2;
  if (auto) notify += 2;
  if (matchesDomain(domain, NOTIFY_DOMAINS)) notify += 2;
  // GitHub & similar developer tools send list mail that is still a notification.
  if (/github\.com|gitlab|atlassian|jira/i.test(h('list-id') + domain)) notify += 3;

  if (promo >= 3 && promo > notify) return 'promotions';
  if (notify >= 3) return 'notifications';
  if (promo >= 3) return 'promotions';
  if (isList && notify >= 2) return 'notifications';
  return 'primary';
}
