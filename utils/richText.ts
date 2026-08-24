import type { RichTextFormat } from "../types/story";

export type RichTextSpan = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

type RichTextStyle = Omit<RichTextSpan, "text">;
type RichTextStyleKey = keyof RichTextStyle;

const EMPTY_STYLE: RichTextStyle = {
  bold: false,
  italic: false,
  underline: false,
};
const RICH_TEXT_TAG = /<\/?(?:strong|b|em|i|u)>/gi;

const stylesEqual = (left: RichTextStyle, right: RichTextStyle) =>
  left.bold === right.bold &&
  left.italic === right.italic &&
  left.underline === right.underline;

export const normalizeRichTextFormatting = (
  value: unknown,
  textLength: number,
): RichTextFormat[] =>
  (Array.isArray(value) ? value : [])
    .map((format) => {
      if (typeof format !== "object" || format === null) return null;
      const candidate = format as Partial<RichTextFormat>;
      const start = Math.max(0, Math.min(textLength, Number(candidate.start)));
      const end = Math.max(start, Math.min(textLength, Number(candidate.end)));
      if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) {
        return null;
      }
      const normalized: RichTextFormat = {
        start,
        end,
        ...(candidate.bold ? { bold: true } : {}),
        ...(candidate.italic ? { italic: true } : {}),
        ...(candidate.underline ? { underline: true } : {}),
      };
      return normalized.bold || normalized.italic || normalized.underline
        ? normalized
        : null;
    })
    .filter((format): format is RichTextFormat => format !== null);

const stylesForText = (
  text: string,
  formatting: RichTextFormat[],
): RichTextStyle[] => {
  const styles = Array.from({ length: text.length }, () => ({
    ...EMPTY_STYLE,
  }));
  normalizeRichTextFormatting(formatting, text.length).forEach((format) => {
    for (let index = format.start; index < format.end; index += 1) {
      if (format.bold) styles[index].bold = true;
      if (format.italic) styles[index].italic = true;
      if (format.underline) styles[index].underline = true;
    }
  });
  return styles;
};

const formattingFromStyles = (styles: RichTextStyle[]): RichTextFormat[] => {
  const formatting: RichTextFormat[] = [];
  let start = 0;

  while (start < styles.length) {
    const style = styles[start];
    let end = start + 1;
    while (end < styles.length && stylesEqual(style, styles[end])) end += 1;
    if (style.bold || style.italic || style.underline) {
      formatting.push({
        start,
        end,
        ...(style.bold ? { bold: true } : {}),
        ...(style.italic ? { italic: true } : {}),
        ...(style.underline ? { underline: true } : {}),
      });
    }
    start = end;
  }
  return formatting;
};

const spansFromPlainText = (
  text: string,
  formatting: RichTextFormat[],
): RichTextSpan[] => {
  if (!text) return [];
  const styles = stylesForText(text, formatting);
  const spans: RichTextSpan[] = [];
  let start = 0;

  while (start < text.length) {
    const style = styles[start];
    let end = start + 1;
    while (end < text.length && stylesEqual(style, styles[end])) end += 1;
    spans.push({ text: text.slice(start, end), ...style });
    start = end;
  }
  return spans;
};

const parseLegacyRichText = (value: string): RichTextSpan[] => {
  const spans: RichTextSpan[] = [];
  const active = { bold: 0, italic: 0, underline: 0 };
  let cursor = 0;

  const append = (text: string) => {
    if (!text) return;
    const style = {
      bold: active.bold > 0,
      italic: active.italic > 0,
      underline: active.underline > 0,
    };
    const previous = spans[spans.length - 1];
    if (previous && stylesEqual(previous, style)) {
      previous.text += text;
    } else {
      spans.push({ text, ...style });
    }
  };

  for (const match of value.matchAll(RICH_TEXT_TAG)) {
    append(value.slice(cursor, match.index));
    const tag = match[0].toLowerCase();
    const closing = tag.startsWith("</");
    const name = tag.replace(/[</>]/g, "");
    const key =
      name === "strong" || name === "b"
        ? "bold"
        : name === "em" || name === "i"
          ? "italic"
          : "underline";
    active[key] = closing
      ? Math.max(0, active[key] - 1)
      : active[key] + 1;
    cursor = (match.index || 0) + match[0].length;
  }
  append(value.slice(cursor));
  return spans;
};

export const getRichTextDocument = (
  value: string,
  formatting?: RichTextFormat[],
) => {
  if (formatting !== undefined) {
    return {
      text: value,
      formatting: normalizeRichTextFormatting(formatting, value.length),
    };
  }

  const spans = parseLegacyRichText(value);
  const text = spans.map((span) => span.text).join("");
  let cursor = 0;
  const migratedFormatting = spans.flatMap((span) => {
    const start = cursor;
    cursor += span.text.length;
    return span.bold || span.italic || span.underline
      ? [
          {
            start,
            end: cursor,
            ...(span.bold ? { bold: true } : {}),
            ...(span.italic ? { italic: true } : {}),
            ...(span.underline ? { underline: true } : {}),
          },
        ]
      : [];
  });
  return { text, formatting: migratedFormatting };
};

export const parseRichText = (
  value: string,
  formatting?: RichTextFormat[],
): RichTextSpan[] =>
  formatting !== undefined
    ? spansFromPlainText(value, formatting)
    : parseLegacyRichText(value);

export const toggleRichTextFormatting = (
  text: string,
  formatting: RichTextFormat[],
  start: number,
  end: number,
  style: RichTextStyleKey,
): RichTextFormat[] => {
  const safeStart = Math.max(0, Math.min(text.length, start));
  const safeEnd = Math.max(safeStart, Math.min(text.length, end));
  if (safeStart === safeEnd) return formatting;

  const styles = stylesForText(text, formatting);
  const removeStyle = styles
    .slice(safeStart, safeEnd)
    .every((current) => current[style]);
  for (let index = safeStart; index < safeEnd; index += 1) {
    styles[index][style] = !removeStyle;
  }
  return formattingFromStyles(styles);
};

export const updateRichTextFormattingForEdit = (
  previousText: string,
  nextText: string,
  formatting: RichTextFormat[],
): RichTextFormat[] => {
  let prefix = 0;
  while (
    prefix < previousText.length &&
    prefix < nextText.length &&
    previousText[prefix] === nextText[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < previousText.length - prefix &&
    suffix < nextText.length - prefix &&
    previousText[previousText.length - 1 - suffix] ===
      nextText[nextText.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const previousStyles = stylesForText(previousText, formatting);
  const previousChangeEnd = previousText.length - suffix;
  const insertedLength = nextText.length - prefix - suffix;
  const inheritedStyle =
    previousStyles[prefix] ||
    previousStyles[prefix - 1] ||
    EMPTY_STYLE;
  const nextStyles = [
    ...previousStyles.slice(0, prefix),
    ...Array.from({ length: insertedLength }, () => ({ ...inheritedStyle })),
    ...previousStyles.slice(previousChangeEnd),
  ];
  return formattingFromStyles(nextStyles);
};
