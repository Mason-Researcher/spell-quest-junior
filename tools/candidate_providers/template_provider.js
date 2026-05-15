const {
  addGeneratedChineseFields,
  cleanAsciiWord,
  cloneBaseCandidate,
  stripTerminalPunctuation
} = require("../official_candidate_common");

function meaningPhrase(entry) {
  const alternatives = Array.isArray(entry.zhAlternatives) ? entry.zhAlternatives : [];
  if (alternatives.length === 0) {
    return entry.zh;
  }
  return `${entry.zh}，也可能表示${alternatives.join("、")}`;
}

function safeWord(entry) {
  return cleanAsciiWord(entry.word);
}

function buildTemplateCandidate(draftEntry) {
  const word = safeWord(draftEntry);
  const meaning = meaningPhrase(draftEntry);
  const entry = cloneBaseCandidate(draftEntry);
  entry.example = `I learn ${word} with my word card.`;
  entry.exampleZh = `我用單字卡學習 ${word}，意思是${meaning}。`;
  entry.usage = `Use ${word} when practicing this word's meaning.`;
  entry.reviewStatus = "machine_candidate";
  entry.contentReview = {
    status: "machine_candidate",
    generatedAt: new Date().toISOString(),
    provider: "template",
    sourceRefs: [
      {
        label: "Official raw word bank",
        url: `local:${draftEntry.sourceKey}`
      }
    ],
    basis: [
      "official-raw-transcription",
      "deterministic-grade-2-template",
      "machine-candidate-not-approved"
    ]
  };
  entry.contexts = [
    {
      id: "word-card",
      level: "grade-2-friendly",
      labelZh: "單字卡",
      sentence: `I put ${word} on my word card.`,
      sentenceZh: `我把 ${word} 放在單字卡上，提醒自己它的意思是${meaning}。`,
      usageZh: `看到 ${word} 時，先讀單字，再說出${stripTerminalPunctuation(meaning)}。`,
      sourceBasis: [
        "official-raw-meaning",
        "spelling-practice-context"
      ],
      reviewStatus: "machine_candidate"
    },
    {
      id: "class-practice",
      level: "grade-2-friendly",
      labelZh: "課堂練習",
      sentence: `My class says ${word} after the teacher.`,
      sentenceZh: `全班跟著老師唸 ${word}，並記住它的意思是${meaning}。`,
      usageZh: `在課堂練習時，用 ${word} 連結中文意思。`,
      sourceBasis: [
        "official-raw-meaning",
        "classroom-practice-context"
      ],
      reviewStatus: "machine_candidate"
    },
    {
      id: "meaning-check",
      level: "grade-2-friendly",
      labelZh: "意思檢查",
      sentence: `I check ${word} before the quiz.`,
      sentenceZh: `小考前我檢查 ${word}，確認自己知道${meaning}。`,
      usageZh: `複習時，把 ${word} 和「${stripTerminalPunctuation(meaning)}」配在一起。`,
      sourceBasis: [
        "official-raw-meaning",
        "review-context"
      ],
      reviewStatus: "machine_candidate"
    }
  ];
  entry.autoQuality = {
    status: "ready_for_review",
    score: 0.88,
    provider: "template",
    checks: [
      "word-in-example",
      "grade-2-sentence-length",
      "traditional-chinese-generated",
      "bopomofo-generated",
      "not-approved"
    ],
    limitations: [
      "Machine candidate uses conservative spelling-study contexts.",
      "Semantic classroom example still requires human or LLM review before approval."
    ]
  };
  addGeneratedChineseFields(entry);
  return entry;
}

function buildCandidates(draftEntries) {
  return draftEntries.map((entry) => buildTemplateCandidate(entry));
}

module.exports = {
  buildCandidates,
  buildTemplateCandidate,
  providerName: "template"
};
