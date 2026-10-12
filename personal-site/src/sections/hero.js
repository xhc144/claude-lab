// Hero: title scramble, formula marquee, the 144 note.
import { scramble } from '../core/fx.js';
import { tex } from '../core/tex.js';
import { unlock } from '../ui/eggs.js';
import { bus } from '../core/bus.js';

const MARQUEE = [
  ['DIM 0', 'e^{i\\pi}+1=0'],
  ['DIM 1', '\\gamma:[0,1]\\to M'],
  ['DIM 2', '\\oint_{\\partial D}\\frac{f\'(z)}{f(z)}\\,dz=2\\pi i\\,(Z-P)'],
  ['DIM 3', '\\Delta_{3_1}(t)=t^2-t+1'],
  ['DIM 3+1', '\\nabla\\times\\mathbf B=\\mu_0\\mathbf J+\\mu_0\\varepsilon_0\\,\\partial_t\\mathbf E'],
  ['DIM 3+1', 'i\\hbar\\,\\partial_t\\psi=\\hat H\\psi'],
  ['DIM n', '\\mathrm{softmax}\\!\\left(QK^{\\mathsf T}/\\sqrt d\\right)V'],
  ['Σ', 'F_{12}=144=12^2'],
  ['DIM ∞', 'S^1\\hookrightarrow S^3\\to S^2'],
  ['ALGEBRA', '|G|=\\textstyle\\sum_\\rho(\\dim\\rho)^2'],
  ['TOPOLOGY', '\\chi=V-E+F'],
  ['PROBABILITY', '\\mathbb P(|\\bar X_n-\\mu|>\\varepsilon)\\to0'],
];

export function initHero() {
  const track = document.querySelector('.marquee-track');
  const items = MARQUEE.map(([k, f]) => `<span><em>${k}</em>${tex(f)}</span>`).join('');
  track.innerHTML = items + items;

  document.querySelector('.ht-note').addEventListener('click', () => {
    unlock('f144', { message: `${tex('144 = F_{12} = 12^2')}：斐波那契数列中除 0 和 1 之外唯一的完全平方数（J. H. E. Cohn, 1964）。背景向日葵里，144 的倍数号种子几乎排成一条射线。` });
    bus.emit('fx-144');
  });
}

export function playHeroIntro() {
  const hts = document.querySelectorAll('.hero-title [data-scramble]');
  hts.forEach((el, i) => scramble(el, el.textContent, { duration: 1300, delay: 150 + i * 220 }));
  for (const el of document.querySelectorAll('#hero .reveal')) el.classList.add('in');
}
