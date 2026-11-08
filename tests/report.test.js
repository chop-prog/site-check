import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, normalizeUrl, ownerMessage } from '../src/report.js';

const GOOD = `<html><head><title>Барбершоп в Видном: стрижка и борода</title>
<meta name="viewport" content="width=device-width"><meta content="Стрижки в Видном" name="description">
<meta property="og:title" content="Барбершоп"></head>
<body><h1>Барбершоп</h1><p>${'Мы делаем стрижки и бороды уже много лет. '.repeat(10)}</p>
<a href="tel:+79001234567">Позвонить</a><a href="https://t.me/shop">Telegram</a><img src="a.jpg" alt="Зал"></body></html>`;
const page = (html, over = {}) => ({ url: 'https://example.ru/', status: 200, html, ms: 300, bytes: 2048, ...over });
const ids = (r) => r.problems.map((p) => p.id);

test('addresses: adds https, refuses what is not a public site', () => {
  assert.equal(normalizeUrl(' example.ru '), 'https://example.ru/');
  for (const bad of ['', 'not a site', 'localhost', 'ftp://example.ru', 'javascript:alert(1)', 'http://127.0.0.1/', '192.168.0.1']) {
    assert.equal(normalizeUrl(bad), null, bad);
  }
});

test('a good page has no problems', () => {
  assert.deepEqual(ids(analyze(page(GOOD))), []);
});

test('a phone link is demanded only when the page shows a phone number', () => {
  const noNumber = GOOD.replace('<a href="tel:+79001234567">Позвонить</a>', '');
  assert.ok(!ids(analyze(page(noNumber))).includes('noPhoneLink'));
  const plain = GOOD.replace('<a href="tel:+79001234567">Позвонить</a>', '<p>Звоните: 8 (495) 123-45-67</p>');
  assert.ok(ids(analyze(page(plain))).includes('noPhoneLink'));
});

test('an empty alt is a decorative image, not a mistake', () => {
  const html = GOOD.replace('alt="Зал"', 'alt=""');
  assert.ok(!ids(analyze(page(html))).includes('imagesNoAlt'));
});

test('a bare page lists its problems, the worst first', () => {
  const r = analyze(page(`<html><body>${'текст '.repeat(60)} +7 900 123-45-67<img src="a.jpg"></body></html>`));
  assert.equal(ids(r)[0], 'noViewport');
  for (const id of ['noTitle', 'noDescription', 'noH1', 'noPhoneLink', 'noMessenger', 'imagesNoAlt', 'noPreview']) assert.ok(ids(r).includes(id), id);
  const weights = r.problems.map((p) => p.weight);
  assert.deepEqual(weights, [...weights].sort((a, b) => b - a));
});

test('attributes are read in any order and with any quotes', () => {
  const html = GOOD.replace('name="viewport" content="width=device-width"', "content='width=device-width' name=viewport");
  assert.ok(!ids(analyze(page(html))).includes('noViewport'));
});

test('commented-out tags do not count', () => {
  const html = GOOD.replace('<h1>Барбершоп</h1>', '<!-- <h1>Старый</h1> -->');
  assert.ok(ids(analyze(page(html))).includes('noH1'));
});

test('noindex, http and server errors are reported', () => {
  const noindex = GOOD.replace('</head>', '<meta name="robots" content="noindex, nofollow"></head>');
  assert.ok(ids(analyze(page(noindex))).includes('noindex'));
  assert.ok(ids(analyze(page(GOOD, { url: 'http://example.ru/' }))).includes('noHttps'));
  assert.equal(ids(analyze(page(GOOD, { status: 503 })))[0], 'error');
});

test('a short title is reported', () => {
  assert.ok(ids(analyze(page(GOOD.replace('Барбершоп в Видном: стрижка и борода', 'Главная')))).includes('shortTitle'));
});

test('slowness is reported with the real number, and very slow goes high', () => {
  assert.ok(!ids(analyze(page(GOOD, { ms: 1500 }))).includes('slow'));
  const r = analyze(page(GOOD, { ms: 4200 }));
  assert.equal(ids(r)[0], 'slow');
  assert.match(r.problems[0].title, /4,2 с/);
});

test('a page built by scripts is marked partial and is not accused of missing content', () => {
  const r = analyze(page('<html><head><title>Приложение для записи клиентов</title></head><body><div id="root"></div><script src="a.js"></script></body></html>'));
  assert.equal(r.partial, true);
  for (const id of ['noH1', 'noPhoneLink', 'noMessenger', 'imagesNoAlt']) assert.ok(!ids(r).includes(id), id);
});

test('facts show the measurements', () => {
  const { facts } = analyze(page(GOOD, { bytes: 2_097_152 }));
  assert.equal(facts.find((f) => f.label === 'Вес страницы').value, '2048 КБ');
  assert.equal(facts.find((f) => f.label === 'Вес страницы').ok, false);
  assert.equal(facts.find((f) => f.label === 'Картинки без описания').value, '0 из 1');
});

test('the owner message names the site, the top three and how the work is done', () => {
  const text = ownerMessage(analyze(page('<html><body>' + 'текст '.repeat(60) + '</body></html>')));
  assert.match(text, /example\.ru/);
  assert.match(text, /Claude Code/);
  assert.ok(text.includes('3. ') && !text.includes('4. '));
});

test('the owner message stays honest when nothing is wrong', () => {
  assert.match(ownerMessage(analyze(page(GOOD))), /не нашла/);
});
