export type SanitizeResult = {
  sanitized: string;
  stripped: boolean;
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE =
  /(?:\+?91[\s-]?)?[6-9]\d{9}\b|\+\d{1,3}[\s-]?\d{6,14}\b|\b\d{10,13}\b/g;
const AADHAAR_RE = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
const PERSONAL_LINE_RE =
  /^[ \t]*.*\b(name|age|d\.?o\.?b\.?|date of birth|patient\s*id|uhid|u\.?h\.?i\.?d\.?|phone|mobile|tel|address|aadhaar|aadhar|email|e-mail|guardian|father|mother)\b\s*[:.].*$/gim;

function applyAll(text: string): string {
  return text
    .replace(PERSONAL_LINE_RE, '')
    .replace(EMAIL_RE, '')
    .replace(AADHAAR_RE, '')
    .replace(PHONE_RE, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Strips obvious personal identifiers from OCR / report text
 * before any LLM call. Never send the original unsanitized string.
 */
export function stripPersonalData(text: string): SanitizeResult {
  const sanitized = applyAll(text);
  return {
    sanitized,
    stripped: sanitized !== text.trim(),
  };
}

export function hasObviousPersonalData(text: string): boolean {
  EMAIL_RE.lastIndex = 0;
  PHONE_RE.lastIndex = 0;
  AADHAAR_RE.lastIndex = 0;
  PERSONAL_LINE_RE.lastIndex = 0;
  return (
    EMAIL_RE.test(text) ||
    AADHAAR_RE.test(text) ||
    PHONE_RE.test(text) ||
    PERSONAL_LINE_RE.test(text)
  );
}
