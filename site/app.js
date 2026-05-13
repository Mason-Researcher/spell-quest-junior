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

const SPEECH_SETTINGS = {
  volume: 1,
  pitch: 1.08,
  clipStartTimeoutMs: 900,
  speechStartDelayMs: 20,
  speechRestartCheckMs: 350
};

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
  speechVoices: [],
  speechToken: 0,
  words: [],
  wordById: new Map(),
  filteredWords: [],
  currentIndex: 0,
  knownWords: new Set(),
  examWords: [],
  examIndex: 0,
  examScore: 0,
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
  levelFilter: document.getElementById("levelFilter"),
  topicFilter: document.getElementById("topicFilter"),
  shuffleButton: document.getElementById("shuffleButton"),
  wordSource: document.getElementById("wordSource"),
  wordLevel: document.getElementById("wordLevel"),
  wordStar: document.getElementById("wordStar"),
  wordText: document.getElementById("wordText"),
  wordPos: document.getElementById("wordPos"),
  meaningText: document.getElementById("meaningText"),
  topicText: document.getElementById("topicText"),
  exampleText: document.getElementById("exampleText"),
  exampleZhHint: document.getElementById("exampleZhHint"),
  usageText: document.getElementById("usageText"),
  usageZhHint: document.getElementById("usageZhHint"),
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
  examScore: document.getElementById("examScore"),
  examTotal: document.getElementById("examTotal"),
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

function ruby(text, zhuyin) {
  return `<ruby>${text}<rt>${zhuyin}</rt></ruby>`;
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
    option.textContent = item.label;
    elements.topicFilter.appendChild(option);
  });
}

function filterWords() {
  const needle = normalizeText(elements.searchInput.value);
  const level = elements.levelFilter.value;
  const topic = elements.topicFilter.value;
  state.filteredWords = state.words.filter((word) => {
    const levelOk = level === "all" || word.level === level;
    const topicOk = topic === "all" || word.topic === topic;
    const searchOk = needle.length === 0 ||
      includesText(word.word, needle) ||
      includesText(word.zh, needle) ||
      includesText(word.source, needle) ||
      includesText(word.topic, needle) ||
      includesText(word.topicZh, needle);
    return levelOk && topicOk && searchOk;
  });
  if (state.filteredWords.length === 0) {
    state.currentIndex = 0;
    renderEmptyPractice();
    return;
  }
  if (state.currentIndex >= state.filteredWords.length) {
    state.currentIndex = 0;
  }
  renderPracticeCard();
  updateStats();
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
  elements.meaningText.innerHTML = ruby("沒有符合條件的單字", "ㄇㄟˊ ㄧㄡˇ ㄈㄨˊ ㄏㄜˊ ㄊㄧㄠˊ ㄐㄧㄢˋ ㄉㄜ˙ ㄉㄢ ㄗˋ");
  elements.topicText.textContent = "";
  elements.exampleText.textContent = "";
  elements.exampleZhHint.textContent = "";
  elements.usageText.textContent = "";
  elements.usageZhHint.textContent = "";
  elements.practiceLetters.innerHTML = "";
}

function renderPracticeCard() {
  const word = currentPracticeWord();
  if (!word) {
    renderEmptyPractice();
    return;
  }
  elements.wordSource.textContent = word.source;
  elements.wordLevel.textContent = word.level;
  elements.wordStar.classList.toggle("hidden", !word.starred);
  elements.wordText.textContent = word.word;
  elements.wordPos.textContent = word.pos;
  elements.meaningText.textContent = `${word.zh}（${word.zhuyin}）`;
  elements.topicText.textContent = `${word.topicZh}（${word.topicZhuyin}）`;
  elements.exampleText.textContent = word.example;
  elements.exampleZhHint.textContent = `中文提示：${word.zh}，主題：${word.topicZh}`;
  elements.usageText.textContent = word.usage;
  elements.usageZhHint.textContent = `中文任務：用 ${word.word} 表達「${word.zh}」這個概念。`;
  renderPracticeLetters(word.word);
  updateKnownButton(word);
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
  elements.knownButton.innerHTML = isKnown
    ? ruby("取消已熟", "ㄑㄩˇ ㄒㄧㄠ ㄧˇ ㄕㄨˊ")
    : ruby("標記已熟", "ㄅㄧㄠ ㄐㄧˋ ㄧˇ ㄕㄨˊ");
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

function primeSpeechEngine() {
  if (!window.speechSynthesis) {
    return;
  }
  refreshSpeechVoices();
  window.speechSynthesis.resume();
}

function stopSpeechPlayback() {
  state.speechToken += 1;
  if (!window.speechSynthesis) {
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

function speakText(text, lang, rate) {
  if (!window.speechSynthesis || !text) {
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
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
    window.setTimeout(() => {
      if (speechToken !== state.speechToken) {
        return;
      }
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        const retryUtterance = new SpeechSynthesisUtterance(speechText);
        retryUtterance.lang = lang;
        retryUtterance.rate = rate;
        retryUtterance.pitch = SPEECH_SETTINGS.pitch;
        retryUtterance.volume = SPEECH_SETTINGS.volume;
        if (voice) {
          retryUtterance.voice = voice;
        }
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(retryUtterance);
      }
    }, SPEECH_SETTINGS.speechRestartCheckMs);
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

function stopActiveAudio() {
  if (state.activeAudio) {
    state.activeAudio.pause();
    state.activeAudio.currentTime = 0;
    state.activeAudio = null;
  }
}

function playStaticAudio(path) {
  return new Promise((resolve) => {
    stopActiveAudio();
    stopSpeechPlayback();
    const audio = new Audio(path);
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
  const clip = audioClipEntry(word, clipType);
  if (clip) {
    const played = await playStaticAudio(clip.path);
    if (played) {
      return true;
    }
  }
  stopActiveAudio();
  return speakText(fallbackText, lang, rate);
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
  return speakClip(word, "usageZh", usageChineseSpeech(word), "zh-TW", 0.92);
}

function speakExamHintAudio(word) {
  return speakClip(word, "examHintZh", examHintChineseSpeech(word), "zh-TW", 0.92);
}

function exampleChineseSpeech(word) {
  return `英文例句。單字是 ${word.word}，中文意思是 ${word.zh}，主題是 ${word.topicZh}。請聽英文句子：${word.example}`;
}

function usageChineseSpeech(word) {
  return `應用任務。請用 ${word.word} 表達 ${word.zh} 這個概念。`;
}

function examHintChineseSpeech(word) {
  return `提示。中文意思是 ${word.zh}。主題是 ${word.topicZh}。詞性是 ${word.pos}。`;
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
  const source = state.filteredWords.length > 0 ? state.filteredWords : state.words;
  return source.filter((word) => state.wordById.has(word.id));
}

function startExam() {
  const source = databaseOnlyExamSource();
  state.examWords = shuffleArray(source).slice(0, 10);
  state.examIndex = 0;
  state.examScore = 0;
  elements.examTotal.textContent = String(state.examWords.length);
  elements.examScore.textContent = "0";
  renderExamQuestion();
}

function renderExamQuestion() {
  if (state.examWords.length === 0) {
    elements.examHint.innerHTML = ruby("沒有可用題目", "ㄇㄟˊ ㄧㄡˇ ㄎㄜˇ ㄩㄥˋ ㄊㄧˊ ㄇㄨˋ");
    return;
  }
  state.activeExamWord = state.examWords[state.examIndex];
  if (!state.wordById.has(state.activeExamWord.id)) {
    throw new Error(`Exam word is not from database: ${state.activeExamWord.id}`);
  }
  state.selectedLetters = [];
  elements.examFeedback.textContent = "";
  elements.examFeedback.className = "feedback";
  elements.examHint.textContent = `意思：${state.activeExamWord.zh}（${state.activeExamWord.zhuyin}） · 主題：${state.activeExamWord.topicZh}（${state.activeExamWord.topicZhuyin}） · 來源：${state.activeExamWord.source}`;
  renderAnswerSlots();
  renderLetterBank();
  window.setTimeout(() => speakWordAudio(state.activeExamWord), 180);
}

function renderAnswerSlots() {
  elements.answerSlots.innerHTML = "";
  const letters = state.activeExamWord.word.split("");
  letters.forEach((letter, index) => {
    const slot = document.createElement("div");
    slot.className = "answer-slot";
    slot.dataset.index = String(index);
    slot.textContent = state.selectedLetters[index] || "";
    slot.setAttribute("aria-label", `Letter ${index + 1} of ${letters.length}`);
    elements.answerSlots.appendChild(slot);
  });
}

function renderLetterBank() {
  elements.letterBank.innerHTML = "";
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
  if (button.disabled || !state.activeExamWord) {
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
  const answer = state.selectedLetters.join("");
  if (answer.length !== state.activeExamWord.word.length) {
    elements.examFeedback.innerHTML = ruby("還差幾個字母", "ㄏㄞˊ ㄔㄚ ㄐㄧˇ ㄍㄜˋ ㄗˋ ㄇㄨˇ");
    elements.examFeedback.className = "feedback warn";
    return false;
  }
  const correct = answer.toLowerCase() === state.activeExamWord.word.toLowerCase();
  if (correct) {
    state.examScore += 1;
    elements.examScore.textContent = String(state.examScore);
    elements.examFeedback.textContent = `答對了：${state.activeExamWord.word}`;
    elements.examFeedback.className = "feedback good";
    state.knownWords.add(state.activeExamWord.id);
    saveKnownWords();
    updateStats();
    return true;
  }
  elements.examFeedback.textContent = `再想一下：${answer.toUpperCase()}`;
  elements.examFeedback.className = "feedback warn";
  return false;
}

function nextExamQuestion() {
  if (state.examWords.length === 0) {
    return;
  }
  state.examIndex += 1;
  if (state.examIndex >= state.examWords.length) {
    state.examIndex = 0;
    state.examWords = shuffleArray(state.examWords);
  }
  renderExamQuestion();
}

function fillCorrectExamAnswerForSelfTest() {
  if (!state.activeExamWord) {
    return false;
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

function maybeRunSelfTest() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("selftest") !== "1") {
    return;
  }
  setMode("exam");
  window.setTimeout(() => {
    const filled = fillCorrectExamAnswerForSelfTest();
    const checked = checkAnswer();
    const marker = document.createElement("div");
    marker.id = "selfTestResult";
    marker.textContent = filled && checked ? "PASS" : "FAIL";
    document.body.appendChild(marker);
  }, 600);
}

function bindEvents() {
  elements.modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => setMode(tab.dataset.mode));
  });
  elements.searchInput.addEventListener("input", filterWords);
  elements.levelFilter.addEventListener("change", filterWords);
  elements.topicFilter.addEventListener("change", filterWords);
  elements.shuffleButton.addEventListener("click", () => {
    state.filteredWords = shuffleArray(state.filteredWords);
    state.currentIndex = 0;
    renderPracticeCard();
  });
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
}

async function init() {
  bindEvents();
  initSpeechEngine();
  elements.sourceAudio.volume = SPEECH_SETTINGS.volume;
  try {
    state.words = await loadWordDatabase();
    rebuildWordIndex();
    state.knownWords = loadKnownWords();
    state.filteredWords = state.words.slice();
    buildTopicFilter();
    updateStats();
    renderPracticeCard();
    if (window.location.hash === "#exam") {
      setMode("exam");
    }
    maybeRunSelfTest();
  } catch (error) {
    renderEmptyPractice();
    elements.exampleText.textContent = "Data failed to load. Please run the site through a local server or GitHub Pages.";
    throw error;
  }
}

init();
