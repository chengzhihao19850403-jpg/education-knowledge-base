import fs from 'node:fs';

const trainingPath = new URL('../data/training_program.json', import.meta.url);
const kbPath = new URL('../data/knowledge_base.json', import.meta.url);

const training = JSON.parse(fs.readFileSync(trainingPath, 'utf8'));
const knowledgeBase = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
const categories = knowledgeBase.categories || knowledgeBase.bd || [];
const categoryMap = new Map(categories.map((category) => [category.name, category.questions || []]));

function compactText(value, maxLength = 92) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function uniqueOptions(options) {
  const seen = new Set();
  const result = [];
  for (const option of options) {
    const text = compactText(option, 110);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function makeQuestion(id, question, correct, wrongOptions, explanation) {
  const options = uniqueOptions([correct, ...wrongOptions]);
  const fallbackWrong = ['现场承诺结果', '忽略孩子基础', '不记录来源', '随意改变口径'];
  for (const option of fallbackWrong) {
    if (options.length >= 4) break;
    if (!options.includes(option)) options.push(option);
  }

  return {
    id,
    question: compactText(question, 140),
    options: options.slice(0, 4),
    answerIndex: 0,
    explanation: compactText(explanation, 140),
  };
}

function getLessonKnowledge(lesson) {
  const items = [];
  for (const source of lesson.sources || []) {
    const questions = categoryMap.get(source) || [];
    for (const item of questions) {
      if (!item.q || !item.a) continue;
      items.push({
        question: item.q,
        answer: item.a,
        source,
      });
    }
  }
  return items;
}

function otherAnswers(knowledgeItems, index) {
  const options = [];
  const offsets = [7, 17, 29, 43, 61, 79];
  for (const offset of offsets) {
    const item = knowledgeItems[(index + offset) % knowledgeItems.length];
    if (item?.answer) options.push(item.answer);
  }
  return options;
}

function buildBaseQuestions(test, lesson) {
  const questions = [];
  const wrongDefaults = ['先承诺优惠或结果', '只按家长期望推荐最高班', '不确认最新口径直接回答', '只背标题不做应用'];

  questions.push(makeQuestion(
    `${test.id}-Q1`,
    `本节“${lesson.title}”最核心的学习目标是什么？`,
    lesson.objectives?.[0] || '掌握本节岗位能力',
    wrongDefaults,
    '新人要先掌握本节对应的核心岗位能力。',
  ));

  (lesson.objectives || []).slice(0, 4).forEach((objective, index) => {
    questions.push(makeQuestion(
      `${test.id}-Q${questions.length + 1}`,
      `关于本节学习目标，哪一项必须做到？`,
      objective,
      wrongDefaults,
      '学习目标是本节课的验收标准。',
    ));
  });

  (lesson.keyPoints || []).slice(0, 6).forEach((point) => {
    questions.push(makeQuestion(
      `${test.id}-Q${questions.length + 1}`,
      `本节关键要点中，哪一项是正确口径？`,
      point,
      wrongDefaults,
      '关键要点需要新人准确记忆并能转成家长听得懂的话。',
    ));
  });

  (lesson.expandedSections || []).forEach((section) => {
    (section.items || []).slice(0, 4).forEach((item) => {
      questions.push(makeQuestion(
        `${test.id}-Q${questions.length + 1}`,
        `在“${section.title}”中，正确做法是哪一项？`,
        item,
        wrongDefaults,
        `该题来自本节“${section.title}”。`,
      ));
    });
  });

  (lesson.trainerNotes || []).forEach((note) => {
    questions.push(makeQuestion(
      `${test.id}-Q${questions.length + 1}`,
      `讲师提示中强调了什么？`,
      note,
      wrongDefaults,
      '讲师提示用于训练新人落地执行。',
    ));
  });

  return questions;
}

function buildKnowledgeQuestions(test, lesson, startIndex) {
  const knowledgeItems = getLessonKnowledge(lesson);
  const questions = [];
  if (knowledgeItems.length === 0) return questions;

  for (let index = 0; questions.length < 60 && index < knowledgeItems.length; index += 1) {
    const item = knowledgeItems[index];
    const answer = compactText(item.answer, 100);
    if (answer.length < 4) continue;

    questions.push(makeQuestion(
      `${test.id}-Q${startIndex + questions.length}`,
      `根据本节知识库资料，“${compactText(item.question, 70)}”的正确答案是哪一项？`,
      answer,
      otherAnswers(knowledgeItems, index),
      `该题来自“${item.source}”模块，新人需要熟悉原问答口径。`,
    ));
  }

  return questions;
}

function buildReinforcementQuestion(test, lesson, index) {
  const sections = lesson.expandedSections || [];
  const section = sections[index % Math.max(sections.length, 1)];
  const sectionItems = section?.items || [];
  const sourcePool = [
    ...(lesson.objectives || []),
    ...(lesson.keyPoints || []),
    ...(lesson.content || []),
    ...sectionItems,
    ...(lesson.trainerNotes || []),
    lesson.practice,
  ].filter(Boolean);
  const correct = sourcePool[index % sourcePool.length] || '先确认事实，再按统一口径处理';

  return makeQuestion(
    `${test.id}-R${index + 1}`,
    `本节第 ${index + 1} 个巩固考点中，哪一项最符合“${lesson.title}”的培训要求？`,
    correct,
    ['现场承诺升学或提分结果', '跳过基础诊断直接报名', '遇到不确定内容也直接答复', '只看价格不看适配'],
    '巩固题用于保证新人反复掌握本节关键动作、表达和风险边界。',
  );
}

function rotateAnswer(question, index) {
  const options = question.options || [];
  if (options.length !== 4) return question;

  const originalAnswer = options[question.answerIndex || 0];
  const shift = index % 4;
  const rotatedOptions = options.slice(shift).concat(options.slice(0, shift));

  return {
    ...question,
    options: rotatedOptions,
    answerIndex: rotatedOptions.indexOf(originalAnswer),
  };
}

training.tests = (training.tests || []).map((test) => {
  const lesson = (training.lessons || []).find((item) => item.id === test.lessonId);
  if (!lesson) return test;

  const existing = (test.questions || []).map((question, index) => ({
    ...question,
    id: `${test.id}-Q${index + 1}`,
  }));
  const generatedBase = buildBaseQuestions(test, lesson);
  const knowledgeQuestions = buildKnowledgeQuestions(test, lesson, existing.length + generatedBase.length + 1);
  const combined = [];
  const seenQuestion = new Set();

  for (const question of [...existing, ...generatedBase, ...knowledgeQuestions]) {
    if (!question.question || seenQuestion.has(question.question)) continue;
    seenQuestion.add(question.question);
    combined.push({
      ...question,
      id: `${test.id}-Q${combined.length + 1}`,
    });
    if (combined.length >= 50) break;
  }

  let reinforcementIndex = 0;
  while (combined.length < 50) {
    const question = buildReinforcementQuestion(test, lesson, reinforcementIndex);
    reinforcementIndex += 1;
    if (seenQuestion.has(question.question)) continue;
    seenQuestion.add(question.question);
    combined.push({
      ...question,
      id: `${test.id}-Q${combined.length + 1}`,
    });
  }

  return {
    ...test,
    questionCount: combined.length,
    questions: combined.map((question, index) => rotateAnswer(question, index)),
  };
});

training.version = 'training-v003-50-question-tests';
training.updatedAt = '2026-06-15';

fs.writeFileSync(trainingPath, `${JSON.stringify(training, null, 2)}\n`);
