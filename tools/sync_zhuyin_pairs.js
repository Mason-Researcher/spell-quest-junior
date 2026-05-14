const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const targets = [
  path.join(root, "site", "data", "words.json")
];

const siblingLocalWords = path.join(root, "..", "spelling-bee-kids-site_v1", "data", "words.json");
if (fs.existsSync(siblingLocalWords)) {
  targets.push(siblingLocalWords);
}

const bopomofoChars = "ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦˊˇˋ˙";

function hasBopomofo(char) {
  return bopomofoChars.includes(char);
}

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

function parseBopomofoSyllables(zhuyin) {
  const syllables = [];
  let current = "";
  const text = String(zhuyin || "");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (hasBopomofo(char)) {
      current += char;
    } else if (current.length > 0) {
      syllables.push(current);
      current = "";
    }
  }
  if (current.length > 0) {
    syllables.push(current);
  }
  return syllables;
}

function buildZhuyinPairs(text, zhuyin, fieldName, wordId) {
  const sourceText = String(text || "");
  const syllables = parseBopomofoSyllables(zhuyin);
  const pairs = [];
  let syllableIndex = 0;
  let index = 0;
  while (index < sourceText.length) {
    const char = sourceText[index];
    if (isChineseChar(char)) {
      const bpmf = syllables[syllableIndex];
      if (!bpmf) {
        throw new Error(`${wordId} ${fieldName} has too few zhuyin syllables near ${char}`);
      }
      pairs.push({ text: char, bpmf });
      syllableIndex += 1;
      index += 1;
    } else if (isAsciiWordChar(char)) {
      let value = char;
      index += 1;
      while (index < sourceText.length && isAsciiWordChar(sourceText[index])) {
        value += sourceText[index];
        index += 1;
      }
      pairs.push({ text: value, bpmf: "" });
    } else {
      pairs.push({ text: char, bpmf: "" });
      index += 1;
    }
  }
  if (syllableIndex !== syllables.length) {
    throw new Error(`${wordId} ${fieldName} has unused zhuyin syllables`);
  }
  return pairs;
}

function syncWord(word) {
  word.zhPairs = buildZhuyinPairs(word.zh, word.zhuyin, "zh", word.id);
  word.topicZhPairs = buildZhuyinPairs(word.topicZh, word.topicZhuyin, "topicZh", word.id);
  if (word.contentReview && word.contentReview.status === "approved") {
    word.exampleZhPairs = buildZhuyinPairs(word.exampleZh, word.exampleZhuyin, "exampleZh", word.id);
    if (Array.isArray(word.contexts)) {
      for (const context of word.contexts) {
        if (context.reviewStatus === "approved") {
          context.labelZhPairs = buildZhuyinPairs(context.labelZh, context.labelZhuyin, `context.${context.id}.labelZh`, word.id);
          context.sentenceZhPairs = buildZhuyinPairs(context.sentenceZh, context.sentenceZhuyin, `context.${context.id}.sentenceZh`, word.id);
          context.usageZhPairs = buildZhuyinPairs(context.usageZh, context.usageZhuyin, `context.${context.id}.usageZh`, word.id);
        }
      }
    }
  }
}

for (const target of targets) {
  const words = JSON.parse(fs.readFileSync(target, "utf8"));
  for (const word of words) {
    syncWord(word);
  }
  const output = "[\n" + words.map((word) => "  " + JSON.stringify(word)).join(",\n") + "\n]\n";
  fs.writeFileSync(target, output, "utf8");
  console.log(`updated ${target}`);
}
