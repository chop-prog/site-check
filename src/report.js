// Checks one page's HTML and explains the problems to a business owner. Pure: server.mjs does the fetching.

const SLOW_MS = 1500;
const VERY_SLOW_MS = 3000;
const HEAVY_BYTES = 1_000_000;

const PROBLEMS = {
  error: { weight: 120, title: 'Сайт отвечает ошибкой', why: 'Посетители и поисковики видят страницу ошибки вместо сайта.', fix: 'Исправить работу сервера.' },
  noHttps: { weight: 100, title: 'Сайт открывается без защищённого соединения', why: 'Браузер показывает посетителю, что сайт небезопасен.', fix: 'Подключить HTTPS и перенаправлять на него.' },
  noViewport: { weight: 95, title: 'Сайт не приспособлен для телефонов', why: 'На телефоне страница выглядит мелко, как на компьютере.', fix: 'Настроить мобильное отображение.' },
  noindex: { weight: 90, title: 'Страница закрыта от поисковиков', why: 'Яндекс и Google могут её не показывать.', fix: 'Убрать запрет индексации.' },
  noTitle: { weight: 80, title: 'У страницы нет заголовка', why: 'Заголовок виден в результатах поиска и на вкладке браузера.', fix: 'Написать заголовок с услугой и городом.' },
  noDescription: { weight: 70, title: 'Нет описания для поисковиков', why: 'Поисковик сам выберет текст для выдачи, и он может быть неудачным.', fix: 'Добавить короткое описание с услугами и городом.' },
  noPhoneLink: { weight: 65, title: 'На номер телефона нельзя нажать', why: 'С телефона посетителю приходится копировать номер вручную.', fix: 'Сделать номер кликабельной ссылкой.' },
  shortTitle: { weight: 55, title: 'Заголовок страницы слишком короткий', why: 'По нему поисковик и посетитель не поймут, чем вы занимаетесь.', fix: 'Дописать услугу и город.' },
  noH1: { weight: 50, title: 'На странице нет главного заголовка', why: 'Поисковикам сложнее понять, о чём страница.', fix: 'Добавить один главный заголовок h1.' },
  noMessenger: { weight: 40, title: 'Нет ссылки на мессенджер', why: 'Многим проще написать, чем звонить.', fix: 'Добавить кнопку Telegram или WhatsApp.' },
  imagesNoAlt: { weight: 35, title: 'У картинок нет описаний', why: 'Поисковики хуже понимают изображения, а незрячие посетители их не слышат.', fix: 'Добавить описания к картинкам.' },
  noPreview: { weight: 30, title: 'Ссылка на сайт выглядит пусто в мессенджерах', why: 'Когда ссылкой делятся, не показывается картинка и описание.', fix: 'Добавить разметку Open Graph.' },
};

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** A usable public http(s) address from what the visitor typed, or null. */
export function normalizeUrl(text) {
  const raw = text.trim();
  if (!raw || /\s/.test(raw)) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.') || IPV4.test(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

const attr = (tag, name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(2).find((v) => v !== undefined) ?? null;

function metas(html) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => ({
    key: (attr(tag, 'name') ?? attr(tag, 'property') ?? '').toLowerCase(),
    content: attr(tag, 'content') ?? '',
  }));
}

function visibleText(html) {
  return html.replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const RU_PHONE = /(?:\+7|\b8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}\b/;

export function analyze({ url, status, html, ms, bytes }) {
  const clean = html.replace(/<!--[\s\S]*?-->/g, '');
  const meta = metas(clean);
  const has = (key) => meta.some((m) => m.key === key && m.content.trim());
  const title = clean.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1].replace(/\s+/g, ' ').trim() ?? '';
  const images = [...clean.matchAll(/<img\b[^>]*>/gi)].map(([tag]) => attr(tag, 'alt'));
  const noAlt = images.filter((a) => a === null).length; // alt="" is the correct mark for a decorative image
  const scripts = (clean.match(/<script\b/gi) ?? []).length;
  const text = visibleText(clean);
  // A tiny page with scripts is built in the browser and can't be judged from its HTML.
  const partial = text.length < 200 && scripts > 0;
  const found = [];
  if (status >= 400) found.push('error');
  if (new URL(url).protocol === 'http:') found.push('noHttps');
  if (!has('viewport')) found.push('noViewport');
  if (meta.some((m) => m.key === 'robots' && /noindex/i.test(m.content))) found.push('noindex');
  if (!title) found.push('noTitle');
  else if (title.length < 15) found.push('shortTitle');
  if (!has('description')) found.push('noDescription');
  if (!has('og:title') && !has('og:image')) found.push('noPreview');
  if (!partial) {
    if (!/<h1\b/i.test(clean)) found.push('noH1');
    if (RU_PHONE.test(text) && !/href\s*=\s*["']?tel:/i.test(clean)) found.push('noPhoneLink');
    if (!/(t\.me\/|telegram\.me\/|wa\.me\/|api\.whatsapp\.com|whatsapp:|tg:\/\/)/i.test(clean)) found.push('noMessenger');
    if (noAlt > 0) found.push('imagesNoAlt');
  }
  const problems = found.map((id) => ({ id, ...PROBLEMS[id] }));
  if (ms > SLOW_MS) {
    problems.push({
      id: 'slow', weight: ms > VERY_SLOW_MS ? 110 : 75,
      title: `Сервер отвечает за ${seconds(ms)} с`,
      why: 'Посетитель смотрит на пустой экран, а часть людей уходит, не дождавшись.',
      fix: 'Настроить кэширование или сменить хостинг.',
    });
  }
  problems.sort((a, b) => b.weight - a.weight);
  const facts = [
    { label: 'Ответ сервера', value: `${seconds(ms)} с`, ok: ms <= SLOW_MS },
    { label: 'Вес страницы', value: `${Math.round(bytes / 1024)} КБ`, ok: bytes <= HEAVY_BYTES },
    { label: 'Защищённое соединение', value: url.startsWith('https:') ? 'есть' : 'нет', ok: url.startsWith('https:') },
    { label: 'Картинки без описания', value: `${noAlt} из ${images.length}`, ok: noAlt === 0 },
  ];
  return { url, title, facts, problems, partial };
}

const seconds = (ms) => (ms / 1000).toFixed(1).replace('.', ',');

/** A short first message to the owner; the seller signs and sends it. */
export function ownerMessage(report, top = 3) {
  const host = new URL(report.url).hostname.replace(/^www\./, '');
  if (!report.problems.length) return `Здравствуйте! Проверил сайт ${host}: автоматическая проверка серьёзных проблем не нашла.`;
  const items = report.problems.slice(0, top).map((p, i) => `${i + 1}. ${p.title}. ${p.why}`).join('\n');
  return `Здравствуйте! Посмотрел сайт ${host}. Автоматическая проверка показала:\n\n${items}\n\nМогу это исправить. Работаю вместе с AI-ассистентом Claude Code, результат проверяю сам. Если неинтересно, просто не отвечайте, больше писать не буду.`;
}
