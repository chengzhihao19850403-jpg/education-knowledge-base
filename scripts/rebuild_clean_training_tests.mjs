import fs from 'node:fs';

const trainingPath = new URL('../data/training_program.json', import.meta.url);
const knowledgePath = new URL('../data/knowledge_base.json', import.meta.url);

const training = JSON.parse(fs.readFileSync(trainingPath, 'utf8'));
const knowledge = JSON.parse(fs.readFileSync(knowledgePath, 'utf8'));

const allQuestions = [];
for (const category of knowledge.categories || []) {
  for (const item of category.questions || []) {
    allQuestions.push({ ...item, category: category.name });
  }
}

const questionById = new Map(allQuestions.map((item) => [item.id, item]));

function compact(value, limit = 90) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function normalize(value) {
  return String(value || '').replace(/[\s、,，.。:：;；!?？！()（）【】\[\]《》"'“”‘’\-—_/\\]/g, '');
}

function splitSentences(value) {
  return String(value || '')
    .replace(/\n+/g, ' ')
    .split(/(?<=[。！？?!；;])\s*/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 8);
}

function unique(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = compact(value, 110);
    const key = normalize(text);
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function rotateOptions(options, correctIndexes, seed) {
  const indexed = options.map((text, index) => ({ text, correct: correctIndexes.includes(index) }));
  const shift = indexed.length ? seed % indexed.length : 0;
  const rotated = indexed.slice(shift).concat(indexed.slice(0, shift));
  return {
    options: rotated.map((item) => item.text),
    answerIndexes: rotated.map((item, index) => (item.correct ? index : -1)).filter((index) => index >= 0),
  };
}

function pickDistractors(pool, excluded, count, seed = 0) {
  const excludedKeys = new Set(excluded.map(normalize));
  const candidates = unique(pool).filter((item) => !excludedKeys.has(normalize(item)));
  const result = [];
  for (let offset = 0; result.length < count && offset < candidates.length * 2; offset += 1) {
    const item = candidates[(seed + offset * 7) % candidates.length];
    if (item && !result.some((existing) => normalize(existing) === normalize(item))) result.push(item);
  }
  return result;
}

function makeMultiple(id, question, correctItems, distractors, explanation, seed) {
  const correct = unique(correctItems).slice(0, 2);
  if (correct.length < 2) return null;
  const wrong = pickDistractors(distractors, correct, 2, seed);
  const baseOptions = unique([...correct, ...wrong]);
  while (baseOptions.length < 4) baseOptions.push(['不能随意压缩原文语境', '不确定时要先复核最新口径'][baseOptions.length - 1]);
  const rotated = rotateOptions(baseOptions.slice(0, 4), [0, 1], seed);
  return {
    id,
    type: 'multiple',
    question: compact(question, 140),
    options: rotated.options,
    answerIndexes: rotated.answerIndexes,
    explanation: compact(explanation, 180),
  };
}

const generalWrongOptions = [
  '先承诺孩子一定能提分或录取，再解释课程安排。',
  '不确认孩子基础和家长真实问题，直接推荐最高强度班型。',
  '只截取一句话回复家长，省略原答案中的背景和边界。',
  '遇到政策、排课、费用等变化信息时，不复核最新口径就直接答复。',
  '为了促成报名，把课程效果说成确定结果。',
  '把不同项目、不同班型、不同年级的口径混在一起回答。',
  '家长提出质疑时，先反驳家长，不做解释和引导。',
  '只背标题，不回到完整答案理解语境。',
];

function lessonWrongOptions(seed = 0) {
  return pickDistractors(generalWrongOptions, [], 4, seed);
}

const advantageKeywords = [
  '匠人程',
  '程老师',
  '宁波',
  '本地',
  '名校',
  '蛟川',
  '宁外',
  '强基',
  '考情',
  '出题',
  '经验',
  '分层',
  '因材施教',
  '适配',
  '冲刺',
  '押中',
  '体系',
];

function pickAdvantageSentences(sentences, fallbackItems = []) {
  const matched = sentences.filter((sentence) => advantageKeywords.some((keyword) => sentence.includes(keyword)));
  return unique([
    ...matched,
    ...fallbackItems,
    '突出匠人程对宁波本地考情、名校节奏和孩子分层适配的理解。',
    '强调课程建议要结合孩子基础、目标学校和实际课堂表现，不做空泛承诺。',
  ]);
}

function buildTestQuestions(test, lesson) {
  const lessonItems = (lesson.questionIds || []).map((id) => questionById.get(id)).filter(Boolean);
  const answerPool = allQuestions.flatMap((item) => splitSentences(item.a).slice(0, 2));
  const built = [];
  const seenQuestion = new Set();

  function add(question) {
    if (!question) return;
    const key = normalize(question.question);
    if (!key || seenQuestion.has(key)) return;
    seenQuestion.add(key);
    question.id = `${test.id}-Q${built.length + 1}`;
    built.push(question);
  }

  lessonItems.forEach((item, index) => {
    const sentences = splitSentences(item.a);
    const answerCore = sentences[0] || item.a;
    const secondCore = sentences[1] || '回复时应保留背景、边界和下一步建议，不随意压缩语境。';
    const thirdCore = sentences[2] || '遇到不确定或实时变化的信息，要先复核最新口径再回复。';
    const fourthCore = sentences[3] || '要把孩子基础、课程匹配和家长真实顾虑放在一起判断。';
    const fifthCore = sentences[4] || '表达时既要突出优势，也要保留事实边界，不做绝对化承诺。';
    const advantageCores = pickAdvantageSentences(sentences, [answerCore, secondCore, thirdCore]);

    add(makeMultiple(
      '',
      `围绕家长问题“${compact(item.q, 54)}”，哪些内容属于标准回复要点？`,
      [answerCore, secondCore],
      [...answerPool, ...lessonWrongOptions(index)],
      `正确选项来自本节完整答案。老师要记住核心表达，同时回到原文理解完整语境。`,
      index + 3,
    ));

    add(makeMultiple(
      '',
      `处理“${compact(item.q, 48)}”这类沟通时，哪些做法更合适？`,
      [
        '先判断家长真正关心的是课程定位、学习效果、费用、政策还是执行细节。',
        '回复时保留标准话术中的背景、边界和下一步建议，不随意改口径。',
      ],
      lessonWrongOptions(index + 7),
      `这题考的是学管老师的沟通动作，不只是背一句答案。`,
      index + 13,
    ));

    add(makeMultiple(
      '',
      `复盘“${compact(item.q, 48)}”这条问答时，哪些内容需要重点记住？`,
      [answerCore, thirdCore],
      [...answerPool, ...lessonWrongOptions(index + 17)],
      `复盘题用于帮助老师记住答案重点、风险边界和不能乱答的地方。`,
      index + 23,
    ));

    add(makeMultiple(
      '',
      `回答“${compact(item.q, 48)}”时，哪些表达更能突出匠人程的优势？`,
      [advantageCores[0], advantageCores[1]],
      [...answerPool, ...lessonWrongOptions(index + 29)],
      `这题专门帮助老师记住匠人程的核心优势，答家长时要说出具体价值，不要只说空话。`,
      index + 31,
    ));

    add(makeMultiple(
      '',
      `为了帮助老师记住“${compact(item.q, 48)}”的完整话术，哪些细节不该漏掉？`,
      [secondCore, fourthCore],
      [...answerPool, ...lessonWrongOptions(index + 37)],
      `记忆题用于把原答案里的关键细节留下来，避免只记标题、忘了支撑理由。`,
      index + 41,
    ));

    add(makeMultiple(
      '',
      `家长继续追问“${compact(item.q, 44)}”时，哪些回应更稳妥、更专业？`,
      [thirdCore, fifthCore],
      [...answerPool, ...lessonWrongOptions(index + 43)],
      `追问题考的是现场表达：既要讲清优势，也要保留边界，不能乱承诺。`,
      index + 53,
    ));
  });

  if (!built.length) {
    add(makeMultiple(
      '',
      `本节“${lesson.title}”学习后，哪些动作是正确的？`,
      ['先阅读完整问答，再按家长问题匹配标准话术。', '遇到不确定信息时先复核，再回复家长。'],
      ['只背标题不看答案', '遇到问题直接承诺结果', '不确定也直接回复'],
      '学管课堂以完整问答学习和准确复述为主。',
      1,
    ));
  }

  return built;
}

training.tests = (training.tests || []).map((test) => {
  const lesson = (training.lessons || []).find((item) => item.id === test.lessonId);
  if (!lesson) return test;
  const questions = buildTestQuestions(test, lesson);
  const { scorePerQuestion, ...rest } = test;
  return {
    ...rest,
    questionCount: questions.length,
    totalScore: 100,
    scoreMode: 'percent',
    questions,
  };
});

training.testPolicy = {
  mode: 'multiple-choice-memory-test-by-lesson-content',
  description: '每节课按现有题量翻倍生成全多选记忆测试，重点帮助老师记住标准话术和匠人程优势。',
  totalScore: 100,
};
training.version = 'xueguan-training-2026-07-01-memory-tests';
training.updated_at = '2026-06-30';

fs.writeFileSync(trainingPath, `${JSON.stringify(training, null, 2)}\n`);
