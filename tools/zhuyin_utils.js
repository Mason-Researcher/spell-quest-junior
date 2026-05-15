const { pinyin } = require("pinyin-pro");

const INITIAL_MAP = {
  b: "ㄅ",
  p: "ㄆ",
  m: "ㄇ",
  f: "ㄈ",
  d: "ㄉ",
  t: "ㄊ",
  n: "ㄋ",
  l: "ㄌ",
  g: "ㄍ",
  k: "ㄎ",
  h: "ㄏ",
  j: "ㄐ",
  q: "ㄑ",
  x: "ㄒ",
  zh: "ㄓ",
  ch: "ㄔ",
  sh: "ㄕ",
  r: "ㄖ",
  z: "ㄗ",
  c: "ㄘ",
  s: "ㄙ"
};

const FINAL_MAP = {
  a: "ㄚ",
  o: "ㄛ",
  e: "ㄜ",
  ai: "ㄞ",
  ei: "ㄟ",
  ao: "ㄠ",
  ou: "ㄡ",
  an: "ㄢ",
  en: "ㄣ",
  ang: "ㄤ",
  eng: "ㄥ",
  er: "ㄦ",
  i: "ㄧ",
  ia: "ㄧㄚ",
  ie: "ㄧㄝ",
  iao: "ㄧㄠ",
  iu: "ㄧㄡ",
  ian: "ㄧㄢ",
  in: "ㄧㄣ",
  iang: "ㄧㄤ",
  ing: "ㄧㄥ",
  u: "ㄨ",
  ua: "ㄨㄚ",
  uo: "ㄨㄛ",
  uai: "ㄨㄞ",
  ui: "ㄨㄟ",
  uan: "ㄨㄢ",
  un: "ㄨㄣ",
  uang: "ㄨㄤ",
  ong: "ㄨㄥ",
  v: "ㄩ",
  ve: "ㄩㄝ",
  van: "ㄩㄢ",
  vn: "ㄩㄣ",
  iong: "ㄩㄥ"
};

const Y_FINAL_MAP = {
  yi: "ㄧ",
  ya: "ㄧㄚ",
  yao: "ㄧㄠ",
  ye: "ㄧㄝ",
  you: "ㄧㄡ",
  yan: "ㄧㄢ",
  yang: "ㄧㄤ",
  yin: "ㄧㄣ",
  ying: "ㄧㄥ",
  yong: "ㄩㄥ",
  yu: "ㄩ",
  yue: "ㄩㄝ",
  yuan: "ㄩㄢ",
  yun: "ㄩㄣ"
};

const W_FINAL_MAP = {
  wu: "ㄨ",
  wa: "ㄨㄚ",
  wai: "ㄨㄞ",
  wan: "ㄨㄢ",
  wang: "ㄨㄤ",
  wei: "ㄨㄟ",
  wen: "ㄨㄣ",
  weng: "ㄨㄥ",
  wo: "ㄨㄛ"
};

const TONE_MAP = {
  "1": "",
  "2": "ˊ",
  "3": "ˇ",
  "4": "ˋ",
  "5": "˙",
  "0": "˙"
};

const SPECIAL_NO_FINAL_I = new Set(["zhi", "chi", "shi", "ri", "zi", "ci", "si"]);

function isChineseChar(char) {
  const code = char.charCodeAt(0);
  return (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xf900 && code <= 0xfaff);
}

function isAsciiWordChar(char) {
  const code = char.charCodeAt(0);
  return (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    char === "-" ||
    char === "'";
}

function splitToneNumber(syllable) {
  const text = String(syllable || "");
  if (!text) {
    throw new Error("Empty pinyin syllable.");
  }
  const last = text[text.length - 1];
  if (last >= "0" && last <= "5") {
    return {
      body: text.slice(0, text.length - 1),
      tone: last
    };
  }
  return {
    body: text,
    tone: "1"
  };
}

function normalizeVowel(value) {
  let output = "";
  for (const char of String(value || "")) {
    if (char === "ü" || char === "ü") {
      output += "v";
    } else {
      output += char;
    }
  }
  return output;
}

function findInitial(body) {
  for (const initial of ["zh", "ch", "sh"]) {
    if (body.startsWith(initial)) {
      return initial;
    }
  }
  const first = body[0] || "";
  if (Object.prototype.hasOwnProperty.call(INITIAL_MAP, first)) {
    return first;
  }
  return "";
}

function convertJqxFinal(initial, final) {
  if (!(initial === "j" || initial === "q" || initial === "x")) {
    return final;
  }
  if (final === "u") {
    return "v";
  }
  if (final === "ue") {
    return "ve";
  }
  if (final === "uan") {
    return "van";
  }
  if (final === "un") {
    return "vn";
  }
  return final;
}

function bopomofoBodyFromPinyinBody(rawBody) {
  const body = normalizeVowel(rawBody);
  if (Object.prototype.hasOwnProperty.call(Y_FINAL_MAP, body)) {
    return Y_FINAL_MAP[body];
  }
  if (Object.prototype.hasOwnProperty.call(W_FINAL_MAP, body)) {
    return W_FINAL_MAP[body];
  }
  const initial = findInitial(body);
  if (!initial) {
    const finalOnly = FINAL_MAP[body];
    if (!finalOnly) {
      throw new Error(`Unsupported pinyin final: ${body}`);
    }
    return finalOnly;
  }
  if (SPECIAL_NO_FINAL_I.has(body)) {
    return INITIAL_MAP[initial];
  }
  const final = convertJqxFinal(initial, body.slice(initial.length));
  const mappedFinal = FINAL_MAP[final];
  if (!mappedFinal) {
    throw new Error(`Unsupported pinyin syllable: ${body}`);
  }
  return `${INITIAL_MAP[initial]}${mappedFinal}`;
}

function pinyinSyllableToZhuyin(syllable) {
  const parsed = splitToneNumber(syllable);
  const body = bopomofoBodyFromPinyinBody(parsed.body);
  return `${body}${TONE_MAP[parsed.tone] || ""}`;
}

function zhuyinForChineseText(text) {
  const source = String(text || "");
  let chineseOnly = "";
  for (const char of source) {
    if (isChineseChar(char)) {
      chineseOnly += char;
    }
  }
  const syllables = pinyin(chineseOnly, {
    type: "array",
    toneType: "num",
    nonZh: "consecutive"
  });
  const zhuyinTokens = [];
  for (const syllable of syllables) {
    zhuyinTokens.push(pinyinSyllableToZhuyin(syllable));
  }
  return zhuyinTokens.join(" ");
}

function pairsFromTextAndZhuyin(text, zhuyin) {
  const tokens = String(zhuyin || "").split(" ").filter((value) => value.trim().length > 0);
  const pairs = [];
  let tokenIndex = 0;
  for (const char of String(text || "")) {
    if (!isChineseChar(char)) {
      pairs.push({ text: char, bpmf: "" });
      continue;
    }
    const bpmf = tokens[tokenIndex] || "";
    pairs.push({ text: char, bpmf });
    tokenIndex += 1;
  }
  if (tokenIndex !== tokens.length) {
    throw new Error(`Unused zhuyin tokens for text: ${text}`);
  }
  return pairs;
}

function textFromPairs(pairs) {
  return pairs.map((pair) => String(pair.text || "")).join("");
}

function hasChinese(text) {
  for (const char of String(text || "")) {
    if (isChineseChar(char)) {
      return true;
    }
  }
  return false;
}

function hasAsciiWord(text) {
  for (const char of String(text || "")) {
    if (isAsciiWordChar(char)) {
      return true;
    }
  }
  return false;
}

module.exports = {
  hasAsciiWord,
  hasChinese,
  pairsFromTextAndZhuyin,
  pinyinSyllableToZhuyin,
  textFromPairs,
  zhuyinForChineseText
};
