// Menu
const menuBtn = document.getElementById('menu-btn');
const menu = document.getElementById('menu');
menuBtn.addEventListener('click', () => {
  const open = menu.hidden;
  menu.hidden = !open;
  menuBtn.setAttribute('aria-expanded', open);
});

// Acessibilidade: tamanho da fonte e contraste
const root = document.documentElement;
let fontPct = 100;
const setFont = (v) => {
  fontPct = Math.min(130, Math.max(80, v));
  root.style.fontSize = fontPct + '%';
};
document.getElementById('font-plus').addEventListener('click', () => setFont(fontPct + 10));
document.getElementById('font-minus').addEventListener('click', () => setFont(fontPct - 10));
document.getElementById('contrast').addEventListener('click', () => {
  document.body.classList.toggle('alto-contraste');
});

// Carrossel automático
const carrossel = document.getElementById('carrossel');
if (carrossel) {
  const slides = [...carrossel.querySelectorAll('.slide')];
  const INTERVALO = 4000;
  const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let atual = 0;
  let timer = null;

  const irPara = (i) => {
    const s = slides[i];
    const esquerda = s.offsetLeft - carrossel.offsetLeft - (carrossel.clientWidth - s.clientWidth) / 2;
    carrossel.scrollTo({ left: esquerda, behavior: 'smooth' });
  };
  const proximo = () => irPara((atual + 1) % slides.length);

  const iniciar = () => {
    if (reduzirMovimento || slides.length < 2) return;
    parar();
    timer = setInterval(proximo, INTERVALO);
  };
  const parar = () => { clearInterval(timer); timer = null; };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) atual = slides.indexOf(e.target); });
  }, { root: carrossel, threshold: 0.6 });
  slides.forEach((s) => observer.observe(s));

  ['pointerdown', 'mouseenter', 'focusin'].forEach((ev) => carrossel.addEventListener(ev, parar));
  ['pointerup', 'pointercancel', 'touchend', 'mouseleave', 'focusout'].forEach((ev) => carrossel.addEventListener(ev, iniciar));

  document.addEventListener('visibilitychange', () => (document.hidden ? parar() : iniciar()));

  iniciar();
}

// FAQ
document.querySelectorAll('.faq-q').forEach((btn) => {
  btn.addEventListener('click', () => {
    const item = btn.parentElement;
    const open = item.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
  });
});