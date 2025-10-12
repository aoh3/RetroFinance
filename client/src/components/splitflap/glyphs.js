export const GLYPH_ORDER = [
  ' ',
  '-',
  '.',
  ',',
  ':',
  ';',
  '/',
  '\\',
  '+',
  '=',
  '%',
  '$',
  '#',
  '&',
  '?',
  '!',
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  '<',
  '>',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z'
];

const NORMALISE_MAP = new Map([
  ['_', ' '],
  ['\u2014', '-'],
  ['\u2013', '-'],
  ['\u2012', '-'],
  ['\u2010', '-'],
  ['\u2212', '-'],
]);

const glyphIndex = new Map(GLYPH_ORDER.map((glyph, index) => [glyph, index]));

export const normaliseGlyph = (input) => {
  if (input === null || input === undefined) {
    return ' ';
  }

  const value = String(input).toUpperCase();
  if (value.length === 0) {
    return ' ';
  }

  const primary = value[0];
  const mapped = NORMALISE_MAP.get(primary) || primary;
  return glyphIndex.has(mapped) ? mapped : ' ';
};

export const getGlyphIndex = (glyph) => {
  const normalised = normaliseGlyph(glyph);
  return glyphIndex.get(normalised) ?? 0;
};
