import { inRange } from '../utils';

const determineFont = text => {
  const code = text.charCodeAt(0);
  /* Based on https://en.wikipedia.org/wiki/Unicode_block */
  if (inRange(code, 0x0000, 0x052F)) {
    return 'Roboto';
  } else if (inRange(code, 0x0600, 0x06FF) || inRange(code, 0x0750, 0x077F)) {
    return 'NotoSansArabic';
  } else if (inRange(code, 0x0E00, 0x0E7F)) {
    return 'NotoSansThai';
  } else if (inRange(code, 0x0530, 0x058F)) {
    return 'NotoSansArmenian';
  } else if (inRange(code, 0x10A0, 0x10FF)) {
    return 'NotoSansGeorgian';
  } else {
    /* Default to WenQuanYiZenHei as it supports the most characters (mostly CJK). */
    return 'WenQuanYiZenHei';
  }
};

export const pdfName = (name, { swapLatinWithLocalNames = false, short = false } = {}) => {
  /* Note: support normal and fullwidth parentheses. */
  const [, latinName, localName] = name.match(/(.+)\s*[(（](.+)[)）]/) || [null, name, null];
  if (!localName) return latinName;
  const pdfNames = [latinName, { text: localName, font: determineFont(localName) }];
  const [first, second] = swapLatinWithLocalNames ? pdfNames.reverse() : pdfNames;
  return short ? first : [first, ' (', second, ')'];
};

export const getImageDataUrl = url => {
  if (!url) return Promise.resolve(null);
  const params = new URLSearchParams({
    url,
    bri: 30,
    bg: 'white',
    w: 200,
    h: 200,
    t: 'letterbox',
    output: 'jpg',
    encoding: 'base64'
  });
  return fetch(`https://images.weserv.nl/?${params.toString()}`)
    .then(response => response.text())
    .catch(() => null);
};
