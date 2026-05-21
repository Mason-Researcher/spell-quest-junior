const REQUIRED_WORD_FIELDS = [
  "id",
  "word",
  "pos",
  "zh",
  "zhuyin",
  "source",
  "level",
  "topic",
  "topicZh",
  "topicZhuyin",
  "starred",
  "example",
  "usage"
];

const ALLOWED_LEVELS = ["starter", "bridge", "challenge"];
const FIRST_LETTERS = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
const EXAM_DIFFICULTIES = ["low", "medium", "high"];
const ZHUYIN_TONE_MARKS = ["ˊ", "ˇ", "ˋ", "˙"];
const BOPOMOFO_SYMBOLS = Array.from("ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ");

const SPEECH_SETTINGS = {
  volume: 1,
  pitch: 1.08,
  clipStartTimeoutMs: 900,
  speechStartDelayMs: 20,
  androidSpeechThrottleMs: 800
};
const AUDIO_PRELOAD_LIMIT = 24;

const ENGLISH_VOICE_HINTS = [
  "microsoft jenny",
  "microsoft aria",
  "microsoft guy",
  "google us english",
  "microsoft david",
  "microsoft zira"
];

const CHINESE_VOICE_HINTS = [
  "microsoft hanhan",
  "microsoft yating",
  "microsoft tracy",
  "google mandarin",
  "google chinese"
];

const state = {
  manifest: null,
  audioManifest: null,
  activeAudio: null,
  preloadedAudio: new Map(),
  speechVoices: [],
  speechToken: 0,
  speechActive: false,
  lastSpeechRequestAt: 0,
  words: [],
  wordById: new Map(),
  filteredWords: [],
  filterSignature: "",
  currentIndex: 0,
  activeContextIndex: 0,
  knownWords: new Set(),
  examWords: [],
  examIndex: 0,
  examAnsweredCount: 0,
  examCorrectCount: 0,
  examStreak: 0,
  examAnswerChecked: false,
  examCompleted: false,
  celebrationTimer: null,
  celebrationAudioContext: null,
  examDifficulty: "low",
  examInitialMode: "single",
  selectedExamInitials: new Set(),
  selectedLetters: [],
  activeExamWord: null,
  questionPacks: []
};

const elements = {
  totalWords: document.getElementById("totalWords"),
  knownWords: document.getElementById("knownWords"),
  starWords: document.getElementById("starWords"),
  modeTabs: Array.from(document.querySelectorAll(".mode-tab")),
  practiceView: document.getElementById("practiceView"),
  examView: document.getElementById("examView"),
  searchInput: document.getElementById("searchInput"),
  initialFilter: document.getElementById("initialFilter"),
  levelFilter: document.getElementById("levelFilter"),
  topicFilter: document.getElementById("topicFilter"),
  shuffleButton: document.getElementById("shuffleButton"),
  clearFiltersButton: document.getElementById("clearFiltersButton"),
  filterStatus: document.getElementById("filterStatus"),
  wordSource: document.getElementById("wordSource"),
  wordLevel: document.getElementById("wordLevel"),
  wordStar: document.getElementById("wordStar"),
  wordText: document.getElementById("wordText"),
  wordPos: document.getElementById("wordPos"),
  meaningText: document.getElementById("meaningText"),
  topicText: document.getElementById("topicText"),
  exampleText: document.getElementById("exampleText"),
  exampleZhText: document.getElementById("exampleZhText"),
  exampleZhuyinText: document.getElementById("exampleZhuyinText"),
  exampleZhHint: document.getElementById("exampleZhHint"),
  contextTabs: document.getElementById("contextTabs"),
  usageText: document.getElementById("usageText"),
  contextZhText: document.getElementById("contextZhText"),
  contextZhuyinText: document.getElementById("contextZhuyinText"),
  usageZhHint: document.getElementById("usageZhHint"),
  contextUsageZhuyin: document.getElementById("contextUsageZhuyin"),
  practiceLetters: document.getElementById("practiceLetters"),
  speakButton: document.getElementById("speakButton"),
  speakMeaningZh: document.getElementById("speakMeaningZh"),
  speakTopicZh: document.getElementById("speakTopicZh"),
  speakExampleEn: document.getElementById("speakExampleEn"),
  speakExampleZh: document.getElementById("speakExampleZh"),
  speakUsageEn: document.getElementById("speakUsageEn"),
  speakUsageZh: document.getElementById("speakUsageZh"),
  prevButton: document.getElementById("prevButton"),
  nextButton: document.getElementById("nextButton"),
  knownButton: document.getElementById("knownButton"),
  audioSelect: document.getElementById("audioSelect"),
  sourceAudio: document.getElementById("sourceAudio"),
  examSessionPanel: document.getElementById("examSessionPanel"),
  examAnsweredCount: document.getElementById("examAnsweredCount"),
  examCorrectCount: document.getElementById("examCorrectCount"),
  examMedal: document.getElementById("examMedal"),
  resetExamSessionButton: document.getElementById("resetExamSessionButton"),
  examCelebration: document.getElementById("examCelebration"),
  examDifficultyButtons: Array.from(document.querySelectorAll("[data-exam-difficulty]")),
  examInitialScope: document.getElementById("examInitialScope"),
  examInitialModeButtons: [],
  examInitialPicker: null,
  examInitialSummary: null,
  examInitialLetterButtons: [],
  playExamWord: document.getElementById("playExamWord"),
  playExamHintZh: document.getElementById("playExamHintZh"),
  newExamButton: document.getElementById("newExamButton"),
  answerSlots: document.getElementById("answerSlots"),
  letterBank: document.getElementById("letterBank"),
  examFeedback: document.getElementById("examFeedback"),
  eraseButton: document.getElementById("eraseButton"),
  checkButton: document.getElementById("checkButton"),
  nextExamButton: document.getElementById("nextExamButton"),
  examHint: document.getElementById("examHint")
};

const LABEL_PAIRS = {
  translation: [
    { text: "中", bpmf: "ㄓㄨㄥ" },
    { text: "文", bpmf: "ㄨㄣˊ" },
    { text: "翻", bpmf: "ㄈㄢ" },
    { text: "譯", bpmf: "ㄧˋ" }
  ],
  learningFocus: [
    { text: "學", bpmf: "ㄒㄩㄝˊ" },
    { text: "習", bpmf: "ㄒㄧˊ" },
    { text: "重", bpmf: "ㄓㄨㄥˋ" },
    { text: "點", bpmf: "ㄉㄧㄢˇ" }
  ],
  usageTask: [
    { text: "應", bpmf: "ㄧㄥˋ" },
    { text: "用", bpmf: "ㄩㄥˋ" },
    { text: "任", bpmf: "ㄖㄣˋ" },
    { text: "務", bpmf: "ㄨˋ" }
  ],
  chineseHint: [
    { text: "中", bpmf: "ㄓㄨㄥ" },
    { text: "文", bpmf: "ㄨㄣˊ" },
    { text: "提", bpmf: "ㄊㄧˊ" },
    { text: "示", bpmf: "ㄕˋ" }
  ],
  topic: [
    { text: "主", bpmf: "ㄓㄨˇ" },
    { text: "題", bpmf: "ㄊㄧˊ" }
  ],
  chineseTask: [
    { text: "中", bpmf: "ㄓㄨㄥ" },
    { text: "文", bpmf: "ㄨㄣˊ" },
    { text: "任", bpmf: "ㄖㄣˋ" },
    { text: "務", bpmf: "ㄨˋ" }
  ],
  noMatchingWords: [
    { text: "沒", bpmf: "ㄇㄟˊ" },
    { text: "有", bpmf: "ㄧㄡˇ" },
    { text: "符", bpmf: "ㄈㄨˊ" },
    { text: "合", bpmf: "ㄏㄜˊ" },
    { text: "條", bpmf: "ㄊㄧㄠˊ" },
    { text: "件", bpmf: "ㄐㄧㄢˋ" },
    { text: "的", bpmf: "ㄉㄜ˙" },
    { text: "單", bpmf: "ㄉㄢ" },
    { text: "字", bpmf: "ㄗˋ" }
  ],
  matching: [
    { text: "符", bpmf: "ㄈㄨˊ" },
    { text: "合", bpmf: "ㄏㄜˊ" }
  ],
  wordsUnit: [
    { text: "個", bpmf: "ㄍㄜˋ" },
    { text: "單", bpmf: "ㄉㄢ" },
    { text: "字", bpmf: "ㄗˋ" }
  ],
  filterActive: [
    { text: "篩", bpmf: "ㄕㄞ" },
    { text: "選", bpmf: "ㄒㄩㄢˇ" },
    { text: "中", bpmf: "ㄓㄨㄥ" }
  ],
  noExamItems: [
    { text: "沒", bpmf: "ㄇㄟˊ" },
    { text: "有", bpmf: "ㄧㄡˇ" },
    { text: "可", bpmf: "ㄎㄜˇ" },
    { text: "用", bpmf: "ㄩㄥˋ" },
    { text: "題", bpmf: "ㄊㄧˊ" },
    { text: "目", bpmf: "ㄇㄨˋ" }
  ],
  cancelKnown: [
    { text: "取", bpmf: "ㄑㄩˇ" },
    { text: "消", bpmf: "ㄒㄧㄠ" },
    { text: "已", bpmf: "ㄧˇ" },
    { text: "熟", bpmf: "ㄕㄨˊ" }
  ],
  markKnown: [
    { text: "標", bpmf: "ㄅㄧㄠ" },
    { text: "記", bpmf: "ㄐㄧˋ" },
    { text: "已", bpmf: "ㄧˇ" },
    { text: "熟", bpmf: "ㄕㄨˊ" }
  ],
  meaning: [
    { text: "意", bpmf: "ㄧˋ" },
    { text: "思", bpmf: "ㄙ˙" }
  ],
  source: [
    { text: "來", bpmf: "ㄌㄞˊ" },
    { text: "源", bpmf: "ㄩㄢˊ" }
  ],
  use: [
    { text: "用", bpmf: "ㄩㄥˋ" }
  ],
  express: [
    { text: "表", bpmf: "ㄅㄧㄠˇ" },
    { text: "達", bpmf: "ㄉㄚˊ" }
  ],
  thisConcept: [
    { text: "這", bpmf: "ㄓㄜˋ" },
    { text: "個", bpmf: "ㄍㄜˋ" },
    { text: "概", bpmf: "ㄍㄞˋ" },
    { text: "念", bpmf: "ㄋㄧㄢˋ" }
  ],
  needMoreLetters: [
    { text: "還", bpmf: "ㄏㄞˊ" },
    { text: "差", bpmf: "ㄔㄚ" },
    { text: "幾", bpmf: "ㄐㄧˇ" },
    { text: "個", bpmf: "ㄍㄜˋ" },
    { text: "字", bpmf: "ㄗˋ" },
    { text: "母", bpmf: "ㄇㄨˇ" }
  ],
  correct: [
    { text: "答", bpmf: "ㄉㄚˊ" },
    { text: "對", bpmf: "ㄉㄨㄟˋ" },
    { text: "了", bpmf: "ㄌㄜ˙" }
  ],
  tryAgain: [
    { text: "再", bpmf: "ㄗㄞˋ" },
    { text: "想", bpmf: "ㄒㄧㄤˇ" },
    { text: "一", bpmf: "ㄧˊ" },
    { text: "下", bpmf: "ㄒㄧㄚˋ" }
  ]
};

const EXAM_INITIAL_LABEL_PAIRS = {
  scopeTitle: [
    { text: "字", bpmf: "ㄗˋ" },
    { text: "頭", bpmf: "ㄊㄡˊ" },
    { text: "範", bpmf: "ㄈㄢˋ" },
    { text: "圍", bpmf: "ㄨㄟˊ" }
  ],
  single: [
    { text: "單", bpmf: "ㄉㄢ" },
    { text: "一", bpmf: "ㄧ" }
  ],
  custom: [
    { text: "自", bpmf: "ㄗˋ" },
    { text: "選", bpmf: "ㄒㄩㄢˇ" }
  ],
  customInitials: [
    { text: "自", bpmf: "ㄗˋ" },
    { text: "選", bpmf: "ㄒㄩㄢˇ" },
    { text: "字", bpmf: "ㄗˋ" },
    { text: "頭", bpmf: "ㄊㄡˊ" }
  ],
  selected: [
    { text: "已", bpmf: "ㄧˇ" },
    { text: "選", bpmf: "ㄒㄩㄢˇ" }
  ],
  total: [
    { text: "共", bpmf: "ㄍㄨㄥˋ" }
  ],
  words: [
    { text: "字", bpmf: "ㄗˋ" }
  ],
  questionScope: [
    { text: "出", bpmf: "ㄔㄨ" },
    { text: "題", bpmf: "ㄊㄧˊ" },
    { text: "範", bpmf: "ㄈㄢˋ" },
    { text: "圍", bpmf: "ㄨㄟˊ" }
  ],
  chooseOne: [
    { text: "請", bpmf: "ㄑㄧㄥˇ" },
    { text: "至", bpmf: "ㄓˋ" },
    { text: "少", bpmf: "ㄕㄠˇ" },
    { text: "選", bpmf: "ㄒㄩㄢˇ" },
    { text: "一", bpmf: "ㄧ" },
    { text: "個", bpmf: "ㄍㄜˋ" },
    { text: "字", bpmf: "ㄗˋ" },
    { text: "頭", bpmf: "ㄊㄡˊ" }
  ],
  noItems: [
    { text: "沒", bpmf: "ㄇㄟˊ" },
    { text: "有", bpmf: "ㄧㄡˇ" },
    { text: "符", bpmf: "ㄈㄨˊ" },
    { text: "合", bpmf: "ㄏㄜˊ" },
    { text: "題", bpmf: "ㄊㄧˊ" },
    { text: "目", bpmf: "ㄇㄨˋ" }
  ]
};

const EXAM_SESSION_LABEL_PAIRS = {
  sessionTitle: [
    { text: "本", bpmf: "ㄅㄣˇ" },
    { text: "次", bpmf: "ㄘˋ" },
    { text: "測", bpmf: "ㄘㄜˋ" },
    { text: "驗", bpmf: "ㄧㄢˋ" }
  ],
  answered: [
    { text: "已", bpmf: "ㄧˇ" },
    { text: "考", bpmf: "ㄎㄠˇ" }
  ],
  correct: [
    { text: "答", bpmf: "ㄉㄚˊ" },
    { text: "對", bpmf: "ㄉㄨㄟˋ" }
  ],
  questions: [
    { text: "題", bpmf: "ㄊㄧˊ" }
  ],
  resetThis: [
    { text: "歸", bpmf: "ㄍㄨㄟ" },
    { text: "零", bpmf: "ㄌㄧㄥˊ" },
    { text: "本", bpmf: "ㄅㄣˇ" },
    { text: "次", bpmf: "ㄘˋ" }
  ],
  completed: [
    { text: "本", bpmf: "ㄅㄣˇ" },
    { text: "次", bpmf: "ㄘˋ" },
    { text: "範", bpmf: "ㄈㄢˋ" },
    { text: "圍", bpmf: "ㄨㄟˊ" },
    { text: "已", bpmf: "ㄧˇ" },
    { text: "完", bpmf: "ㄨㄢˊ" },
    { text: "成", bpmf: "ㄔㄥˊ" }
  ],
  congrats: [
    { text: "恭", bpmf: "ㄍㄨㄥ" },
    { text: "喜", bpmf: "ㄒㄧˇ" },
    { text: "連", bpmf: "ㄌㄧㄢˊ" },
    { text: "對", bpmf: "ㄉㄨㄟˋ" }
  ],
  bronzeMedal: [
    { text: "銅", bpmf: "ㄊㄨㄥˊ" },
    { text: "牌", bpmf: "ㄆㄞˊ" }
  ],
  silverMedal: [
    { text: "銀", bpmf: "ㄧㄣˊ" },
    { text: "牌", bpmf: "ㄆㄞˊ" }
  ],
  goldMedal: [
    { text: "金", bpmf: "ㄐㄧㄣ" },
    { text: "牌", bpmf: "ㄆㄞˊ" }
  ]
};

function isZhuyinPairs(pairs) {
  return Array.isArray(pairs) &&
    pairs.length > 0 &&
    pairs.every((pair) => pair && String(pair.text || "").length > 0 && "bpmf" in pair);
}

function splitZhuyinSyllable(value) {
  let body = String(value || "").trim();
  let tone = "";
  for (const toneMark of ZHUYIN_TONE_MARKS) {
    const position = body.indexOf(toneMark);
    if (position >= 0) {
      tone = toneMark;
      body = body.slice(0, position) + body.slice(position + toneMark.length);
      break;
    }
  }
  const symbols = Array.from(body).filter((symbol) => symbol !== " " && symbol !== "　");
  return { symbols, tone };
}

function isCjkCharacter(value) {
  if (!value) {
    return false;
  }
  const code = value.codePointAt(0);
  return (code >= 0x3400 && code <= 0x4DBF) ||
    (code >= 0x4E00 && code <= 0x9FFF) ||
    (code >= 0xF900 && code <= 0xFAFF);
}

function isBopomofoCharacter(value) {
  return BOPOMOFO_SYMBOLS.includes(value) || ZHUYIN_TONE_MARKS.includes(value);
}

function isPlainZhuyinText(text, bpmf) {
  if (bpmf) {
    return false;
  }
  return !Array.from(String(text || "")).some((character) => isCjkCharacter(character) || isBopomofoCharacter(character));
}

function cleanBpmfToken(value) {
  let output = "";
  Array.from(String(value || "")).forEach((character) => {
    if (isBopomofoCharacter(character)) {
      output += character;
    }
  });
  return output;
}

function splitBpmfTokens(value) {
  const tokens = [];
  let current = "";
  Array.from(String(value || "")).forEach((character) => {
    if (character === " " || character === "　" || character === "\n" || character === "\t") {
      const cleaned = cleanBpmfToken(current);
      if (cleaned) {
        tokens.push(cleaned);
      }
      current = "";
      return;
    }
    current += character;
  });
  const cleaned = cleanBpmfToken(current);
  if (cleaned) {
    tokens.push(cleaned);
  }
  return tokens;
}

function splitBpmfTokensStrict(value) {
  const tokens = [];
  let current = "";
  Array.from(String(value || "")).forEach((character) => {
    if (isBopomofoCharacter(character)) {
      current += character;
      return;
    }
    if (current) {
      const cleaned = cleanBpmfToken(current);
      if (cleaned) {
        tokens.push(cleaned);
      }
      current = "";
    }
  });
  const cleaned = cleanBpmfToken(current);
  if (cleaned) {
    tokens.push(cleaned);
  }
  return tokens;
}

function pairsFromTextAndZhuyin(text, zhuyin) {
  const tokens = splitBpmfTokensStrict(zhuyin);
  let tokenIndex = 0;
  return Array.from(String(text || "")).map((character) => {
    if (!isCjkCharacter(character)) {
      return { text: character, bpmf: "" };
    }
    const bpmf = tokens[tokenIndex] || "";
    tokenIndex += 1;
    return { text: character, bpmf };
  });
}

function createZhuyinMark(bpmf) {
  const mark = document.createElement("span");
  const parsed = splitZhuyinSyllable(bpmf);
  mark.className = "bpmf-mark";
  mark.dataset.bpmf = bpmf;
  mark.setAttribute("aria-label", bpmf);
  if (parsed.symbols.length <= 1) {
    mark.classList.add("bpmf-mark-short");
  } else if (parsed.symbols.length >= 3) {
    mark.classList.add("bpmf-mark-long");
  }
  if (parsed.tone === "˙") {
    mark.classList.add("bpmf-mark-neutral");
  }
  const sound = document.createElement("span");
  sound.className = "bpmf-sound";
  parsed.symbols.forEach((symbol) => {
    const symbolNode = document.createElement("span");
    symbolNode.className = "bpmf-symbol";
    symbolNode.textContent = symbol;
    sound.appendChild(symbolNode);
  });
  const tone = document.createElement("span");
  tone.className = parsed.tone ? "bpmf-tone" : "bpmf-tone bpmf-tone-empty";
  tone.textContent = parsed.tone || "ˊ";
  mark.appendChild(sound);
  mark.appendChild(tone);
  return mark;
}

function createZhuyinPhrase(pairs, extraClass = "") {
  const phrase = document.createElement("span");
  phrase.className = `taiwan-zhuyin${extraClass ? ` ${extraClass}` : ""}`;
  const phraseText = pairs.map((pair) => String(pair.text || "")).join("");
  phrase.dataset.bpmfText = phraseText;
  phrase.setAttribute("aria-label", phraseText);
  pairs.forEach((pair) => {
    const text = String(pair.text || "");
    const bpmf = String(pair.bpmf || "");
    if (isPlainZhuyinText(text, bpmf)) {
      const plain = document.createElement("span");
      plain.className = "bpmf-plain";
      plain.textContent = text;
      phrase.appendChild(plain);
      return;
    }
    const unit = document.createElement("span");
    unit.className = bpmf ? "bpmf-unit" : "bpmf-unit no-bpmf";
    const han = document.createElement("span");
    han.className = "bpmf-han";
    han.textContent = text;
    unit.appendChild(han);
    if (bpmf) {
      unit.appendChild(createZhuyinMark(bpmf));
    }
    phrase.appendChild(unit);
  });
  return phrase;
}

function renderBpmfText(element, text, zhuyin, extraClass = "") {
  if (!element) {
    return;
  }
  element.innerHTML = "";
  element.appendChild(createZhuyinPhrase(pairsFromTextAndZhuyin(text, zhuyin), extraClass));
}

function renderBpmfPairs(element, pairs, extraClass = "") {
  if (!element) {
    return;
  }
  element.innerHTML = "";
  element.appendChild(createZhuyinPhrase(pairs, extraClass));
}

function appendBpmfPairs(parent, pairs, extraClass = "") {
  parent.appendChild(createZhuyinPhrase(pairs, extraClass));
}

function appendPlain(parent, text) {
  parent.appendChild(document.createTextNode(text));
}

function hydrateStaticBpmf() {
  const nodes = Array.from(document.querySelectorAll("[data-bpmf-text][data-bpmf]"));
  nodes.forEach((node) => {
    const text = node.dataset.bpmfText || "";
    const bpmf = node.dataset.bpmf || "";
    node.innerHTML = "";
    node.classList.add("bpmf-static");
    node.setAttribute("aria-label", text);
    node.appendChild(createZhuyinPhrase(pairsFromTextAndZhuyin(text, bpmf), "bpmf-static-text"));
  });
}

function renderZhuyinPhrase(element, pairs, fallbackText, fallbackZhuyin, extraClass = "") {
  if (!element) {
    return;
  }
  element.innerHTML = "";
  if (isZhuyinPairs(pairs)) {
    element.appendChild(createZhuyinPhrase(pairs, extraClass));
    return;
  }
  element.textContent = `${fallbackText}（${fallbackZhuyin}）`;
}

function renderLabelAndPhrase(element, labelPairs, contentPairs, fallbackLabel, fallbackText, fallbackZhuyin) {
  if (!element) {
    return;
  }
  element.innerHTML = "";
  if (isZhuyinPairs(contentPairs)) {
    const label = createZhuyinPhrase(labelPairs, "bpmf-label");
    element.appendChild(label);
    element.appendChild(document.createTextNode("："));
    element.appendChild(createZhuyinPhrase(contentPairs, "bpmf-content"));
    return;
  }
  element.textContent = `${fallbackLabel}：${fallbackText}（${fallbackZhuyin}）`;
}

function renderExamHint(word) {
  elements.examHint.innerHTML = "";
  appendBpmfPairs(elements.examHint, LABEL_PAIRS.meaning, "bpmf-label");
  appendPlain(elements.examHint, "：");
  appendBpmfPairs(elements.examHint, word.zhPairs, "bpmf-content");
  appendPlain(elements.examHint, " · ");
  appendBpmfPairs(elements.examHint, LABEL_PAIRS.topic, "bpmf-label");
  appendPlain(elements.examHint, "：");
  appendBpmfPairs(elements.examHint, word.topicZhPairs, "bpmf-content");
  appendPlain(elements.examHint, " · ");
  appendBpmfPairs(elements.examHint, LABEL_PAIRS.source, "bpmf-label");
  appendPlain(elements.examHint, `：${word.source}`);
}

function pairText(pairs) {
  if (!isZhuyinPairs(pairs)) {
    return "";
  }
  return pairs.map((pair) => pair.text).join("");
}

function topicLabel(word) {
  return `${word.topicZh}（${word.topicZhuyin}）`;
}

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

function includesText(value, needle) {
  return normalizeText(value).includes(needle);
}

function isSupportedSpelling(text) {
  const letters = String(text || "").replaceAll(" ", "").replaceAll("-", "");
  if (letters.length === 0) {
    return false;
  }
  for (let index = 0; index < letters.length; index += 1) {
    const code = letters.charCodeAt(index);
    const upper = code >= 65 && code <= 90;
    const lower = code >= 97 && code <= 122;
    if (!upper && !lower) {
      return false;
    }
  }
  return true;
}

function validateWordRecord(word, bankId) {
  const missing = REQUIRED_WORD_FIELDS.filter((field) => word[field] === undefined || word[field] === null || word[field] === "");
  if (missing.length > 0) {
    throw new Error(`Word record ${word.id || "unknown"} in ${bankId} misses fields: ${missing.join(", ")}`);
  }
  if (!ALLOWED_LEVELS.includes(word.level)) {
    throw new Error(`Word record ${word.id} has invalid level: ${word.level}`);
  }
  if (!isSupportedSpelling(word.word)) {
    throw new Error(`Word record ${word.id} has unsupported spelling: ${word.word}`);
  }
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

function normalizeWordPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.words)) {
    return payload.words;
  }
  throw new Error("Word bank payload must be an array or contain a words array.");
}

async function loadManifest() {
  try {
    return await fetchJson("data/manifest.json");
  } catch (error) {
    return {
      schemaVersion: "fallback",
      wordBanks: [
        {
          id: "core",
          path: "data/words.json"
        }
      ],
      questionPacks: [
        {
          id: "core-all",
          title: "Core Spelling Pack",
          wordBankId: "core",
          strategy: "all"
        }
      ]
    };
  }
}

async function loadAudioManifest(manifest) {
  const audioEntries = Array.isArray(manifest.audioManifests) ? manifest.audioManifests : [];
  const mergedManifest = {
    schemaVersion: manifest.schemaVersion || "fallback",
    audioRoot: "assets/audio/generated",
    fallback: "browser-speechSynthesis",
    clips: {}
  };
  for (const entry of audioEntries) {
    try {
      const payload = await fetchJson(entry.path);
      const clips = payload && payload.clips ? payload.clips : {};
      mergedManifest.audioRoot = payload.audioRoot || mergedManifest.audioRoot;
      mergedManifest.clips = {
        ...mergedManifest.clips,
        ...clips
      };
    } catch (error) {
      console.warn(`Audio manifest skipped: ${entry.path}`);
    }
  }
  state.audioManifest = mergedManifest;
}

async function loadWordDatabase() {
  const manifest = await loadManifest();
  const bankEntries = Array.isArray(manifest.wordBanks) ? manifest.wordBanks : [];
  let mergedWords = [];
  for (const bank of bankEntries) {
    const payload = await fetchJson(bank.path);
    const bankWords = normalizeWordPayload(payload).map((word) => {
      const taggedWord = {
        ...word,
        wordBankId: bank.id,
        databasePath: bank.path
      };
      validateWordRecord(taggedWord, bank.id);
      return taggedWord;
    });
    mergedWords = mergedWords.concat(bankWords);
  }
  state.manifest = manifest;
  state.questionPacks = Array.isArray(manifest.questionPacks) ? manifest.questionPacks : [];
  await loadAudioManifest(manifest);
  return mergedWords;
}

function rebuildWordIndex() {
  state.wordById = new Map();
  state.words.forEach((word) => {
    if (state.wordById.has(word.id)) {
      throw new Error(`Duplicate word id: ${word.id}`);
    }
    state.wordById.set(word.id, word);
  });
}

function loadKnownWords() {
  const saved = window.localStorage.getItem("spellQuestKnownWords");
  if (!saved) {
    return new Set();
  }
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((id) => state.wordById.has(id)));
  } catch (error) {
    return new Set();
  }
}

function saveKnownWords() {
  window.localStorage.setItem("spellQuestKnownWords", JSON.stringify(Array.from(state.knownWords)));
}

function currentPracticeWord() {
  if (state.filteredWords.length === 0) {
    return null;
  }
  return state.filteredWords[state.currentIndex];
}

function isApprovedLearningContent(word) {
  return Boolean(word && word.contentReview && word.contentReview.status === "approved");
}

function approvedContexts(word) {
  if (!isApprovedLearningContent(word) || !Array.isArray(word.contexts)) {
    return [];
  }
  return word.contexts.filter((context) => {
    if (!context || context.reviewStatus !== "approved") {
      return false;
    }
    const requiredValues = [
      context.id,
      context.labelZh,
      context.labelZhuyin,
      context.sentence,
      context.sentenceZh,
      context.sentenceZhuyin,
      context.usageZh,
      context.usageZhuyin
    ];
    return requiredValues.every((value) => String(value || "").trim().length > 0);
  });
}

function activePracticeContext(word) {
  const contexts = approvedContexts(word);
  if (contexts.length === 0) {
    return null;
  }
  if (state.activeContextIndex < 0 || state.activeContextIndex >= contexts.length) {
    state.activeContextIndex = 0;
  }
  return contexts[state.activeContextIndex];
}

function setHidden(element, hidden) {
  if (element) {
    element.classList.toggle("hidden", hidden);
  }
}

function setText(element, text) {
  if (element) {
    element.textContent = text;
  }
}

function contextAudioClipType(context, target) {
  return context ? `context-${context.id}-${target}` : "usage";
}

function buildTopicFilter() {
  const topics = [];
  state.words.forEach((word) => {
    const exists = topics.some((item) => item.topic === word.topic);
    if (!exists) {
      topics.push({ topic: word.topic, label: topicLabel(word) });
    }
  });
  topics.sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));
  topics.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.topic;
    option.textContent = item.topic;
    elements.topicFilter.appendChild(option);
  });
}

function isInputExamDifficulty() {
  return state.examDifficulty === "medium" || state.examDifficulty === "high";
}

function updateExamDifficultyButtons() {
  elements.examDifficultyButtons.forEach((button) => {
    const active = button.dataset.examDifficulty === state.examDifficulty;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function examLockedIndexes(word) {
  const locked = new Set();
  if (state.examDifficulty === "medium" && word && word.word.length > 1) {
    locked.add(0);
    locked.add(word.word.length - 1);
  }
  return locked;
}

function initialExamLetters(word) {
  if (!isInputExamDifficulty() || !word) {
    return [];
  }
  const locked = examLockedIndexes(word);
  return word.word.split("").map((letter, index) => locked.has(index) ? letter : "");
}

function resetExamAnswerState() {
  if (!state.activeExamWord) {
    return;
  }
  state.selectedLetters = initialExamLetters(state.activeExamWord);
  elements.examFeedback.textContent = "";
  elements.examFeedback.className = "feedback";
  renderAnswerSlots();
  renderLetterBank();
}

function setExamDifficulty(difficulty) {
  if (!EXAM_DIFFICULTIES.includes(difficulty)) {
    return;
  }
  state.examDifficulty = difficulty;
  updateExamDifficultyButtons();
  resetExamAnswerState();
}

function getExamAnswer() {
  return state.selectedLetters.join("");
}

function isAsciiLetter(character) {
  const code = String(character || "").charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function normalizeExamLetter(value) {
  for (const character of String(value || "")) {
    if (isAsciiLetter(character)) {
      return character.toLowerCase();
    }
  }
  return "";
}

function nextEditableExamIndex(startIndex, direction) {
  if (!state.activeExamWord) {
    return -1;
  }
  const locked = examLockedIndexes(state.activeExamWord);
  let index = startIndex + direction;
  while (index >= 0 && index < state.activeExamWord.word.length) {
    if (!locked.has(index)) {
      return index;
    }
    index += direction;
  }
  return -1;
}

function focusExamInput(index) {
  const input = elements.answerSlots.querySelector(`[data-index="${index}"]`);
  if (input && typeof input.focus === "function") {
    input.focus();
    if (typeof input.select === "function") {
      input.select();
    }
  }
}

function handleExamInput(input) {
  const index = Number(input.dataset.index);
  const locked = examLockedIndexes(state.activeExamWord);
  if (locked.has(index)) {
    input.value = state.selectedLetters[index].toUpperCase();
    return;
  }
  const letter = normalizeExamLetter(input.value);
  state.selectedLetters[index] = letter;
  input.value = letter.toUpperCase();
  if (letter) {
    const nextIndex = nextEditableExamIndex(index, 1);
    if (nextIndex >= 0) {
      focusExamInput(nextIndex);
    }
  }
}

function handleExamInputKeydown(event, input) {
  const index = Number(input.dataset.index);
  if (event.key === "Backspace" && !input.value) {
    const previousIndex = nextEditableExamIndex(index, -1);
    if (previousIndex >= 0) {
      state.selectedLetters[previousIndex] = "";
      renderAnswerSlots();
      focusExamInput(previousIndex);
      event.preventDefault();
    }
    return;
  }
  if (event.key === "ArrowLeft") {
    const previousIndex = nextEditableExamIndex(index, -1);
    if (previousIndex >= 0) {
      focusExamInput(previousIndex);
      event.preventDefault();
    }
    return;
  }
  if (event.key === "ArrowRight") {
    const nextIndex = nextEditableExamIndex(index, 1);
    if (nextIndex >= 0) {
      focusExamInput(nextIndex);
      event.preventDefault();
    }
  }
}

function wordInitial(word) {
  return String(word.word || "").trim().charAt(0).toUpperCase();
}

function buildInitialFilter() {
  if (!elements.initialFilter) {
    return;
  }
  FIRST_LETTERS.forEach((letter) => {
    const count = state.words.filter((word) => wordInitial(word) === letter).length;
    if (count === 0) {
      return;
    }
    const option = document.createElement("option");
    option.value = letter;
    option.textContent = `${letter} (${count})`;
    elements.initialFilter.appendChild(option);
  });
}

function availableInitialLetters() {
  return FIRST_LETTERS.filter((letter) =>
    state.words.some((word) => wordInitial(word) === letter)
  );
}

function selectAllExamInitials() {
  state.selectedExamInitials = new Set(availableInitialLetters());
}

function selectedExamInitialList() {
  return FIRST_LETTERS.filter((letter) => state.selectedExamInitials.has(letter));
}

function customExamInitialsAreAllSelected() {
  const available = availableInitialLetters();
  return available.length > 0 &&
    available.every((letter) => state.selectedExamInitials.has(letter)) &&
    state.selectedExamInitials.size === available.length;
}

function ensureCustomExamInitials() {
  if (state.selectedExamInitials.size > 0) {
    return;
  }
  const initial = elements.initialFilter ? elements.initialFilter.value : "all";
  if (initial !== "all") {
    state.selectedExamInitials = new Set([initial]);
    return;
  }
  selectAllExamInitials();
}

function wordMatchesBaseExamFilters(word) {
  const needle = normalizeText(elements.searchInput.value);
  const level = elements.levelFilter.value;
  const topic = elements.topicFilter.value;
  const levelOk = level === "all" || word.level === level;
  const topicOk = topic === "all" || word.topic === topic;
  const searchOk = needle.length === 0 ||
    includesText(word.word, needle) ||
    includesText(word.zh, needle) ||
    includesText(word.source, needle) ||
    includesText(word.topic, needle) ||
    includesText(word.topicZh, needle);
  return levelOk && topicOk && searchOk;
}

function wordMatchesExamInitials(word) {
  if (state.examInitialMode === "custom") {
    ensureCustomExamInitials();
    return state.selectedExamInitials.has(wordInitial(word));
  }
  const initial = elements.initialFilter ? elements.initialFilter.value : "all";
  return initial === "all" || wordInitial(word) === initial;
}

function examCandidateWords() {
  return state.words.filter((word) =>
    wordMatchesBaseExamFilters(word) && wordMatchesExamInitials(word)
  );
}

function examInitialSummaryCount() {
  return examCandidateWords().length;
}

function buildExamInitialScope() {
  if (!elements.examInitialScope) {
    return;
  }
  elements.examInitialScope.innerHTML = "";
  elements.examInitialModeButtons = [];
  elements.examInitialLetterButtons = [];

  const topLine = document.createElement("div");
  topLine.className = "exam-scope-topline";

  const label = document.createElement("p");
  label.className = "exam-scope-label";
  appendBpmfPairs(label, EXAM_INITIAL_LABEL_PAIRS.scopeTitle, "bpmf-label");
  topLine.appendChild(label);

  const modeGroup = document.createElement("div");
  modeGroup.className = "exam-scope-mode";
  modeGroup.setAttribute("role", "group");
  modeGroup.setAttribute("aria-label", "Exam initial mode");
  [
    { mode: "single", labelPairs: EXAM_INITIAL_LABEL_PAIRS.single },
    { mode: "custom", labelPairs: EXAM_INITIAL_LABEL_PAIRS.custom }
  ].forEach((item) => {
    const button = document.createElement("button");
    button.className = "scope-mode-button";
    button.type = "button";
    button.dataset.examInitialMode = item.mode;
    appendBpmfPairs(button, item.labelPairs, "bpmf-button");
    button.addEventListener("click", () => setExamInitialMode(item.mode));
    modeGroup.appendChild(button);
    elements.examInitialModeButtons.push(button);
  });
  topLine.appendChild(modeGroup);
  elements.examInitialScope.appendChild(topLine);

  const picker = document.createElement("div");
  picker.className = "exam-initial-picker";
  picker.setAttribute("role", "group");
  picker.setAttribute("aria-label", "Custom exam initials");
  const pickerLabel = document.createElement("span");
  pickerLabel.className = "exam-picker-label";
  appendBpmfPairs(pickerLabel, EXAM_INITIAL_LABEL_PAIRS.customInitials, "bpmf-label");
  picker.appendChild(pickerLabel);
  availableInitialLetters().forEach((letter) => {
    const button = document.createElement("button");
    button.className = "exam-initial-button";
    button.type = "button";
    button.dataset.examInitial = letter;
    button.textContent = letter;
    button.addEventListener("click", () => toggleExamInitial(letter));
    picker.appendChild(button);
    elements.examInitialLetterButtons.push(button);
  });
  elements.examInitialPicker = picker;
  elements.examInitialScope.appendChild(picker);

  const summary = document.createElement("p");
  summary.className = "exam-initial-summary";
  elements.examInitialSummary = summary;
  elements.examInitialScope.appendChild(summary);
  renderExamInitialScope();
}

function renderExamInitialScope() {
  if (!elements.examInitialScope || !elements.examInitialSummary) {
    return;
  }
  elements.examInitialModeButtons.forEach((button) => {
    const active = button.dataset.examInitialMode === state.examInitialMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  if (elements.examInitialPicker) {
    elements.examInitialPicker.classList.toggle("hidden", state.examInitialMode !== "custom");
  }
  elements.examInitialLetterButtons.forEach((button) => {
    const active = state.selectedExamInitials.has(button.dataset.examInitial);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  renderExamInitialSummary();
}

function renderExamInitialSummary() {
  if (!elements.examInitialSummary) {
    return;
  }
  elements.examInitialSummary.innerHTML = "";
  appendBpmfPairs(elements.examInitialSummary, EXAM_INITIAL_LABEL_PAIRS.questionScope, "bpmf-label");
  appendPlain(elements.examInitialSummary, "：");
  if (state.examInitialMode === "custom") {
    ensureCustomExamInitials();
    const selected = selectedExamInitialList();
    if (selected.length === 0) {
      appendBpmfPairs(elements.examInitialSummary, EXAM_INITIAL_LABEL_PAIRS.chooseOne, "bpmf-label");
      return;
    }
    appendBpmfPairs(elements.examInitialSummary, EXAM_INITIAL_LABEL_PAIRS.selected, "bpmf-label");
    appendPlain(elements.examInitialSummary, ` ${selected.join(" + ")}，`);
  } else {
    const initial = elements.initialFilter ? elements.initialFilter.value : "all";
    appendPlain(elements.examInitialSummary, ` ${initial === "all" ? "All" : initial}，`);
  }
  appendBpmfPairs(elements.examInitialSummary, EXAM_INITIAL_LABEL_PAIRS.total, "bpmf-label");
  appendPlain(elements.examInitialSummary, ` ${examInitialSummaryCount()} `);
  appendBpmfPairs(elements.examInitialSummary, EXAM_INITIAL_LABEL_PAIRS.words, "bpmf-label");
  if (examInitialSummaryCount() === 0) {
    appendPlain(elements.examInitialSummary, " · ");
    appendBpmfPairs(elements.examInitialSummary, EXAM_INITIAL_LABEL_PAIRS.noItems, "bpmf-label");
  }
}

function setExamInitialMode(mode, options = {}) {
  if (mode !== "single" && mode !== "custom") {
    return;
  }
  state.examInitialMode = mode;
  if (mode === "custom") {
    ensureCustomExamInitials();
  }
  renderExamInitialScope();
  if (isExamModeActive() && !options.skipExamRefresh) {
    startExam();
  }
}

function toggleExamInitial(letter) {
  if (!availableInitialLetters().includes(letter)) {
    return;
  }
  ensureCustomExamInitials();
  if (state.selectedExamInitials.has(letter)) {
    if (state.selectedExamInitials.size <= 1) {
      renderExamInitialScope();
      return;
    }
    state.selectedExamInitials.delete(letter);
  } else {
    state.selectedExamInitials.add(letter);
  }
  renderExamInitialScope();
  if (isExamModeActive()) {
    startExam();
  }
}

function setCustomExamInitials(letters, options = {}) {
  const available = availableInitialLetters();
  const selected = letters.filter((letter) => available.includes(letter));
  if (selected.length === 0) {
    return;
  }
  state.selectedExamInitials = new Set(selected);
  state.examInitialMode = "custom";
  renderExamInitialScope();
  if (isExamModeActive() && !options.skipExamRefresh) {
    startExam();
  }
}

function hasActiveWordFilter() {
  const needle = normalizeText(elements.searchInput.value);
  const level = elements.levelFilter.value;
  const topic = elements.topicFilter.value;
  const initial = elements.initialFilter ? elements.initialFilter.value : "all";
  return needle.length > 0 || level !== "all" || topic !== "all" || initial !== "all";
}

function currentFilterSignature() {
  const needle = normalizeText(elements.searchInput.value);
  const level = elements.levelFilter.value;
  const topic = elements.topicFilter.value;
  const initial = elements.initialFilter ? elements.initialFilter.value : "all";
  return [needle, initial, level, topic].join("|");
}

function isExamModeActive() {
  return elements.examView.classList.contains("active");
}

function renderFilterStatus() {
  if (!elements.filterStatus) {
    return;
  }
  elements.filterStatus.innerHTML = "";
  if (state.filteredWords.length === 0) {
    appendBpmfPairs(elements.filterStatus, LABEL_PAIRS.noMatchingWords);
    return;
  }
  appendBpmfPairs(elements.filterStatus, LABEL_PAIRS.matching);
  appendPlain(elements.filterStatus, ` ${state.filteredWords.length} / ${state.words.length} `);
  appendBpmfPairs(elements.filterStatus, LABEL_PAIRS.wordsUnit);
  if (hasActiveWordFilter()) {
    appendPlain(elements.filterStatus, " · ");
    appendBpmfPairs(elements.filterStatus, LABEL_PAIRS.filterActive);
  }
}

function filterWords(options = {}) {
  const signature = currentFilterSignature();
  const filterChanged = signature !== state.filterSignature;
  state.filterSignature = signature;
  const needle = normalizeText(elements.searchInput.value);
  const level = elements.levelFilter.value;
  const topic = elements.topicFilter.value;
  const initial = elements.initialFilter ? elements.initialFilter.value : "all";
  if (filterChanged || options.resetIndex) {
    state.currentIndex = 0;
  }
  state.filteredWords = state.words.filter((word) => {
    const levelOk = level === "all" || word.level === level;
    const topicOk = topic === "all" || word.topic === topic;
    const initialOk = initial === "all" || wordInitial(word) === initial;
    const searchOk = needle.length === 0 ||
      includesText(word.word, needle) ||
      includesText(word.zh, needle) ||
      includesText(word.source, needle) ||
      includesText(word.topic, needle) ||
      includesText(word.topicZh, needle);
    return levelOk && topicOk && initialOk && searchOk;
  });
  if (state.filteredWords.length === 0) {
    state.currentIndex = 0;
    renderEmptyPractice();
    updateStats();
    renderFilterStatus();
    renderExamInitialScope();
    return;
  }
  if (state.currentIndex >= state.filteredWords.length) {
    state.currentIndex = 0;
  }
  renderPracticeCard();
  updateStats();
  renderFilterStatus();
  renderExamInitialScope();
  if (filterChanged && isExamModeActive() && !options.skipExamRefresh) {
    startExam();
  }
}

function clearFilters() {
  elements.searchInput.value = "";
  if (elements.initialFilter) {
    elements.initialFilter.value = "all";
  }
  elements.levelFilter.value = "all";
  elements.topicFilter.value = "all";
  if (state.examInitialMode === "custom") {
    selectAllExamInitials();
  }
  filterWords({ resetIndex: true });
}

function shuffleFilteredWords() {
  if (state.filteredWords.length <= 1) {
    renderFilterStatus();
    return;
  }
  const before = currentPracticeWord();
  let shuffled = state.filteredWords;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    shuffled = shuffleArray(state.filteredWords);
    if (!before || shuffled[0].id !== before.id) {
      break;
    }
  }
  state.filteredWords = shuffled;
  state.currentIndex = 0;
  renderPracticeCard();
  updateStats();
  renderFilterStatus();
  if (isExamModeActive()) {
    startExam();
  }
}

function updateStats() {
  elements.totalWords.textContent = String(state.words.length);
  elements.knownWords.textContent = String(state.knownWords.size);
  const starCount = state.words.filter((word) => word.starred).length;
  elements.starWords.textContent = String(starCount);
}

function renderEmptyPractice() {
  elements.wordSource.textContent = "No source";
  elements.wordLevel.textContent = "No level";
  elements.wordStar.classList.add("hidden");
  elements.wordText.textContent = "No words";
  elements.wordPos.textContent = "";
  renderBpmfPairs(elements.meaningText, LABEL_PAIRS.noMatchingWords, "bpmf-meaning");
  elements.topicText.textContent = "";
  elements.exampleText.textContent = "";
  setText(elements.exampleZhText, "");
  setText(elements.exampleZhuyinText, "");
  elements.exampleZhHint.textContent = "";
  if (elements.contextTabs) {
    elements.contextTabs.innerHTML = "";
  }
  setHidden(elements.contextTabs, true);
  elements.usageText.textContent = "";
  setText(elements.contextZhText, "");
  setText(elements.contextZhuyinText, "");
  elements.usageZhHint.textContent = "";
  setText(elements.contextUsageZhuyin, "");
  elements.practiceLetters.innerHTML = "";
}

function renderExampleDetails(word) {
  elements.exampleText.textContent = word.example;
  if (isApprovedLearningContent(word) && word.exampleZh && word.exampleZhuyin && isZhuyinPairs(word.exampleZhPairs)) {
    renderLabelAndPhrase(elements.exampleZhText, LABEL_PAIRS.translation, word.exampleZhPairs, "中文翻譯", word.exampleZh, word.exampleZhuyin);
    setText(elements.exampleZhuyinText, "");
    renderLabelAndPhrase(elements.exampleZhHint, LABEL_PAIRS.learningFocus, word.topicZhPairs, "學習重點", word.topicZh, word.topicZhuyin);
    setHidden(elements.exampleZhText, false);
    setHidden(elements.exampleZhuyinText, true);
    return;
  }
  setText(elements.exampleZhText, "");
  setText(elements.exampleZhuyinText, "");
  setHidden(elements.exampleZhText, true);
  setHidden(elements.exampleZhuyinText, true);
  elements.exampleZhHint.innerHTML = "";
  appendBpmfPairs(elements.exampleZhHint, LABEL_PAIRS.chineseHint, "bpmf-label");
  appendPlain(elements.exampleZhHint, "：");
  appendBpmfPairs(elements.exampleZhHint, word.zhPairs, "bpmf-content");
  appendPlain(elements.exampleZhHint, " · ");
  appendBpmfPairs(elements.exampleZhHint, LABEL_PAIRS.topic, "bpmf-label");
  appendPlain(elements.exampleZhHint, "：");
  appendBpmfPairs(elements.exampleZhHint, word.topicZhPairs, "bpmf-content");
}

function renderContextTabs(word) {
  const contexts = approvedContexts(word);
  if (!elements.contextTabs) {
    return;
  }
  elements.contextTabs.innerHTML = "";
  if (contexts.length === 0) {
    setHidden(elements.contextTabs, true);
    return;
  }
  if (state.activeContextIndex >= contexts.length) {
    state.activeContextIndex = 0;
  }
  setHidden(elements.contextTabs, false);
  contexts.forEach((context, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "context-tab";
    button.classList.toggle("active", index === state.activeContextIndex);
    button.setAttribute("aria-pressed", index === state.activeContextIndex ? "true" : "false");
    if (isZhuyinPairs(context.labelZhPairs)) {
      button.appendChild(createZhuyinPhrase(context.labelZhPairs, "bpmf-tab"));
    } else {
      button.appendChild(createZhuyinPhrase(pairsFromTextAndZhuyin(context.labelZh, context.labelZhuyin), "bpmf-tab"));
    }
    button.addEventListener("click", () => {
      state.activeContextIndex = index;
      renderContextTabs(word);
      renderPracticeContext(word);
    });
    elements.contextTabs.appendChild(button);
  });
}

function renderPracticeContext(word) {
  const context = activePracticeContext(word);
  if (context && isZhuyinPairs(context.sentenceZhPairs) && isZhuyinPairs(context.usageZhPairs)) {
    elements.usageText.textContent = context.sentence;
    renderLabelAndPhrase(elements.contextZhText, LABEL_PAIRS.translation, context.sentenceZhPairs, "中文翻譯", context.sentenceZh, context.sentenceZhuyin);
    setText(elements.contextZhuyinText, "");
    renderLabelAndPhrase(elements.usageZhHint, LABEL_PAIRS.usageTask, context.usageZhPairs, "應用任務", context.usageZh, context.usageZhuyin);
    setText(elements.contextUsageZhuyin, "");
    setHidden(elements.contextZhText, false);
    setHidden(elements.contextZhuyinText, true);
    setHidden(elements.contextUsageZhuyin, true);
    return;
  }
  elements.usageText.textContent = word.usage;
  setText(elements.contextZhText, "");
  setText(elements.contextZhuyinText, "");
  setHidden(elements.contextZhText, true);
  setHidden(elements.contextZhuyinText, true);
  elements.usageZhHint.innerHTML = "";
  appendBpmfPairs(elements.usageZhHint, LABEL_PAIRS.chineseTask, "bpmf-label");
  appendPlain(elements.usageZhHint, "：");
  appendBpmfPairs(elements.usageZhHint, LABEL_PAIRS.use, "bpmf-content");
  appendPlain(elements.usageZhHint, ` ${word.word} `);
  appendBpmfPairs(elements.usageZhHint, LABEL_PAIRS.express, "bpmf-content");
  appendPlain(elements.usageZhHint, "「");
  appendBpmfPairs(elements.usageZhHint, word.zhPairs, "bpmf-content");
  appendPlain(elements.usageZhHint, "」");
  appendBpmfPairs(elements.usageZhHint, LABEL_PAIRS.thisConcept, "bpmf-content");
  appendPlain(elements.usageZhHint, "。");
  setText(elements.contextUsageZhuyin, "");
  setHidden(elements.contextUsageZhuyin, true);
}

function renderPracticeCard() {
  const word = currentPracticeWord();
  if (!word) {
    renderEmptyPractice();
    return;
  }
  state.activeContextIndex = 0;
  elements.wordSource.textContent = word.source;
  elements.wordLevel.textContent = word.level;
  elements.wordStar.classList.toggle("hidden", !word.starred);
  elements.wordText.textContent = word.word;
  elements.wordPos.textContent = word.pos;
  renderZhuyinPhrase(elements.meaningText, word.zhPairs, word.zh, word.zhuyin, "bpmf-meaning");
  renderZhuyinPhrase(elements.topicText, word.topicZhPairs, word.topicZh, word.topicZhuyin, "bpmf-topic");
  renderExampleDetails(word);
  renderContextTabs(word);
  renderPracticeContext(word);
  renderPracticeLetters(word.word);
  updateKnownButton(word);
  preloadPracticeAudio(word);
}

function renderPracticeLetters(wordText) {
  elements.practiceLetters.innerHTML = "";
  wordText.split("").forEach((letter) => {
    const span = document.createElement("span");
    span.textContent = letter.toUpperCase();
    elements.practiceLetters.appendChild(span);
  });
}

function updateKnownButton(word) {
  const isKnown = state.knownWords.has(word.id);
  renderBpmfPairs(elements.knownButton, isKnown ? LABEL_PAIRS.cancelKnown : LABEL_PAIRS.markKnown);
}

function movePractice(step) {
  if (state.filteredWords.length === 0) {
    return;
  }
  const count = state.filteredWords.length;
  state.currentIndex = (state.currentIndex + step + count) % count;
  renderPracticeCard();
}

function shuffleArray(items) {
  const output = items.slice();
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = output[index];
    output[index] = output[swapIndex];
    output[swapIndex] = current;
  }
  return output;
}

function refreshSpeechVoices() {
  if (!window.speechSynthesis) {
    return [];
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    state.speechVoices = voices;
  }
  return state.speechVoices;
}

function selectSpeechVoice(lang) {
  const voices = refreshSpeechVoices();
  if (voices.length === 0) {
    return null;
  }
  const targetLang = (lang || "").toLowerCase();
  const targetPrefix = targetLang.split("-")[0];
  const hints = targetPrefix === "zh" ? CHINESE_VOICE_HINTS : ENGLISH_VOICE_HINTS;
  for (const hint of hints) {
    const matchedVoice = voices.find((voice) => voice.name.toLowerCase().includes(hint));
    if (matchedVoice) {
      return matchedVoice;
    }
  }
  const exactLocalVoice = voices.find((voice) => voice.localService && voice.lang.toLowerCase() === targetLang);
  if (exactLocalVoice) {
    return exactLocalVoice;
  }
  const exactVoice = voices.find((voice) => voice.lang.toLowerCase() === targetLang);
  if (exactVoice) {
    return exactVoice;
  }
  const prefixLocalVoice = voices.find((voice) => voice.localService && voice.lang.toLowerCase().startsWith(targetPrefix));
  if (prefixLocalVoice) {
    return prefixLocalVoice;
  }
  return voices.find((voice) => voice.lang.toLowerCase().startsWith(targetPrefix)) || null;
}

function isAndroidChrome() {
  const ua = navigator.userAgent || "";
  return ua.includes("Android") &&
    ua.includes("Chrome") &&
    !ua.includes("Edg") &&
    !ua.includes("OPR") &&
    !ua.includes("SamsungBrowser");
}

function canStartSpeechRequest() {
  if (!isAndroidChrome()) {
    return true;
  }
  const now = typeof performance === "object" && typeof performance.now === "function" ? performance.now() : Date.now();
  if (now - state.lastSpeechRequestAt < SPEECH_SETTINGS.androidSpeechThrottleMs) {
    return false;
  }
  state.lastSpeechRequestAt = now;
  return true;
}

function primeSpeechEngine() {
  if (!window.speechSynthesis) {
    return;
  }
  refreshSpeechVoices();
  window.speechSynthesis.resume();
}

function stopSpeechPlayback() {
  state.speechToken += 1;
  state.speechActive = false;
  if (!window.speechSynthesis) {
    return;
  }
  if (isAndroidChrome()) {
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    return;
  }
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending || window.speechSynthesis.paused) {
    window.speechSynthesis.cancel();
  }
  window.speechSynthesis.resume();
}

function initSpeechEngine() {
  if (!window.speechSynthesis) {
    return;
  }
  refreshSpeechVoices();
  window.speechSynthesis.addEventListener("voiceschanged", refreshSpeechVoices);
  const primeOnce = () => primeSpeechEngine();
  window.addEventListener("pointerdown", primeOnce, { once: true });
  window.addEventListener("keydown", primeOnce, { once: true });
  window.addEventListener("touchstart", primeOnce, { once: true });
}

function speakText(text, lang, rate, options = {}) {
  if (!window.speechSynthesis || !text) {
    return false;
  }
  if (!options.skipThrottle && !canStartSpeechRequest()) {
    return false;
  }
  stopActiveAudio();
  stopSpeechPlayback();
  const speechToken = state.speechToken;
  const speechText = String(text).trim();
  if (!speechText) {
    return false;
  }
  const speakNow = () => {
    if (speechToken !== state.speechToken) {
      return;
    }
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = SPEECH_SETTINGS.pitch;
    utterance.volume = SPEECH_SETTINGS.volume;
    const voice = selectSpeechVoice(lang);
    if (voice) {
      utterance.voice = voice;
    }
    utterance.onstart = () => {
      if (speechToken === state.speechToken) {
        state.speechActive = true;
      }
    };
    const finishSpeech = () => {
      if (speechToken === state.speechToken) {
        state.speechActive = false;
      }
    };
    utterance.onend = finishSpeech;
    utterance.onerror = finishSpeech;
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  };
  window.setTimeout(speakNow, SPEECH_SETTINGS.speechStartDelayMs);
  return true;
}

function audioClipEntry(word, clipType) {
  if (!word || !state.audioManifest || !state.audioManifest.clips) {
    return null;
  }
  const wordClips = state.audioManifest.clips[word.id];
  if (!wordClips || !wordClips[clipType] || !wordClips[clipType].path) {
    return null;
  }
  return wordClips[clipType];
}

function rememberPreloadedAudio(path, audio) {
  if (state.preloadedAudio.has(path)) {
    return;
  }
  state.preloadedAudio.set(path, audio);
  while (state.preloadedAudio.size > AUDIO_PRELOAD_LIMIT) {
    const oldestKey = state.preloadedAudio.keys().next().value;
    const oldestAudio = state.preloadedAudio.get(oldestKey);
    if (oldestAudio) {
      oldestAudio.pause();
      oldestAudio.removeAttribute("src");
    }
    state.preloadedAudio.delete(oldestKey);
  }
}

function preloadStaticAudio(path) {
  if (!path || state.preloadedAudio.has(path)) {
    return;
  }
  try {
    const audio = new Audio(path);
    audio.preload = "auto";
    audio.volume = SPEECH_SETTINGS.volume;
    audio.load();
    rememberPreloadedAudio(path, audio);
  } catch (error) {
    console.warn(`Audio preload skipped: ${path}`);
  }
}

function preloadAudioClip(word, clipType) {
  const clip = audioClipEntry(word, clipType);
  if (clip && clip.path) {
    preloadStaticAudio(clip.path);
  }
}

function expectedAudioClipTypes(word) {
  if (!word) {
    return [];
  }
  const clipTypes = ["word", "example", "meaningZh", "topicZh", "exampleZh", "examHintZh"];
  const contexts = approvedContexts(word);
  if (contexts.length > 0) {
    contexts.forEach((context) => {
      clipTypes.push(contextAudioClipType(context, "en"));
      clipTypes.push(contextAudioClipType(context, "zh"));
    });
  } else {
    clipTypes.push("usage");
    clipTypes.push("usageZh");
  }
  return clipTypes;
}

function preloadPracticeAudio(word) {
  expectedAudioClipTypes(word).forEach((clipType) => preloadAudioClip(word, clipType));
}

function preloadExamAudio(word) {
  preloadAudioClip(word, "word");
  preloadAudioClip(word, "examHintZh");
}

function createStaticAudio(path) {
  const preloadedAudio = state.preloadedAudio.get(path);
  if (preloadedAudio) {
    state.preloadedAudio.delete(path);
    return preloadedAudio;
  }
  return new Audio(path);
}

function stopActiveAudio() {
  if (state.activeAudio) {
    state.activeAudio.pause();
    state.activeAudio.currentTime = 0;
    state.activeAudio = null;
  }
}

function playStaticAudio(path, options = {}) {
  return new Promise((resolve) => {
    if (!options.skipThrottle && !canStartSpeechRequest()) {
      resolve(false);
      return;
    }
    stopActiveAudio();
    stopSpeechPlayback();
    const audio = createStaticAudio(path);
    state.activeAudio = audio;
    audio.preload = "auto";
    audio.volume = SPEECH_SETTINGS.volume;
    let settled = false;
    let started = false;
    const finish = (played) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(startTimer);
      if (state.activeAudio === audio) {
        state.activeAudio = null;
      }
      resolve(played);
    };
    const startTimer = window.setTimeout(() => {
      if (!started) {
        audio.pause();
        finish(false);
      }
    }, SPEECH_SETTINGS.clipStartTimeoutMs);
    audio.onplaying = () => {
      started = true;
      window.clearTimeout(startTimer);
    };
    audio.onended = () => finish(true);
    audio.onerror = () => finish(false);
    audio.load();
    const playResult = audio.play();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch(() => finish(false));
    }
  });
}

async function speakClip(word, clipType, fallbackText, lang, rate) {
  if (!canStartSpeechRequest()) {
    return false;
  }
  const clip = audioClipEntry(word, clipType);
  if (clip) {
    const played = await playStaticAudio(clip.path, { skipThrottle: true });
    if (played) {
      return true;
    }
  }
  stopActiveAudio();
  return speakText(fallbackText, lang, rate, { skipThrottle: true });
}

function speakEnglish(text) {
  return speakText(text, "en-US", 0.82);
}

function speakChinese(text) {
  return speakText(text, "zh-TW", 0.92);
}

function speakWordAudio(word) {
  return speakClip(word, "word", word.word, "en-US", 0.82);
}

function speakExampleAudio(word) {
  return speakClip(word, "example", word.example, "en-US", 0.86);
}

function speakUsageAudio(word) {
  const context = activePracticeContext(word);
  if (context) {
    return speakClip(word, contextAudioClipType(context, "en"), context.sentence, "en-US", 0.88);
  }
  return speakClip(word, "usage", word.usage, "en-US", 0.88);
}

function speakMeaningAudio(word) {
  return speakClip(word, "meaningZh", `意思。${word.zh}`, "zh-TW", 0.92);
}

function speakTopicAudio(word) {
  return speakClip(word, "topicZh", `情境。${word.topicZh}`, "zh-TW", 0.92);
}

function speakExampleZhAudio(word) {
  return speakClip(word, "exampleZh", exampleChineseSpeech(word), "zh-TW", 0.92);
}

function speakUsageZhAudio(word) {
  const context = activePracticeContext(word);
  const clipType = context ? contextAudioClipType(context, "zh") : "usageZh";
  return speakClip(word, clipType, usageChineseSpeech(word), "zh-TW", 0.92);
}

function speakExamHintAudio(word) {
  return speakClip(word, "examHintZh", examHintChineseSpeech(word), "zh-TW", 0.92);
}

function exampleChineseSpeech(word) {
  if (isApprovedLearningContent(word) && word.exampleZh) {
    return `英文例句中文翻譯。${word.exampleZh}`;
  }
  return `英文例句。單字是 ${word.word}，中文意思是 ${word.zh}，主題是 ${word.topicZh}。請聽英文句子：${word.example}`;
}

function usageChineseSpeech(word) {
  const context = activePracticeContext(word);
  if (context) {
    return `應用任務。${context.usageZh}。中文翻譯。${context.sentenceZh}`;
  }
  return `應用任務。請用 ${word.word} 表達 ${word.zh} 這個概念。`;
}

function examHintChineseSpeech(word) {
  return `提示。中文意思是 ${word.zh}。主題是 ${word.topicZh}。詞性是 ${word.pos}。`;
}

function examCardElement() {
  return elements.examView ? elements.examView.querySelector(".exam-card") : null;
}

function clearExamRecord() {
  state.examAnsweredCount = 0;
  state.examCorrectCount = 0;
  state.examStreak = 0;
  state.examAnswerChecked = false;
  state.examCompleted = false;
}

function examAwardLevel() {
  if (state.examCorrectCount >= 30) {
    return "gold";
  }
  if (state.examCorrectCount >= 20) {
    return "silver";
  }
  if (state.examCorrectCount >= 10) {
    return "bronze";
  }
  return "";
}

function awardLabelPairs(level) {
  if (level === "gold") {
    return EXAM_SESSION_LABEL_PAIRS.goldMedal;
  }
  if (level === "silver") {
    return EXAM_SESSION_LABEL_PAIRS.silverMedal;
  }
  if (level === "bronze") {
    return EXAM_SESSION_LABEL_PAIRS.bronzeMedal;
  }
  return [];
}

function renderExamAward() {
  const card = examCardElement();
  const level = examAwardLevel();
  if (card) {
    card.classList.toggle("award-bronze", level === "bronze");
    card.classList.toggle("award-silver", level === "silver");
    card.classList.toggle("award-gold", level === "gold");
  }
  if (!elements.examMedal) {
    return;
  }
  elements.examMedal.classList.toggle("hidden", !level);
  elements.examMedal.classList.toggle("bronze", level === "bronze");
  elements.examMedal.classList.toggle("silver", level === "silver");
  elements.examMedal.classList.toggle("gold", level === "gold");
  elements.examMedal.innerHTML = "";
  if (level) {
    elements.examMedal.setAttribute("aria-hidden", "false");
    appendBpmfPairs(elements.examMedal, awardLabelPairs(level), "bpmf-medal");
  } else {
    elements.examMedal.setAttribute("aria-hidden", "true");
  }
}

function renderExamSessionPanel() {
  if (!elements.examSessionPanel) {
    return;
  }
  const title = elements.examSessionPanel.querySelector(".exam-session-title");
  const answeredLabel = elements.examSessionPanel.querySelector(".session-label.answered");
  const correctLabel = elements.examSessionPanel.querySelector(".session-label.correct");
  const answeredUnit = elements.examSessionPanel.querySelector(".session-unit.answered");
  const correctUnit = elements.examSessionPanel.querySelector(".session-unit.correct");
  renderBpmfPairs(title, EXAM_SESSION_LABEL_PAIRS.sessionTitle, "bpmf-label");
  renderBpmfPairs(answeredLabel, EXAM_SESSION_LABEL_PAIRS.answered, "bpmf-label");
  renderBpmfPairs(correctLabel, EXAM_SESSION_LABEL_PAIRS.correct, "bpmf-label");
  renderBpmfPairs(answeredUnit, EXAM_SESSION_LABEL_PAIRS.questions, "bpmf-label");
  renderBpmfPairs(correctUnit, EXAM_SESSION_LABEL_PAIRS.questions, "bpmf-label");
  if (elements.examAnsweredCount) {
    elements.examAnsweredCount.textContent = String(state.examAnsweredCount);
  }
  if (elements.examCorrectCount) {
    elements.examCorrectCount.textContent = String(state.examCorrectCount);
  }
  if (elements.resetExamSessionButton && elements.resetExamSessionButton.childNodes.length === 0) {
    appendBpmfPairs(elements.resetExamSessionButton, EXAM_SESSION_LABEL_PAIRS.resetThis, "bpmf-button");
  }
  renderExamAward();
}

function hideExamCelebration() {
  if (state.celebrationTimer) {
    window.clearTimeout(state.celebrationTimer);
    state.celebrationTimer = null;
  }
  if (elements.examCelebration) {
    elements.examCelebration.classList.add("hidden");
    elements.examCelebration.innerHTML = "";
  }
}

function playCelebrationSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    const context = state.celebrationAudioContext || new AudioContextClass();
    state.celebrationAudioContext = context;
    if (context.state === "suspended") {
      context.resume();
    }
    const now = context.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.11);
      gain.gain.setValueAtTime(0.0001, now + index * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.18, now + index * 0.11 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.11 + 0.36);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + index * 0.11);
      oscillator.stop(now + index * 0.11 + 0.38);
    });
  } catch (error) {
    console.warn("Celebration sound skipped.");
  }
}

function showExamCelebration(streak) {
  if (!elements.examCelebration) {
    playCelebrationSound();
    return;
  }
  hideExamCelebration();
  const burst = document.createElement("div");
  burst.className = "celebration-burst";
  for (let index = 0; index < 36; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.setProperty("--x", `${(index % 12) - 5.5}`);
    piece.style.setProperty("--delay", `${(index % 6) * 0.08}s`);
    piece.style.setProperty("--spin", `${index % 2 === 0 ? 1 : -1}`);
    burst.appendChild(piece);
  }
  const message = document.createElement("div");
  message.className = "celebration-message";
  appendBpmfPairs(message, EXAM_SESSION_LABEL_PAIRS.congrats, "bpmf-celebration");
  appendPlain(message, ` ${streak} `);
  appendBpmfPairs(message, EXAM_SESSION_LABEL_PAIRS.questions, "bpmf-celebration");
  appendPlain(message, "!");
  elements.examCelebration.appendChild(burst);
  elements.examCelebration.appendChild(message);
  elements.examCelebration.classList.remove("hidden");
  playCelebrationSound();
  state.celebrationTimer = window.setTimeout(hideExamCelebration, 5000);
}

function resetExamSession() {
  hideExamCelebration();
  clearExamRecord();
  startExam({ resetRecord: false });
}

function setMode(mode) {
  const practiceMode = mode === "practice";
  elements.practiceView.classList.toggle("active", practiceMode);
  elements.examView.classList.toggle("active", !practiceMode);
  elements.modeTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });
  if (!practiceMode && state.examWords.length === 0) {
    startExam();
  }
}

function databaseOnlyExamSource() {
  const source = examCandidateWords();
  return source.filter((word) => state.wordById.has(word.id));
}

function startExam(options = {}) {
  const source = databaseOnlyExamSource();
  state.examWords = shuffleArray(source);
  state.examIndex = 0;
  if (options.resetRecord !== false) {
    clearExamRecord();
  }
  renderExamSessionPanel();
  renderExamQuestion();
}

function renderExamQuestion() {
  if (state.examWords.length === 0) {
    state.activeExamWord = null;
    state.selectedLetters = [];
    elements.answerSlots.innerHTML = "";
    elements.letterBank.innerHTML = "";
    elements.examFeedback.textContent = "";
    elements.examFeedback.className = "feedback";
    renderBpmfPairs(elements.examHint, LABEL_PAIRS.noExamItems);
    renderExamSessionPanel();
    return;
  }
  if (state.examIndex >= state.examWords.length) {
    renderExamComplete();
    return;
  }
  state.activeExamWord = state.examWords[state.examIndex];
  if (!state.wordById.has(state.activeExamWord.id)) {
    throw new Error(`Exam word is not from database: ${state.activeExamWord.id}`);
  }
  state.examCompleted = false;
  state.examAnswerChecked = false;
  state.selectedLetters = initialExamLetters(state.activeExamWord);
  elements.examFeedback.textContent = "";
  elements.examFeedback.className = "feedback";
  renderExamHint(state.activeExamWord);
  renderAnswerSlots();
  renderLetterBank();
  preloadExamAudio(state.activeExamWord);
  if (!isAndroidChrome()) {
    window.setTimeout(() => speakWordAudio(state.activeExamWord), 180);
  }
}

function renderExamComplete() {
  state.examCompleted = true;
  state.activeExamWord = null;
  state.selectedLetters = [];
  elements.answerSlots.innerHTML = "";
  elements.letterBank.innerHTML = "";
  elements.examFeedback.innerHTML = "";
  appendBpmfPairs(elements.examFeedback, EXAM_SESSION_LABEL_PAIRS.completed, "bpmf-label");
  elements.examFeedback.className = "feedback good";
  renderBpmfPairs(elements.examHint, EXAM_SESSION_LABEL_PAIRS.completed);
  renderExamSessionPanel();
}

function renderAnswerSlots() {
  elements.answerSlots.innerHTML = "";
  const letters = state.activeExamWord.word.split("");
  const locked = examLockedIndexes(state.activeExamWord);
  letters.forEach((letter, index) => {
    const slot = document.createElement(isInputExamDifficulty() ? "input" : "div");
    slot.className = "answer-slot";
    if (isInputExamDifficulty()) {
      slot.classList.add("answer-input");
      slot.type = "text";
      slot.maxLength = 1;
      slot.inputMode = "text";
      slot.autocomplete = "off";
      slot.autocapitalize = "characters";
      slot.value = state.selectedLetters[index] ? state.selectedLetters[index].toUpperCase() : "";
      if (locked.has(index)) {
        slot.readOnly = true;
        slot.tabIndex = -1;
        slot.classList.add("locked");
      }
      slot.addEventListener("input", () => handleExamInput(slot));
      slot.addEventListener("keydown", (event) => handleExamInputKeydown(event, slot));
      slot.addEventListener("focus", () => slot.select());
    } else {
      slot.textContent = state.selectedLetters[index] || "";
    }
    slot.dataset.index = String(index);
    slot.setAttribute("aria-label", `Letter ${index + 1} of ${letters.length}`);
    elements.answerSlots.appendChild(slot);
  });
}

function renderLetterBank() {
  elements.letterBank.innerHTML = "";
  elements.letterBank.classList.toggle("hidden", isInputExamDifficulty());
  if (isInputExamDifficulty()) {
    return;
  }
  const letters = shuffleArray(state.activeExamWord.word.split(""));
  letters.forEach((letter, index) => {
    const button = document.createElement("button");
    button.className = "letter-tile";
    button.type = "button";
    button.textContent = letter.toUpperCase();
    button.dataset.letter = letter;
    button.dataset.tile = String(index);
    button.addEventListener("click", () => pickLetter(button));
    elements.letterBank.appendChild(button);
  });
}

function pickLetter(button) {
  if (isInputExamDifficulty() || button.disabled || !state.activeExamWord) {
    return;
  }
  if (state.selectedLetters.length >= state.activeExamWord.word.length) {
    return;
  }
  state.selectedLetters.push(button.dataset.letter);
  button.disabled = true;
  renderAnswerSlots();
}

function eraseLetter() {
  if (isInputExamDifficulty()) {
    const locked = examLockedIndexes(state.activeExamWord);
    for (let index = state.selectedLetters.length - 1; index >= 0; index -= 1) {
      if (!locked.has(index) && state.selectedLetters[index]) {
        state.selectedLetters[index] = "";
        renderAnswerSlots();
        focusExamInput(index);
        return;
      }
    }
    return;
  }
  if (state.selectedLetters.length === 0) {
    return;
  }
  const removed = state.selectedLetters[state.selectedLetters.length - 1];
  state.selectedLetters = state.selectedLetters.slice(0, state.selectedLetters.length - 1);
  const buttons = Array.from(elements.letterBank.querySelectorAll("button"));
  const target = buttons.find((button) => button.disabled && button.dataset.letter === removed);
  if (target) {
    target.disabled = false;
  }
  renderAnswerSlots();
}

function checkAnswer() {
  if (!state.activeExamWord) {
    return;
  }
  const answer = getExamAnswer();
  if (answer.length !== state.activeExamWord.word.length) {
    renderBpmfPairs(elements.examFeedback, LABEL_PAIRS.needMoreLetters);
    elements.examFeedback.className = "feedback warn";
    return false;
  }
  const correct = answer.toLowerCase() === state.activeExamWord.word.toLowerCase();
  if (!state.examAnswerChecked) {
    state.examAnsweredCount += 1;
    state.examAnswerChecked = true;
    if (correct) {
      state.examCorrectCount += 1;
      state.examStreak += 1;
      if (state.examStreak > 0 && state.examStreak % 5 === 0) {
        showExamCelebration(state.examStreak);
      }
    } else {
      state.examStreak = 0;
    }
    renderExamSessionPanel();
  }
  if (correct) {
    elements.examFeedback.innerHTML = "";
    appendBpmfPairs(elements.examFeedback, LABEL_PAIRS.correct, "bpmf-label");
    appendPlain(elements.examFeedback, `：${state.activeExamWord.word}`);
    elements.examFeedback.className = "feedback good";
    state.knownWords.add(state.activeExamWord.id);
    saveKnownWords();
    updateStats();
    return true;
  }
  elements.examFeedback.innerHTML = "";
  appendBpmfPairs(elements.examFeedback, LABEL_PAIRS.tryAgain, "bpmf-label");
  appendPlain(elements.examFeedback, `：${answer.toUpperCase()}`);
  elements.examFeedback.className = "feedback warn";
  return false;
}

function nextExamQuestion() {
  if (state.examWords.length === 0) {
    return;
  }
  state.examIndex += 1;
  if (state.examIndex >= state.examWords.length) {
    renderExamComplete();
    return;
  }
  renderExamQuestion();
}

function fillCorrectExamAnswerForSelfTest() {
  if (!state.activeExamWord) {
    return false;
  }
  if (isInputExamDifficulty()) {
    state.selectedLetters = state.activeExamWord.word.split("");
    renderAnswerSlots();
    return true;
  }
  const letters = state.activeExamWord.word.split("");
  let allPicked = true;
  letters.forEach((letter) => {
    const buttons = Array.from(elements.letterBank.querySelectorAll("button"));
    const target = buttons.find((button) => !button.disabled && button.dataset.letter.toLowerCase() === letter.toLowerCase());
    if (!target) {
      allPicked = false;
      return;
    }
    pickLetter(target);
  });
  return allPicked;
}

function practiceContextSelfTestPassed() {
  const word = currentPracticeWord();
  if (!word || word.id !== "D001") {
    return false;
  }
  const contextButtons = elements.contextTabs ? elements.contextTabs.querySelectorAll(".context-tab") : [];
  return approvedContexts(word).length >= 3 &&
    contextButtons.length >= 3 &&
    pairText(word.exampleZhPairs) === "我每天在上課前做拼字暖身練習。" &&
    elements.exampleZhText.querySelectorAll(".bpmf-unit").length >= 10 &&
    elements.usageText.textContent.includes("daily") &&
    pairText(word.contexts[0].sentenceZhPairs) === "我在導師時間前查看每日行程。" &&
    pairText(word.contexts[0].usageZhPairs).includes("daily") &&
    elements.contextZhuyinText.classList.contains("hidden") &&
    elements.contextUsageZhuyin.classList.contains("hidden");
}

function practiceContextSwitchSelfTestPassed() {
  const word = currentPracticeWord();
  const contexts = approvedContexts(word);
  if (!word || word.id !== "D001" || contexts.length < 2) {
    return false;
  }
  state.activeContextIndex = 1;
  renderContextTabs(word);
  renderPracticeContext(word);
  return elements.usageText.textContent === contexts[1].sentence &&
    pairText(contexts[1].sentenceZhPairs) === contexts[1].sentenceZh &&
    pairText(contexts[1].usageZhPairs) === contexts[1].usageZh;
}

function maybeRunZhuyinLayoutTest() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("layouttest") !== "1") {
    return;
  }
  window.setTimeout(() => {
    const units = Array.from(document.querySelectorAll(".bpmf-unit"));
    let checked = 0;
    const issues = [];
    units.forEach((unit, index) => {
      if (unit.classList.contains("no-bpmf")) {
        return;
      }
      const unitRect = unit.getBoundingClientRect();
      if (unitRect.width === 0 && unitRect.height === 0) {
        return;
      }
      const children = Array.from(unit.children);
      const han = children.find((child) => child.classList.contains("bpmf-han"));
      const mark = children.find((child) => child.classList.contains("bpmf-mark"));
      if (!han || !mark) {
        issues.push(`missing-part-${index}`);
        return;
      }
      const hanRect = han.getBoundingClientRect();
      const markRect = mark.getBoundingClientRect();
      checked += 1;
      const safeGap = markRect.left - hanRect.right;
      if (safeGap < 2) {
        issues.push(`unsafe-gap-${index}-${safeGap.toFixed(1)}`);
      }
      if (markRect.left < hanRect.left) {
        issues.push(`wrong-side-${index}-${hanRect.left.toFixed(1)}-${markRect.left.toFixed(1)}`);
      }
      if (markRect.width > hanRect.width * 0.72) {
        issues.push(`wide-mark-${index}-${markRect.width.toFixed(1)}-${hanRect.width.toFixed(1)}`);
      }
      if (markRect.height > hanRect.height + 0.5) {
        issues.push(`tall-mark-${index}-${markRect.height.toFixed(1)}-${hanRect.height.toFixed(1)}`);
      }
    });
    Array.from(document.querySelectorAll(".bpmf-plain")).forEach((plain, index) => {
      const text = plain.textContent || "";
      if (containsCjkText(text) || Array.from(text).some((character) => isBopomofoCharacter(character))) {
        issues.push(`plain-contains-reading-text-${index}-${text}`);
      }
    });
    const marker = document.createElement("div");
    marker.id = "zhuyinLayoutTestResult";
    marker.dataset.checkedUnits = String(checked);
    marker.dataset.issueCount = String(issues.length);
    marker.textContent = checked > 0 && issues.length === 0 ? "PASS" : `FAIL ${issues.slice(0, 8).join(",")}`;
    document.body.appendChild(marker);
  }, 800);
}

function maybeRunInitialFilterTest() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("filtertest") !== "1" || !elements.initialFilter) {
    return;
  }
  window.setTimeout(() => {
    elements.initialFilter.value = "D";
    filterWords();
    const dPracticeCount = state.filteredWords.length;
    const practiceOk = state.filteredWords.length > 0 &&
      state.filteredWords.every((word) => wordInitial(word) === "D");
    startExam();
    const dExamCount = state.examWords.length;
    const examOk = state.examWords.length > 0 &&
      state.examWords.every((word) => wordInitial(word) === "D");
    elements.initialFilter.value = "all";
    filterWords();
    const resetOk = state.filteredWords.length === state.words.length;
    const marker = document.createElement("div");
    marker.id = "initialFilterTestResult";
    marker.dataset.dPracticeWords = String(dPracticeCount);
    marker.dataset.dExamWords = String(dExamCount);
    marker.dataset.resetWords = String(state.filteredWords.length);
    marker.textContent = practiceOk && examOk && resetOk ? "PASS" : "FAIL";
    document.body.appendChild(marker);
  }, 900);
}

function dispatchToolbarEvent(element, type) {
  element.dispatchEvent(new Event(type, { bubbles: true }));
}

function setToolbarFilters({ search = "", initial = "all", level = "all", topic = "all" }, options = {}) {
  elements.searchInput.value = search;
  if (elements.initialFilter) {
    elements.initialFilter.value = initial;
  }
  elements.levelFilter.value = level;
  elements.topicFilter.value = topic;
  if (options.useEvents) {
    dispatchToolbarEvent(elements.searchInput, "input");
    if (elements.initialFilter) {
      dispatchToolbarEvent(elements.initialFilter, "change");
    }
    dispatchToolbarEvent(elements.levelFilter, "change");
    dispatchToolbarEvent(elements.topicFilter, "change");
    return;
  }
  filterWords({ resetIndex: true, skipExamRefresh: true });
}

function addToolbarTestMarker(results) {
  const marker = document.createElement("div");
  marker.id = "toolbarControlTestResult";
  marker.dataset.results = JSON.stringify(results);
  marker.textContent = results.every((item) => item.pass) ? "PASS" : "FAIL";
  document.body.appendChild(marker);
}

function maybeRunToolbarControlTest() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("controltest") !== "1") {
    return;
  }
  window.setTimeout(() => {
    const results = [];
    setMode("practice");
    clearFilters();
    setToolbarFilters({ search: "dodge" }, { useEvents: true });
    results.push({
      name: "search",
      pass: currentPracticeWord() && currentPracticeWord().word === "dodge",
      count: state.filteredWords.length
    });
    setToolbarFilters({ initial: "A" }, { useEvents: true });
    results.push({
      name: "initial",
      pass: state.filteredWords.length > 0 && state.filteredWords.every((word) => wordInitial(word) === "A"),
      count: state.filteredWords.length
    });
    setToolbarFilters({ level: "challenge" }, { useEvents: true });
    results.push({
      name: "level",
      pass: state.filteredWords.length > 0 && state.filteredWords.every((word) => word.level === "challenge"),
      count: state.filteredWords.length
    });
    setToolbarFilters({ topic: "school" }, { useEvents: true });
    results.push({
      name: "topic",
      pass: state.filteredWords.length > 0 && state.filteredWords.every((word) => word.topic === "school"),
      count: state.filteredWords.length
    });
    clearFilters();
    const beforeShuffle = currentPracticeWord() ? currentPracticeWord().id : "";
    shuffleFilteredWords();
    const afterShuffle = currentPracticeWord() ? currentPracticeWord().id : "";
    results.push({
      name: "shuffle",
      pass: beforeShuffle !== afterShuffle && state.filteredWords.length === state.words.length,
      count: state.filteredWords.length
    });
    setToolbarFilters({ search: "dodge", initial: "A" }, { useEvents: true });
    const conflictCount = state.filteredWords.length;
    clearFilters();
    results.push({
      name: "clear",
      pass: conflictCount === 0 && state.filteredWords.length === state.words.length && !hasActiveWordFilter(),
      count: state.filteredWords.length
    });
    addToolbarTestMarker(results);
  }, 1100);
}

function toolbarExpectedWords(criteria) {
  const search = normalizeText(criteria.search || "");
  const initial = criteria.initial || "all";
  const level = criteria.level || "all";
  const topic = criteria.topic || "all";
  return state.words.filter((word) => {
    const searchableText = normalizeText([word.word, word.zh, word.topicZh, word.source].join(" "));
    return (!search || searchableText.includes(search)) &&
      (initial === "all" || wordInitial(word) === initial) &&
      (level === "all" || word.level === level) &&
      (topic === "all" || word.topic === topic);
  });
}

function toolbarOptionValues(element) {
  return Array.from(element.options).map((option) => option.value);
}

function toolbarMatrixCases() {
  const searches = ["", "dodge", "milk", "daily", "zzzz-not-found"];
  const initials = elements.initialFilter ? toolbarOptionValues(elements.initialFilter) : ["all"];
  const levels = toolbarOptionValues(elements.levelFilter);
  const topics = toolbarOptionValues(elements.topicFilter);
  const cases = [];
  searches.forEach((search) => {
    initials.forEach((initial) => {
      levels.forEach((level) => {
        topics.forEach((topic) => {
          cases.push({ search, initial, level, topic });
        });
      });
    });
  });
  return cases;
}

function runToolbarMatrixCase(criteria) {
  setToolbarFilters(criteria);
  const expected = toolbarExpectedWords(criteria);
  const actual = state.filteredWords;
  const firstExpected = expected.length > 0 ? expected[0].word : "No words";
  const statusText = elements.filterStatus ? elements.filterStatus.textContent.trim() : "";
  const sameLength = actual.length === expected.length;
  const sameFirst = (currentPracticeWord() ? currentPracticeWord().word : "No words") === firstExpected &&
    elements.wordText.textContent === firstExpected;
  const sourceOk = expected.length === 0 || elements.wordSource.textContent === expected[0].source;
  const levelOk = expected.length === 0 || elements.wordLevel.textContent === expected[0].level;
  const statusOk = statusText.length > 0;
  return {
    pass: sameLength && sameFirst && sourceOk && levelOk && statusOk && state.currentIndex === 0,
    sameLength,
    sameFirst,
    sourceOk,
    levelOk,
    statusOk,
    currentIndexOk: state.currentIndex === 0,
    expectedCount: expected.length,
    actualCount: actual.length,
    expectedFirst: firstExpected,
    actualFirst: elements.wordText.textContent,
    statusLength: statusText.length,
    criteria
  };
}

function addToolbarMatrixMarker(summary) {
  const marker = document.createElement("div");
  marker.id = "toolbarMatrixTestResult";
  marker.dataset.totalCases = String(summary.totalCases);
  marker.dataset.failureCount = String(summary.failures.length);
  marker.dataset.failures = JSON.stringify(summary.failures.slice(0, 25));
  marker.textContent = summary.failures.length === 0 ? "PASS" : "FAIL";
  document.body.appendChild(marker);
}

function maybeRunToolbarMatrixTest() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("matrixtest") !== "1") {
    return;
  }
  window.setTimeout(() => {
    setMode("practice");
    clearFilters();
    const failures = [];
    const cases = toolbarMatrixCases();
    cases.forEach((criteria, index) => {
      const result = runToolbarMatrixCase(criteria);
      if (!result.pass) {
        failures.push({ index, ...result });
      }
    });
    clearFilters();
    addToolbarMatrixMarker({ totalCases: cases.length, failures });
  }, 1250);
}

function addInteractionTestMarker(results) {
  const marker = document.createElement("div");
  marker.id = "interactionTestResult";
  marker.dataset.results = JSON.stringify(results);
  marker.textContent = results.every((item) => item.pass) ? "PASS" : "FAIL";
  document.body.appendChild(marker);
}

function recordInteractionResult(results, name, pass, extra = {}) {
  results.push({ name, pass: Boolean(pass), ...extra });
}

function clickElementForTest(element) {
  if (!element) {
    return false;
  }
  element.click();
  return true;
}

function maybeRunInteractionTest() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("interactiontest") !== "1") {
    return;
  }
  window.setTimeout(() => {
    const results = [];
    setMode("practice");
    clearFilters();

    const firstWord = currentPracticeWord();
    movePractice(1);
    const nextWord = currentPracticeWord();
    movePractice(-1);
    const restoredWord = currentPracticeWord();
    recordInteractionResult(
      results,
      "practice-navigation",
      firstWord && nextWord && restoredWord && firstWord.id !== nextWord.id && restoredWord.id === firstWord.id,
      { first: firstWord ? firstWord.word : "", next: nextWord ? nextWord.word : "" }
    );

    const knownBefore = state.knownWords.size;
    clickElementForTest(elements.knownButton);
    const knownAfterToggle = state.knownWords.size;
    clickElementForTest(elements.knownButton);
    const knownAfterRestore = state.knownWords.size;
    recordInteractionResult(
      results,
      "known-toggle",
      knownBefore !== knownAfterToggle && knownAfterRestore === knownBefore,
      { before: knownBefore, afterToggle: knownAfterToggle, afterRestore: knownAfterRestore }
    );

    const contextButtons = elements.contextTabs ? Array.from(elements.contextTabs.querySelectorAll(".context-tab")) : [];
    const contextTexts = [];
    contextButtons.forEach((button) => {
      clickElementForTest(button);
      contextTexts.push(elements.usageText.textContent);
    });
    recordInteractionResult(
      results,
      "context-tabs",
      contextButtons.length >= 3 && new Set(contextTexts).size === contextButtons.length,
      { tabs: contextButtons.length }
    );

    const audioOptions = Array.from(elements.audioSelect.options).map((option) => option.value);
    const audioSources = [];
    audioOptions.forEach((value) => {
      elements.audioSelect.value = value;
      dispatchToolbarEvent(elements.audioSelect, "change");
      audioSources.push(elements.sourceAudio.getAttribute("src"));
    });
    recordInteractionResult(
      results,
      "source-audio-select",
      audioSources.length >= 2 && new Set(audioSources).size === audioSources.length,
      { sources: audioSources.length }
    );

    [
      elements.speakButton,
      elements.speakMeaningZh,
      elements.speakTopicZh,
      elements.speakExampleEn,
      elements.speakExampleZh,
      elements.speakUsageEn,
      elements.speakUsageZh
    ].forEach((button) => clickElementForTest(button));
    stopActiveAudio();
    stopSpeechPlayback();
    recordInteractionResult(results, "practice-speech-buttons", true);

    setToolbarFilters({ initial: "A" });
    setMode("exam");
    startExam();
    recordInteractionResult(
      results,
      "filtered-exam-source",
      state.examWords.length > 0 && state.examWords.every((word) => wordInitial(word) === "A"),
      { examWords: state.examWords.length }
    );

    const letterButtons = Array.from(elements.letterBank.querySelectorAll(".letter-tile"));
    const firstLetterClicked = clickElementForTest(letterButtons[0]);
    const selectedAfterPick = state.selectedLetters.length;
    clickElementForTest(elements.eraseButton);
    const selectedAfterErase = state.selectedLetters.length;
    recordInteractionResult(
      results,
      "exam-pick-erase",
      firstLetterClicked && selectedAfterPick === 1 && selectedAfterErase === 0,
      { letters: letterButtons.length }
    );

    const filled = fillCorrectExamAnswerForSelfTest();
    const checked = checkAnswer();
    const feedbackOk = elements.examFeedback.classList.contains("good");
    const examIndexBeforeNext = state.examIndex;
    clickElementForTest(elements.nextExamButton);
    const nextExamOk = state.examWords.length <= 1 || state.examIndex !== examIndexBeforeNext;
    recordInteractionResult(
      results,
      "exam-check-next",
      filled && checked && feedbackOk && nextExamOk,
      { filled, checked, feedbackOk, nextExamOk, examIndexBeforeNext, examIndexAfterNext: state.examIndex }
    );

    clickElementForTest(elements.playExamWord);
    clickElementForTest(elements.playExamHintZh);
    stopActiveAudio();
    stopSpeechPlayback();
    recordInteractionResult(results, "exam-speech-buttons", true);

    clearFilters();
    setMode("practice");
    addInteractionTestMarker(results);
  }, 1350);
}

function examDifficultySnapshot(name) {
  const slots = Array.from(elements.answerSlots.querySelectorAll(".answer-slot"));
  const inputs = Array.from(elements.answerSlots.querySelectorAll(".answer-input"));
  const letterTiles = Array.from(elements.letterBank.querySelectorAll(".letter-tile"));
  return {
    name,
    slots: slots.length,
    inputs: inputs.length,
    letterTiles: letterTiles.length,
    locked: inputs.filter((input) => input.readOnly).length,
    values: inputs.map((input) => input.value).join("")
  };
}

function maybeRunExamDifficultyTest() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("difficultytest") !== "1") {
    return;
  }
  window.setTimeout(() => {
    const results = [];
    setMode("exam");
    clearFilters();

    setExamDifficulty("low");
    startExam();
    const lowWord = state.activeExamWord;
    const lowSnapshot = examDifficultySnapshot("low");
    const lowFilled = fillCorrectExamAnswerForSelfTest();
    const lowChecked = checkAnswer();
    recordInteractionResult(
      results,
      "low-letter-bank",
      lowWord && lowSnapshot.slots === lowWord.word.length &&
        lowSnapshot.inputs === 0 &&
        lowSnapshot.letterTiles === lowWord.word.length &&
        lowFilled &&
        lowChecked,
      lowSnapshot
    );

    setExamDifficulty("medium");
    startExam();
    const mediumWord = state.activeExamWord;
    const mediumSnapshot = examDifficultySnapshot("medium");
    const mediumExpected = mediumWord ? `${mediumWord.word[0]}${mediumWord.word[mediumWord.word.length - 1]}`.toUpperCase() : "";
    const mediumFilled = fillCorrectExamAnswerForSelfTest();
    const mediumChecked = checkAnswer();
    recordInteractionResult(
      results,
      "medium-first-last",
      mediumWord && mediumSnapshot.slots === mediumWord.word.length &&
        mediumSnapshot.inputs === mediumWord.word.length &&
        mediumSnapshot.letterTiles === 0 &&
        mediumSnapshot.locked === 2 &&
        mediumSnapshot.values === mediumExpected &&
        mediumFilled &&
        mediumChecked,
      mediumSnapshot
    );

    setExamDifficulty("high");
    startExam();
    const highWord = state.activeExamWord;
    const highSnapshot = examDifficultySnapshot("high");
    const highFilled = fillCorrectExamAnswerForSelfTest();
    const highChecked = checkAnswer();
    recordInteractionResult(
      results,
      "high-input-only",
      highWord && highSnapshot.slots === highWord.word.length &&
        highSnapshot.inputs === highWord.word.length &&
        highSnapshot.letterTiles === 0 &&
        highSnapshot.locked === 0 &&
        highSnapshot.values === "" &&
        highFilled &&
        highChecked,
      highSnapshot
    );

    setExamDifficulty("low");
    clearFilters();
    setMode("practice");
    const marker = document.createElement("div");
    marker.id = "examDifficultyTestResult";
    marker.dataset.results = JSON.stringify(results);
    marker.textContent = results.every((item) => item.pass) ? "PASS" : "FAIL";
    document.body.appendChild(marker);
  }, 1500);
}

function examWordsMatchInitials(letters) {
  return state.examWords.length > 0 &&
    state.examWords.every((word) => letters.includes(wordInitial(word)));
}

function examWordsMatchCriteria(letters, criteria = {}) {
  return state.examWords.length > 0 &&
    state.examWords.every((word) => {
      const initialOk = letters.includes(wordInitial(word));
      const levelOk = !criteria.level || word.level === criteria.level;
      const topicOk = !criteria.topic || word.topic === criteria.topic;
      const searchOk = !criteria.search ||
        includesText(word.word, normalizeText(criteria.search)) ||
        includesText(word.zh, normalizeText(criteria.search)) ||
        includesText(word.source, normalizeText(criteria.search)) ||
        includesText(word.topic, normalizeText(criteria.search)) ||
        includesText(word.topicZh, normalizeText(criteria.search));
      return initialOk && levelOk && topicOk && searchOk;
    });
}

function maybeRunExamCustomInitialTest() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("custominitialtest") !== "1") {
    return;
  }
  window.setTimeout(() => {
    const results = [];
    setMode("exam");
    clearFilters();

    setExamInitialMode("single", { skipExamRefresh: true });
    setToolbarFilters({ initial: "A" });
    startExam();
    recordInteractionResult(results, "single-a-kept", examWordsMatchInitials(["A"]), {
      examWords: state.examWords.length
    });

    clearFilters();
    setCustomExamInitials(["A", "C"], { skipExamRefresh: true });
    startExam();
    recordInteractionResult(results, "custom-a-c", examWordsMatchInitials(["A", "C"]), {
      selected: selectedExamInitialList().join("")
    });

    setToolbarFilters({ initial: "D" });
    setCustomExamInitials(["E", "F"], { skipExamRefresh: true });
    startExam();
    const practiceStillD = state.filteredWords.length > 0 &&
      state.filteredWords.every((word) => wordInitial(word) === "D");
    recordInteractionResult(results, "custom-ignores-single-in-exam", practiceStillD && examWordsMatchInitials(["E", "F"]), {
      practiceWords: state.filteredWords.length,
      examWords: state.examWords.length
    });

    const target = state.words.find((word) => ["E", "F", "G", "H"].includes(wordInitial(word)));
    if (target) {
      clearFilters();
      setCustomExamInitials([wordInitial(target)], { skipExamRefresh: true });
      setToolbarFilters({ search: target.word, level: target.level, topic: target.topic });
      startExam();
      recordInteractionResult(
        results,
        "custom-with-search-level-topic",
        state.examWords.length === 1 &&
          state.examWords[0].id === target.id &&
          examWordsMatchCriteria([wordInitial(target)], {
            search: target.word,
            level: target.level,
            topic: target.topic
          }),
        { target: target.word, examWords: state.examWords.length }
      );
    } else {
      recordInteractionResult(results, "custom-with-search-level-topic", false, { target: "" });
    }

    clearFilters();
    setCustomExamInitials(["A"], { skipExamRefresh: true });
    toggleExamInitial("A");
    recordInteractionResult(results, "cannot-empty-custom", selectedExamInitialList().length === 1 && selectedExamInitialList()[0] === "A", {
      selected: selectedExamInitialList().join("")
    });

    clearFilters();
    recordInteractionResult(results, "clear-keeps-custom-but-resets-all", state.examInitialMode === "custom" && customExamInitialsAreAllSelected(), {
      selected: selectedExamInitialList().length
    });

    setExamInitialMode("single", { skipExamRefresh: true });
    setToolbarFilters({ initial: "H" });
    startExam();
    recordInteractionResult(results, "single-after-custom", examWordsMatchInitials(["H"]), {
      examWords: state.examWords.length
    });

    clearFilters();
    setExamInitialMode("single", { skipExamRefresh: true });
    setMode("practice");
    const marker = document.createElement("div");
    marker.id = "examCustomInitialTestResult";
    marker.dataset.results = JSON.stringify(results);
    marker.textContent = results.every((item) => item.pass) ? "PASS" : "FAIL";
    document.body.appendChild(marker);
  }, 1650);
}

function rectanglesOverlap(first, second) {
  return first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top;
}

function examMedalLayoutStatus() {
  if (!elements.examMedal || elements.examMedal.classList.contains("hidden")) {
    return { pass: false, overlaps: ["hidden"] };
  }
  const medalRect = elements.examMedal.getBoundingClientRect();
  const selectors = [
    ".exam-difficulty",
    "#examInitialScope",
    "#examSessionPanel",
    ".exam-controls button",
    "#answerSlots .answer-slot",
    "#letterBank .letter-tile",
    ".card-actions button",
    ".exam-hint"
  ];
  const overlaps = [];
  selectors.forEach((selector) => {
    Array.from(document.querySelectorAll(selector)).forEach((target, index) => {
      const rect = target.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return;
      }
      if (rectanglesOverlap(medalRect, rect)) {
        overlaps.push(`${selector}:${index}:${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.right)},${Math.round(rect.bottom)}`);
      }
    });
  });
  return { pass: overlaps.length === 0, overlaps };
}

function examMedalLayoutIsSafe() {
  return examMedalLayoutStatus().pass;
}

function wrongAnswerLettersFor(word) {
  const letters = word.word.split("");
  const wrongLetters = letters.map((letter) => letter.toLowerCase() === "a" ? "b" : "a");
  if (wrongLetters.join("").toLowerCase() === word.word.toLowerCase()) {
    wrongLetters[0] = wrongLetters[0].toLowerCase() === "a" ? "b" : "a";
  }
  return wrongLetters;
}

function maybeRunExamSessionTest() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("sessiontest") !== "1") {
    return;
  }
  window.setTimeout(() => {
    const results = [];
    setMode("exam");
    clearFilters();
    setExamInitialMode("single", { skipExamRefresh: true });
    setExamDifficulty("low");
    startExam();

    const sourceCount = databaseOnlyExamSource().length;
    recordInteractionResult(
      results,
      "award-hidden-before-threshold",
      elements.examMedal && elements.examMedal.classList.contains("hidden") && !examCardElement().classList.contains("award-bronze"),
      { medalClass: elements.examMedal ? elements.examMedal.className : "" }
    );
    recordInteractionResult(
      results,
      "full-range-no-ten-cap",
      sourceCount > 10 && state.examWords.length === sourceCount,
      { sourceCount, examWords: state.examWords.length }
    );

    const correctWord = state.activeExamWord;
    const correctFilled = fillCorrectExamAnswerForSelfTest();
    const correctChecked = checkAnswer();
    const duplicateChecked = checkAnswer();
    recordInteractionResult(
      results,
      "correct-counts-once",
      correctWord &&
        correctFilled &&
        correctChecked &&
        duplicateChecked &&
        state.examAnsweredCount === 1 &&
        state.examCorrectCount === 1 &&
        state.examStreak === 1,
      {
        answered: state.examAnsweredCount,
        correct: state.examCorrectCount,
        streak: state.examStreak
      }
    );

    nextExamQuestion();
    if (state.activeExamWord) {
      state.selectedLetters = wrongAnswerLettersFor(state.activeExamWord);
      renderAnswerSlots();
      checkAnswer();
    }
    recordInteractionResult(
      results,
      "wrong-resets-streak",
      state.examAnsweredCount === 2 &&
        state.examCorrectCount === 1 &&
        state.examStreak === 0 &&
        elements.examFeedback.classList.contains("warn"),
      {
        answered: state.examAnsweredCount,
        correct: state.examCorrectCount,
        streak: state.examStreak
      }
    );

    resetExamSession();
    recordInteractionResult(
      results,
      "reset-clears-session",
      state.examAnsweredCount === 0 &&
        state.examCorrectCount === 0 &&
        state.examStreak === 0 &&
        state.examWords.length === sourceCount &&
        Boolean(state.activeExamWord),
      {
        answered: state.examAnsweredCount,
        correct: state.examCorrectCount,
        streak: state.examStreak,
        examWords: state.examWords.length
      }
    );

    state.examCorrectCount = 10;
    renderExamSessionPanel();
    const bronzeOk = examAwardLevel() === "bronze" &&
      examCardElement().classList.contains("award-bronze") &&
      elements.examMedal.classList.contains("bronze");
    state.examCorrectCount = 20;
    renderExamSessionPanel();
    const silverOk = examAwardLevel() === "silver" &&
      examCardElement().classList.contains("award-silver") &&
      elements.examMedal.classList.contains("silver");
    state.examCorrectCount = 30;
    renderExamSessionPanel();
    const goldOk = examAwardLevel() === "gold" &&
      examCardElement().classList.contains("award-gold") &&
      elements.examMedal.classList.contains("gold");
    recordInteractionResult(results, "award-thresholds", bronzeOk && silverOk && goldOk, {
      bronzeOk,
      silverOk,
      goldOk
    });
    const medalLayout = examMedalLayoutStatus();
    recordInteractionResult(results, "award-medal-layout", goldOk && medalLayout.pass, {
      medalClass: elements.examMedal.className,
      overlaps: medalLayout.overlaps.join("|")
    });

    resetExamSession();
    state.examStreak = 4;
    fillCorrectExamAnswerForSelfTest();
    checkAnswer();
    const celebrationOk = elements.examCelebration &&
      !elements.examCelebration.classList.contains("hidden") &&
      state.examStreak === 5;
    recordInteractionResult(results, "five-streak-celebration", celebrationOk, {
      streak: state.examStreak
    });
    hideExamCelebration();

    startExam();
    if (state.activeExamWord) {
      state.examWords = [state.activeExamWord];
      state.examIndex = 0;
      renderExamQuestion();
      fillCorrectExamAnswerForSelfTest();
      checkAnswer();
      nextExamQuestion();
    }
    recordInteractionResult(
      results,
      "completion-after-range",
      state.examCompleted &&
        !state.activeExamWord &&
        elements.answerSlots.childElementCount === 0 &&
        elements.letterBank.childElementCount === 0,
      {
        completed: state.examCompleted,
        slots: elements.answerSlots.childElementCount,
        tiles: elements.letterBank.childElementCount
      }
    );

    resetExamSession();
    setExamDifficulty("low");
    setExamInitialMode("single", { skipExamRefresh: true });
    clearFilters();
    setMode("practice");
    const marker = document.createElement("div");
    marker.id = "examSessionTestResult";
    marker.dataset.results = JSON.stringify(results);
    marker.textContent = results.every((item) => item.pass) ? "PASS" : "FAIL";
    document.body.appendChild(marker);
  }, 1850);
}

function textNodeIsCoveredByBpmf(node) {
  let parent = node.parentElement;
  while (parent) {
    if (parent.classList && parent.classList.contains("bpmf-unit")) {
      return true;
    }
    if (parent.tagName === "SCRIPT" || parent.tagName === "STYLE" || parent.tagName === "TEMPLATE") {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

function containsCjkText(value) {
  return Array.from(String(value || "")).some((character) => isCjkCharacter(character));
}

function maybeRunBpmfCoverageTest() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("coveragetest") !== "1") {
    return;
  }
  window.setTimeout(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const issues = [];
    let checked = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = String(node.nodeValue || "").trim();
      if (!text || !containsCjkText(text)) {
        continue;
      }
      checked += 1;
      if (!textNodeIsCoveredByBpmf(node)) {
        issues.push(text.slice(0, 12));
      }
    }
    const marker = document.createElement("div");
    marker.id = "bpmfCoverageTestResult";
    marker.dataset.checkedTextNodes = String(checked);
    marker.dataset.issueCount = String(issues.length);
    marker.textContent = issues.length === 0 ? "PASS" : `FAIL ${issues.slice(0, 8).join(",")}`;
    document.body.appendChild(marker);
  }, 1000);
}

function maybeRunAudioPipelineTest() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("audiotest") !== "1") {
    return;
  }
  window.setTimeout(async () => {
    const marker = document.createElement("div");
    marker.id = "audioPipelineTestResult";
    try {
      let requiredClips = 0;
      let clipsWithAudio = 0;
      state.words.forEach((word) => {
        expectedAudioClipTypes(word).forEach((clipType) => {
          requiredClips += 1;
          if (audioClipEntry(word, clipType)) {
            clipsWithAudio += 1;
          }
        });
      });
      const sampleWord = state.words.find((word) => audioClipEntry(word, "word"));
      let sampleAudioOk = false;
      if (sampleWord) {
        const sampleClip = audioClipEntry(sampleWord, "word");
        const response = await fetch(sampleClip.path, { cache: "no-store" });
        const blob = await response.blob();
        sampleAudioOk = response.ok && blob.size > 500;
      }
      marker.dataset.words = String(state.words.length);
      marker.dataset.requiredClips = String(requiredClips);
      marker.dataset.clipsWithAudio = String(clipsWithAudio);
      marker.dataset.sampleAudioOk = String(sampleAudioOk);
      marker.textContent = clipsWithAudio === requiredClips && sampleAudioOk ? "PASS" : "FAIL";
    } catch (error) {
      marker.textContent = "FAIL";
      marker.dataset.error = String(error && error.message ? error.message : error);
    }
    document.body.appendChild(marker);
  }, 1000);
}

function maybeRunSelfTest() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("selftest") !== "1") {
    return;
  }
  const practicePassed = practiceContextSelfTestPassed();
  const contextSwitchPassed = practiceContextSwitchSelfTestPassed();
  setMode("exam");
  window.setTimeout(() => {
    const filled = fillCorrectExamAnswerForSelfTest();
    const checked = checkAnswer();
    const marker = document.createElement("div");
    marker.id = "selfTestResult";
    marker.textContent = practicePassed && contextSwitchPassed && filled && checked ? "PASS" : "FAIL";
    document.body.appendChild(marker);
  }, 600);
}

function bindEvents() {
  elements.modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => setMode(tab.dataset.mode));
  });
  elements.examDifficultyButtons.forEach((button) => {
    button.addEventListener("click", () => setExamDifficulty(button.dataset.examDifficulty));
  });
  updateExamDifficultyButtons();
  elements.searchInput.addEventListener("input", filterWords);
  elements.initialFilter.addEventListener("change", filterWords);
  elements.levelFilter.addEventListener("change", filterWords);
  elements.topicFilter.addEventListener("change", filterWords);
  elements.shuffleButton.addEventListener("click", shuffleFilteredWords);
  elements.clearFiltersButton.addEventListener("click", clearFilters);
  elements.prevButton.addEventListener("click", () => movePractice(-1));
  elements.nextButton.addEventListener("click", () => movePractice(1));
  elements.speakButton.addEventListener("click", () => {
    const word = currentPracticeWord();
    if (word) {
      speakWordAudio(word);
    }
  });
  elements.speakMeaningZh.addEventListener("click", () => {
    const word = currentPracticeWord();
    if (word) {
      speakMeaningAudio(word);
    }
  });
  elements.speakTopicZh.addEventListener("click", () => {
    const word = currentPracticeWord();
    if (word) {
      speakTopicAudio(word);
    }
  });
  elements.speakExampleEn.addEventListener("click", () => {
    const word = currentPracticeWord();
    if (word) {
      speakExampleAudio(word);
    }
  });
  elements.speakExampleZh.addEventListener("click", () => {
    const word = currentPracticeWord();
    if (word) {
      speakExampleZhAudio(word);
    }
  });
  elements.speakUsageEn.addEventListener("click", () => {
    const word = currentPracticeWord();
    if (word) {
      speakUsageAudio(word);
    }
  });
  elements.speakUsageZh.addEventListener("click", () => {
    const word = currentPracticeWord();
    if (word) {
      speakUsageZhAudio(word);
    }
  });
  elements.knownButton.addEventListener("click", () => {
    const word = currentPracticeWord();
    if (!word) {
      return;
    }
    if (state.knownWords.has(word.id)) {
      state.knownWords.delete(word.id);
    } else {
      state.knownWords.add(word.id);
    }
    saveKnownWords();
    updateKnownButton(word);
    updateStats();
  });
  elements.audioSelect.addEventListener("change", () => {
    elements.sourceAudio.src = elements.audioSelect.value;
    elements.sourceAudio.load();
  });
  elements.playExamWord.addEventListener("click", () => {
    if (state.activeExamWord) {
      speakWordAudio(state.activeExamWord);
    }
  });
  elements.playExamHintZh.addEventListener("click", () => {
    if (state.activeExamWord) {
      speakExamHintAudio(state.activeExamWord);
    }
  });
  elements.newExamButton.addEventListener("click", startExam);
  elements.eraseButton.addEventListener("click", eraseLetter);
  elements.checkButton.addEventListener("click", checkAnswer);
  elements.nextExamButton.addEventListener("click", nextExamQuestion);
  if (elements.resetExamSessionButton) {
    elements.resetExamSessionButton.addEventListener("click", resetExamSession);
  }
}

async function init() {
  hydrateStaticBpmf();
  bindEvents();
  initSpeechEngine();
  elements.sourceAudio.volume = SPEECH_SETTINGS.volume;
  try {
    state.words = await loadWordDatabase();
    rebuildWordIndex();
    state.knownWords = loadKnownWords();
    state.filteredWords = state.words.slice();
    buildInitialFilter();
    buildTopicFilter();
    selectAllExamInitials();
    buildExamInitialScope();
    state.filterSignature = currentFilterSignature();
    updateStats();
    renderPracticeCard();
    renderFilterStatus();
    if (window.location.hash === "#exam") {
      setMode("exam");
    }
    maybeRunSelfTest();
    maybeRunZhuyinLayoutTest();
    maybeRunInitialFilterTest();
    maybeRunToolbarControlTest();
    maybeRunToolbarMatrixTest();
    maybeRunInteractionTest();
    maybeRunExamDifficultyTest();
    maybeRunExamCustomInitialTest();
    maybeRunExamSessionTest();
    maybeRunBpmfCoverageTest();
    maybeRunAudioPipelineTest();
  } catch (error) {
    renderEmptyPractice();
    elements.exampleText.textContent = "Data failed to load. Please run the site through a local server or GitHub Pages.";
    throw error;
  }
}

init();
