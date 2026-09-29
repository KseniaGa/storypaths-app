// query-string 7 expects a CommonJS function; the patched upstream decoder is ESM.
// Expo's Metro bundler and Expo 57's supported Node versions support this import.
const decode = require('decode-uri-component-patched').default;

module.exports = function decodeUriComponent(value) {
  // Retain the old decoder's form-style plus handling and upstream type errors.
  return decode(typeof value === 'string' ? value.replace(/\+/g, ' ') : value);
};
