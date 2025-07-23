import * as BadWords from 'bad-words';

const filter = new BadWords.Filter();

export function isExplicit(text) {
  return filter.isProfane(text);
}

export function cleanText(text) {
  return filter.clean(text);
}
