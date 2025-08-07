// server/utils/filter.js
import BadWords from 'bad-words-next';

const filter = new BadWords();

/**
 * Check if a string contains profanity.
 * @param {string} text
 * @returns {boolean}
 */
export function isExplicit(text) {
  return filter.check(text).length > 0; // Returns array of profane words
}

/**
 * Clean profanity by replacing with asterisks or replacing entire message.
 * @param {string} text
 * @param {boolean} strict - If true, replaces entire message with a warning.
 * @returns {string}
 */
export function cleanText(text, strict = false) {
  if (strict && isExplicit(text)) {
    return '[Message removed due to explicit content]';
  }
  return filter.filter(text);
}
