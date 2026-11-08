// The static demo: the same analyzer as the local tool, run on made-up pages or pasted HTML.
import { analyze, ownerMessage } from './report.js';

export const SAMPLES = [
  {
    title: 'Старый сайт салона', url: 'http://salon-primer.example/', ms: 3400, bytes: 1_450_000,
    html: `<html><head><title>Главная</title></head><body><table><tr><td><font size=5>Салон красоты</font></td></tr></table>
<p>${'Мы предлагаем стрижки, окрашивание, маникюр и педикюр для всей семьи по доступным ценам. '.repeat(5)}</p>
<p>Запись по телефону: 8 (495) 000-00-00</p><img src="zal.jpg"><img src="master.jpg"></body></html>`,
  },
  {
    title: 'Сайт автосервиса', url: 'https://servis-primer.example/', ms: 900, bytes: 420_000,
    html: `<html><head><title>Автосервис в Видном: ремонт и шиномонтаж</title><meta name="viewport" content="width=device-width"></head>
<body><h1>Автосервис</h1><p>${'Ремонтируем автомобили любых марок, меняем масло и шины, проводим диагностику. '.repeat(5)}</p>
<a href="tel:+70000000000">+7 000 000-00-00</a><img src="box.jpg" alt="Бокс"><img src="team.jpg"></body></html>`,
  },
  {
    title: 'Хороший пример', url: 'https://kofe-primer.example/', ms: 320, bytes: 180_000,
    html: `<html><head><title>Кофейня в Видном: кофе и завтраки</title><meta name="viewport" content="width=device-width">
<meta name="description" content="Кофе и завтраки в Видном"><meta property="og:title" content="Кофейня"></head>
<body><h1>Кофейня</h1><p>${'Варим кофе из свежей обжарки и готовим завтраки весь день. '.repeat(6)}</p>
<a href="tel:+70000000000">+7 000 000-00-00</a><a href="https://t.me/example">Telegram</a><img src="zal.jpg" alt="Зал"></body></html>`,
  },
];

const PASTED = 'https://ваш-сайт.example/';

if (typeof document !== 'undefined') {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  const show = (report) => {
    $('#site').textContent = report.title ? `${report.url} · ${report.title}` : report.url;
    $('#facts').replaceChildren(...report.facts.map((f) => {
      const row = el('div', `fact ${f.ok ? 'good' : 'bad'}`);
      row.append(el('span', 'label', f.label), el('b', null, f.value), el('span', 'word', f.ok ? 'хорошо' : 'стоит исправить'));
      return row;
    }));
    $('#problems').replaceChildren(...report.problems.map((p) => {
      const li = el('li');
      li.append(el('h3', null, p.title), el('p', null, p.why), el('p', 'fix', `Что сделать: ${p.fix}`));
      return li;
    }));
    $('#clean').hidden = report.problems.length > 0;
    $('#partial').hidden = !report.partial;
    $('#message').value = ownerMessage(report);
    $('#result').hidden = false;
  };

  const choose = (i) => {
    for (const [n, b] of [...$('#samples').children].entries()) b.setAttribute('aria-pressed', String(n === i));
    const { html, url, ms, bytes } = SAMPLES[i];
    show(analyze({ url, status: 200, html, ms, bytes }));
  };

  $('#samples').replaceChildren(...SAMPLES.map((s, i) => {
    const b = el('button', 'chip', s.title);
    b.type = 'button';
    b.addEventListener('click', () => choose(i));
    return b;
  }));

  $('#form').addEventListener('submit', (e) => {
    e.preventDefault();
    const html = $('#html').value;
    if (!html.trim()) {
      $('#status').textContent = 'Вставьте исходный код страницы.';
      return;
    }
    $('#status').textContent = 'Скорость сервера по вставленному коду не измерить, поэтому она показана условно.';
    for (const b of $('#samples').children) b.setAttribute('aria-pressed', 'false');
    show(analyze({ url: PASTED, status: 200, html, ms: 0, bytes: new TextEncoder().encode(html).length }));
  });

  choose(0);
}
