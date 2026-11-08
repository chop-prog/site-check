import { ownerMessage } from './report.js';

const $ = (s) => document.querySelector(s);
const form = $('#form');
const status = $('#status');
const result = $('#result');

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function show(report) {
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
  $('#copied').textContent = '';
  result.hidden = false;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true;
  result.hidden = true;
  status.textContent = 'Открываю сайт…';
  try {
    const res = await fetch(`/api/check?url=${encodeURIComponent($('#url').value)}`);
    const body = await res.json();
    if (res.ok) {
      show(body);
      status.textContent = '';
    } else status.textContent = body.error;
  } catch {
    status.textContent = 'Проверка не запущена: запустите node server.mjs';
  } finally {
    button.disabled = false;
  }
});

$('#copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#message').value);
    $('#copied').textContent = 'Скопировано';
  } catch {
    $('#message').select();
    $('#copied').textContent = 'Нажмите Ctrl+C';
  }
});
