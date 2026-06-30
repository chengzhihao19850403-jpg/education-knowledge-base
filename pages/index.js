'use client';

import Head from 'next/head';
import { useMemo, useState } from 'react';

import knowledgeBase from '../data/knowledge_base.json';
import trainingProgram from '../data/training_program.json';

const synonymGroups = [
  ['学费', '收费', '费用', '价格', '多少钱', '贵', '太贵'],
  ['学而思', '高斯', '举一反三', '机构区别', '普通机构'],
  ['提前学', '超前学', '进度快', '学得快', '初中内容', '高中内容'],
  ['跟不上', '听不懂', '插班', '中途进班', '基础弱', '补课'],
  ['出门测', '测试', '订正', '纸质版', '成绩'],
  ['大讲堂', '科技素养', '强基', '培优营'],
  ['宁外', '贯通', '2+4', '直升', '培优营'],
  ['蛟川', '联培', '联合培养', '学籍', '淘汰'],
  ['定向分配', '中考定向', '名额分配', '志愿'],
  ['旁听', '上楼', '厕所', '安全', '家长进楼'],
  ['请假', '补课', '课冲突', '缺课'],
  ['反馈', '课堂反馈', '学习情况', '课后辅导', '家长沟通'],
  ['红榜', '牛娃', '成绩榜', '推荐'],
  ['班型', '一班', '二班', '三班', '分班', '适合哪个班'],
];

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s、,，.。:：;；!?？！()（）【】\[\]《》"'“”‘’\-—_/\\|]/g, '');
}

function getNgrams(value) {
  const text = normalizeText(value);
  const grams = new Set();
  if (!text) return grams;

  for (const char of text) {
    grams.add(char);
  }

  for (let size = 2; size <= 4; size += 1) {
    for (let index = 0; index <= text.length - size; index += 1) {
      grams.add(text.slice(index, index + size));
    }
  }

  return grams;
}

function expandQuery(value) {
  const original = String(value || '');
  const normalized = normalizeText(original);
  const additions = [];

  for (const group of synonymGroups) {
    if (group.some((term) => normalized.includes(normalizeText(term)))) {
      additions.push(...group);
    }
  }

  return `${original} ${additions.join(' ')}`;
}

function weightedOverlap(queryGrams, targetGrams) {
  let score = 0;
  for (const gram of queryGrams) {
    if (!targetGrams.has(gram)) continue;
    if (gram.length >= 4) score += 10;
    else if (gram.length === 3) score += 6;
    else if (gram.length === 2) score += 3;
    else score += 0.7;
  }
  return score;
}

function longestCommonRun(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  let best = 0;
  const previous = Array(right.length + 1).fill(0);
  const current = Array(right.length + 1).fill(0);

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = left[i - 1] === right[j - 1] ? previous[j - 1] + 1 : 0;
      if (current[j] > best) best = current[j];
    }
    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = current[j];
      current[j] = 0;
    }
  }

  return best;
}

function flattenKnowledgeBase() {
  const items = [];

  for (const category of knowledgeBase.categories || []) {
    for (const item of category.questions || []) {
      items.push({
        ...item,
        category: category.name,
        categoryDescription: category.description,
      });
    }
  }

  return items;
}

const allQuestions = flattenKnowledgeBase();
const questionMap = new Map(allQuestions.map((item) => [item.id, item]));

function scoreQuestion(query, item) {
  const expandedQuery = expandQuery(query);
  const queryText = normalizeText(expandedQuery);
  const originalQueryText = normalizeText(query);
  const questionText = normalizeText(item.q);
  const answerText = normalizeText(item.a);
  const keywordText = normalizeText((item.keywords || []).join(' '));
  const aliasText = normalizeText((item.aliases || []).join(' '));
  const categoryText = normalizeText(item.category);
  const corpusText = `${item.q} ${item.a} ${(item.keywords || []).join(' ')} ${(item.aliases || []).join(' ')} ${item.category}`;

  if (!queryText) return 0;

  const queryGrams = getNgrams(expandedQuery);
  const questionScore = weightedOverlap(queryGrams, getNgrams(item.q));
  const answerScore = weightedOverlap(queryGrams, getNgrams(item.a));
  const keywordScore = weightedOverlap(queryGrams, getNgrams((item.keywords || []).join(' ')));
  const aliasScore = weightedOverlap(queryGrams, getNgrams((item.aliases || []).join(' ')));
  const categoryScore = weightedOverlap(queryGrams, getNgrams(item.category));
  const commonRun = longestCommonRun(query, item.q);

  let score = questionScore * 5 + aliasScore * 5 + keywordScore * 4 + categoryScore * 2 + answerScore * 1.2 + commonRun * 12;

  if (questionText.includes(queryText)) score += 520;
  if (aliasText.includes(queryText)) score += 420;
  if (keywordText.includes(queryText)) score += 260;
  if (categoryText.includes(queryText)) score += 160;
  if (answerText.includes(queryText)) score += 120;
  if (queryText.includes(questionText.slice(0, Math.min(12, questionText.length)))) score += 160;

  const queryChars = Array.from(new Set(queryText.split('')));
  const corpus = normalizeText(corpusText);
  const charHits = queryChars.filter((char) => corpus.includes(char)).length;
  const coverage = charHits / Math.max(queryChars.length, 1);
  score += coverage * 120;

  if (queryText.length <= 4 && corpus.includes(queryText)) score += 180;
  if (coverage < 0.18 && commonRun < 2) score *= 0.35;

  const strongIntentRules = [
    { pattern: /学费|收费|费用|价格|太贵|嫌贵|多少钱/, ids: ['XG015'] },
    { pattern: /装订|成册|资料乱|一张一张|讲义乱/, ids: ['XG017'] },
    { pattern: /纸质|出门测|订正|下发/, ids: ['XG021'] },
    { pattern: /学而思|高斯|举一反三|机构区别/, ids: ['XG001', 'XG016'] },
    { pattern: /听不懂|课后辅导|上课难|觉得难/, ids: ['XG047'] },
    { pattern: /插班|中途|前面没学|跟不上/, ids: ['XG008', 'XG049'] },
    { pattern: /大讲堂|科技素养/, ids: ['XG025', 'XG026', 'XG027', 'XG028'] },
    { pattern: /宁外|贯通|直升|2\+4/, ids: ['XG029', 'XG030', 'XG031', 'XG032', 'XG033'] },
    { pattern: /蛟川|联培|联合培养/, ids: ['XG034', 'XG035', 'XG036', 'XG037', 'XG038'] },
    { pattern: /旁听|上楼|厕所|家长.*楼|安全/, ids: ['XG039'] },
    { pattern: /定向|名额|志愿|降分/, ids: ['XG040', 'XG041', 'XG042', 'XG043'] },
    { pattern: /请假|补课|课冲突|缺课/, ids: ['XG046'] },
    { pattern: /红榜|牛娃|只关注自己/, ids: ['XG024'] },
    { pattern: /课内成绩.*下降|成绩反而下降|奥数.*下降/, ids: ['XG007'] },
  ];

  for (const rule of strongIntentRules) {
    if (rule.pattern.test(originalQueryText)) {
      if (rule.ids.includes(item.id)) score += 900;
      else score -= 120;
    }
  }

  return score;
}

function searchKnowledge(query) {
  const text = String(query || '').trim();
  if (!text) return { items: [], isFallback: false };

  const scored = allQuestions
    .map((item) => ({ ...item, score: scoreQuestion(text, item) }))
    .sort((a, b) => b.score - a.score);

  const strongResults = scored.filter((item) => item.score >= 35).slice(0, 16);
  if (strongResults.length > 0) {
    return { items: strongResults, isFallback: false };
  }

  return { items: scored.slice(0, 8), isFallback: true };
}

function isSameAnswer(left, right) {
  if (Array.isArray(right)) {
    const leftArray = Array.isArray(left) ? left : [];
    return leftArray.length === right.length && right.every((item) => leftArray.includes(item));
  }
  return left === right;
}

function getCorrectIndexes(question) {
  if (Array.isArray(question.answerIndexes)) return question.answerIndexes;
  if (Number.isInteger(question.answerIndex)) return [question.answerIndex];
  return [];
}

function formatChoice(index) {
  return String.fromCharCode(65 + index);
}

function getLessonQuestions(lesson) {
  return (lesson?.questionIds || []).map((id) => questionMap.get(id)).filter(Boolean);
}

function splitAnswerParagraphs(value) {
  const text = String(value || '').trim();
  if (!text) return [];

  const rawParts = text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (rawParts.length > 1) return rawParts;

  return text
    .split(/(?<=。|！|？|；)\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function AnswerText({ value, className = 'answer-text' }) {
  return (
    <div className={className}>
      {splitAnswerParagraphs(value).map((paragraph, index) => (
        <p key={`${paragraph.slice(0, 20)}-${index}`}>{paragraph}</p>
      ))}
    </div>
  );
}

export default function Home() {
  const [activeView, setActiveView] = useState('home');
  const [classroomView, setClassroomView] = useState('lessons');
  const [query, setQuery] = useState('');
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [selectedCategoryName, setSelectedCategoryName] = useState(knowledgeBase.categories?.[0]?.name || '');
  const [selectedLessonId, setSelectedLessonId] = useState(trainingProgram.lessons?.[0]?.id || '');
  const [selectedTestId, setSelectedTestId] = useState(trainingProgram.tests?.[0]?.id || '');
  const [testAnswers, setTestAnswers] = useState({});
  const [testSubmitted, setTestSubmitted] = useState(false);

  const searchResults = useMemo(() => searchKnowledge(query), [query]);
  const selectedQuestion = selectedQuestionId
    ? allQuestions.find((item) => item.id === selectedQuestionId)
    : searchResults.items[0] || allQuestions[0];
  const selectedCategory = (knowledgeBase.categories || []).find((category) => category.name === selectedCategoryName) || knowledgeBase.categories?.[0];
  const selectedCategoryQuestions = (selectedCategory?.questions || []).map((item) => ({
    ...item,
    category: selectedCategory.name,
    categoryDescription: selectedCategory.description,
  }));
  const selectedLesson = (trainingProgram.lessons || []).find((lesson) => lesson.id === selectedLessonId) || trainingProgram.lessons?.[0];
  const selectedLessonQuestions = getLessonQuestions(selectedLesson);
  const selectedTest = (trainingProgram.tests || []).find((test) => test.id === selectedTestId) || trainingProgram.tests?.[0];
  const selectedTestLesson = (trainingProgram.lessons || []).find((lesson) => lesson.id === selectedTest?.lessonId);
  const totalAnswered = selectedTest?.questions?.filter((question) => testAnswers[question.id] !== undefined).length || 0;
  const correctCount = selectedTest?.questions?.filter((question) => {
    const correct = Array.isArray(question.answerIndexes) ? question.answerIndexes : question.answerIndex;
    return isSameAnswer(testAnswers[question.id], correct);
  }).length || 0;
  const score = correctCount * (selectedTest?.scorePerQuestion || 2);
  const wrongQuestions = testSubmitted
    ? (selectedTest?.questions || []).filter((question) => {
      const correct = Array.isArray(question.answerIndexes) ? question.answerIndexes : question.answerIndex;
      return !isSameAnswer(testAnswers[question.id], correct);
    })
    : [];

  const selectResult = (id) => {
    setSelectedQuestionId(id);
    setActiveView('qa');
  };

  const selectCategory = (categoryName) => {
    setSelectedCategoryName(categoryName);
    setSelectedQuestionId('');
    setActiveView('qa');
  };

  const openUnifiedPortal = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/jrcedu/portal/index.html';
    }
  };

  const selectLesson = (lessonId) => {
    setSelectedLessonId(lessonId);
    const linkedTest = (trainingProgram.tests || []).find((test) => test.lessonId === lessonId);
    if (linkedTest) {
      setSelectedTestId(linkedTest.id);
      setTestAnswers({});
      setTestSubmitted(false);
    }
  };

  const selectTest = (testId) => {
    setSelectedTestId(testId);
    setTestAnswers({});
    setTestSubmitted(false);
    const linkedTest = (trainingProgram.tests || []).find((test) => test.id === testId);
    if (linkedTest) setSelectedLessonId(linkedTest.lessonId);
  };

  const toggleAnswer = (question, optionIndex) => {
    if (testSubmitted) return;
    setTestAnswers((current) => {
      if (question.type === 'multiple') {
        const existing = Array.isArray(current[question.id]) ? current[question.id] : [];
        const next = existing.includes(optionIndex)
          ? existing.filter((item) => item !== optionIndex)
          : [...existing, optionIndex].sort((a, b) => a - b);
        return { ...current, [question.id]: next };
      }
      return { ...current, [question.id]: optionIndex };
    });
  };

  const renderQuestionDetail = (item) => (
    <article className="detail-card">
      <div className="detail-meta">
        <span>{item.category}</span>
        <span>{item.source}</span>
      </div>
      <h2>{item.q}</h2>
      <AnswerText value={item.a} />
      {(item.keywords || []).length > 0 && (
        <div className="keyword-row">
          {item.keywords.slice(0, 12).map((keyword) => (
            <span key={keyword}>{keyword}</span>
          ))}
        </div>
      )}
    </article>
  );

  return (
    <>
      <Head>
        <title>学管知识库系统</title>
      </Head>
      <main className="knowledge-page">
        <section className="hero">
          <div>
            <div className="eyebrow">学管服务标准话术</div>
            <h1>学管知识库系统</h1>
            <p>问答查询和学管课堂分开使用。查家长问题进问答系统，学习培训和测试进学管课堂系统。</p>
          </div>
          <button type="button" className="portal-button" onClick={openUnifiedPortal}>进入员工统一工作台</button>
        </section>

        {activeView === 'home' && (
          <section className="entry-grid">
            <button type="button" className="entry-card" onClick={() => setActiveView('qa')}>
              <strong>问答查询系统</strong>
            </button>
            <button type="button" className="entry-card" onClick={() => setActiveView('classroom')}>
              <strong>学管课堂系统</strong>
            </button>
          </section>
        )}

        {activeView === 'qa' && (
          <section className="search-panel">
            <div className="system-toolbar">
              <button type="button" className="back-link" onClick={() => setActiveView('home')}>返回学管知识库系统</button>
              <strong>问答查询系统</strong>
            </div>
          <div className="search-row">
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedQuestionId('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && searchResults.items[0]) {
                  selectResult(searchResults.items[0].id);
                }
              }}
              placeholder="输入家长原话、关键词或类似问题"
            />
            <button type="button" onClick={() => searchResults.items[0] && selectResult(searchResults.items[0].id)}>查询</button>
          </div>
          <div className="metric-grid">
            <div><strong>{knowledgeBase.total}</strong><span>完整问答</span></div>
            <div><strong>{knowledgeBase.categories?.length || 0}</strong><span>问答分类</span></div>
            <div><strong>强</strong><span>模糊匹配</span></div>
          </div>
        </section>
        )}

        {activeView === 'qa' && (
          <section className="workspace-grid">
            <div className="result-list">
              <div className="section-head">
                <h2>{query.trim() ? '匹配结果' : '问答分类'}</h2>
                {query.trim() && (
                  <span>{searchResults.isFallback ? '相似匹配' : `${searchResults.items.length} 条结果`}</span>
                )}
              </div>

              {query.trim() ? (
                searchResults.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`result-button ${selectedQuestion?.id === item.id ? 'active' : ''}`}
                    onClick={() => selectResult(item.id)}
                  >
                    <span>{item.category}</span>
                    <strong>{item.q}</strong>
                  </button>
                ))
              ) : (
                (knowledgeBase.categories || []).map((category) => (
                  <div key={category.name} className={`category-card ${selectedCategoryName === category.name ? 'active' : ''}`}>
                    <div>
                      <strong>{category.name}</strong>
                      <span>{category.questions.length} 条问答</span>
                    </div>
                    <button type="button" onClick={() => selectCategory(category.name)}>
                      查看
                    </button>
                  </div>
                ))
              )}
            </div>
            <div>
              {query.trim() ? (
                selectedQuestion && renderQuestionDetail(selectedQuestion)
              ) : (
                <article className="detail-card">
                  <div className="detail-meta">
                    <span>{selectedCategory?.name}</span>
                    <span>{selectedCategoryQuestions.length} 条完整问答</span>
                  </div>
                  <h2>{selectedCategory?.name}</h2>
                  <p className="lesson-overview">以下为本分类下全部标准问答，老师可以逐条查看和学习。</p>
                  <div className="qa-stack">
                    {selectedCategoryQuestions.map((item) => (
                      <section key={item.id} className="qa-card">
                        <div className="qa-question">{item.q}</div>
                        <AnswerText value={item.a} className="qa-answer" />
                      </section>
                    ))}
                  </div>
                </article>
              )}
            </div>
          </section>
        )}

        {activeView === 'classroom' && (
          <>
            <section className="classroom-header">
              <div>
                <button type="button" className="back-link" onClick={() => setActiveView('home')}>返回学管知识库系统</button>
                <h2>学管课堂系统</h2>
                <p>先学习 20 节课，再进入阶段测试。学习和测试在这个系统内完成，不和问答查询混在一起。</p>
              </div>
              <div className="classroom-tabs">
                <button type="button" className={classroomView === 'lessons' ? 'active' : ''} onClick={() => setClassroomView('lessons')}>学习内容</button>
                <button type="button" className={classroomView === 'tests' ? 'active' : ''} onClick={() => setClassroomView('tests')}>阶段测试</button>
              </div>
            </section>
            {classroomView === 'lessons' && (
          <section className="workspace-grid">
            <div className="result-list">
              <div className="section-head">
                <h2>学习内容</h2>
                <span>{trainingProgram.lessons?.length || 0} 节</span>
              </div>
              {(trainingProgram.lessons || []).map((lesson) => (
                <button
                  key={lesson.id}
                  type="button"
                  className={`lesson-button ${lesson.id === selectedLesson?.id ? 'active' : ''}`}
                  onClick={() => selectLesson(lesson.id)}
                >
                  <span>学管课堂</span>
                  <strong>{lesson.title}</strong>
                </button>
              ))}
            </div>

            {selectedLesson && (
              <article className="detail-card">
                <div className="detail-meta">
                  <span>{selectedLesson.category}</span>
                  <span>{selectedLesson.duration}</span>
                </div>
                <h2>{selectedLesson.title}</h2>
                <p className="lesson-overview">{selectedLesson.overview}</p>

                <div className="learning-block">
                  <h3>学习目标</h3>
                  <ul>
                    {(selectedLesson.objectives || []).map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>

                <div className="learning-block">
                  <h3>本课完整问答</h3>
                  <div className="qa-stack">
                    {selectedLessonQuestions.map((item) => (
                      <section key={item.id} className="qa-card">
                        <div className="qa-question">{item.q}</div>
                        <AnswerText value={item.a} className="qa-answer" />
                      </section>
                    ))}
                  </div>
                </div>

                <div className="learning-block">
                  <h3>课后练习</h3>
                  <p>{selectedLesson.practice}</p>
                </div>
              </article>
            )}
          </section>
            )}
          </>
        )}

        {activeView === 'classroom' && classroomView === 'tests' && (
          <section className="test-workspace">
            <div className="test-toolbar">
              <div>
                <h2>{selectedTest?.title}</h2>
                <p>{selectedTestLesson?.title} · 已答 {totalAnswered}/{selectedTest?.questions?.length || 0}</p>
              </div>
              <div className="test-controls">
                <select value={selectedTestId} onChange={(event) => selectTest(event.target.value)}>
                  {(trainingProgram.tests || []).map((test) => (
                    <option key={test.id} value={test.id}>{test.title}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setTestSubmitted(true)}>交卷</button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setTestAnswers({});
                    setTestSubmitted(false);
                  }}
                >
                  重做
                </button>
              </div>
              {testSubmitted && (
                <div className="score-card">
                  <strong>{score}</strong>
                  <span>总分 100 · 正确 {correctCount} 题</span>
                </div>
              )}
            </div>

            <div className="question-stack">
              {(selectedTest?.questions || []).map((question, index) => {
                const selected = testAnswers[question.id];
                const correctIndexes = getCorrectIndexes(question);
                const correctValue = question.type === 'multiple' ? correctIndexes : correctIndexes[0];
                const questionCorrect = testSubmitted && isSameAnswer(selected, correctValue);

                return (
                  <section key={question.id} className={`test-question ${questionCorrect ? 'correct' : ''}`}>
                    <div className="test-question-head">
                      <strong>{index + 1}. {question.question}</strong>
                      <span>{question.type === 'multiple' ? '多选' : '单选'}</span>
                    </div>
                    <div className="option-grid">
                      {question.options.map((option, optionIndex) => {
                        const isSelected = Array.isArray(selected) ? selected.includes(optionIndex) : selected === optionIndex;
                        const isCorrect = correctIndexes.includes(optionIndex);
                        return (
                          <button
                            key={`${question.id}-${optionIndex}`}
                            type="button"
                            className={[
                              'option-button',
                              isSelected ? 'selected' : '',
                              testSubmitted && isCorrect ? 'right' : '',
                              testSubmitted && isSelected && !isCorrect ? 'wrong' : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => toggleAnswer(question, optionIndex)}
                          >
                            <span>{formatChoice(optionIndex)}</span>
                            {option}
                          </button>
                        );
                      })}
                    </div>
                    {testSubmitted && <p className="explanation">解析：{question.explanation}</p>}
                  </section>
                );
              })}
            </div>

            {testSubmitted && wrongQuestions.length > 0 && (
              <section className="wrong-panel">
                <h2>错题订正</h2>
                {wrongQuestions.map((question, index) => {
                  const correctIndexes = getCorrectIndexes(question);
                  return (
                    <div key={`wrong-${question.id}`} className="wrong-item">
                      <strong>{index + 1}. {question.question}</strong>
                      <p>正确答案：{correctIndexes.map((item) => `${formatChoice(item)}. ${question.options[item]}`).join('；')}</p>
                      <p>{question.explanation}</p>
                    </div>
                  );
                })}
              </section>
            )}
          </section>
        )}
      </main>

      <style jsx global>{`
        * { box-sizing: border-box; }
        body {
          margin: 0;
          background: #f5f7fb;
          color: #14213d;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        }
        button, input, select {
          font: inherit;
        }
        button {
          cursor: pointer;
        }
      `}</style>
      <style jsx>{`
        .knowledge-page {
          width: min(1180px, calc(100% - 32px));
          margin: 0 auto;
          padding: 28px 0 72px;
        }
        .hero {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 20px;
          align-items: end;
          padding: 28px;
          border: 1px solid #d9e3ee;
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 12px 28px rgba(20, 33, 61, 0.06);
        }
        .eyebrow {
          color: #0f766e;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 8px;
        }
        .hero h1 {
          margin: 0;
          color: #14213d;
          font-size: clamp(30px, 4vw, 46px);
          line-height: 1.08;
          letter-spacing: 0;
        }
        .hero p {
          max-width: 720px;
          margin: 12px 0 0;
          color: #52627a;
          font-size: 16px;
          line-height: 1.7;
        }
        .portal-button, .search-row button, .test-controls button {
          min-height: 42px;
          padding: 0 18px;
          border: 0;
          border-radius: 8px;
          background: #0f766e;
          color: #ffffff;
          font-weight: 800;
        }
        .portal-button {
          background: #1f3a5f;
        }
        .search-panel {
          margin-top: 16px;
          padding: 18px;
          border: 1px solid #d9e3ee;
          border-radius: 8px;
          background: #ffffff;
        }
        .entry-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-top: 18px;
        }
        .entry-card {
          min-height: 220px;
          padding: 34px;
          border: 1px solid #d9e3ee;
          border-radius: 8px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          text-align: center;
          box-shadow: 0 10px 24px rgba(20, 33, 61, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
        }
        .entry-card:hover {
          border-color: #2f6fbb;
          box-shadow: 0 16px 34px rgba(47, 111, 187, 0.14);
          transform: translateY(-2px);
        }
        .entry-card strong {
          display: block;
          margin: 0;
          color: #14213d;
          font-size: clamp(34px, 5vw, 52px);
          line-height: 1.15;
        }
        .system-toolbar, .classroom-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .system-toolbar strong {
          color: #14213d;
          font-size: 18px;
        }
        .back-link {
          min-height: 36px;
          padding: 0 12px;
          border: 1px solid #d0dbe7;
          border-radius: 8px;
          background: #ffffff;
          color: #1f3a5f;
          font-size: 13px;
          font-weight: 800;
        }
        .classroom-header {
          margin-top: 16px;
          padding: 20px;
          border: 1px solid #d9e3ee;
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 10px 24px rgba(20, 33, 61, 0.05);
        }
        .classroom-header h2 {
          margin: 12px 0 6px;
          color: #14213d;
          font-size: 24px;
        }
        .classroom-header p {
          margin: 0;
          max-width: 680px;
          color: #52627a;
          line-height: 1.7;
        }
        .classroom-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .classroom-tabs button {
          min-height: 42px;
          padding: 0 18px;
          border: 1px solid #d9e3ee;
          border-radius: 8px;
          background: #ffffff;
          color: #52627a;
          font-weight: 800;
        }
        .classroom-tabs button.active {
          border-color: #0f766e;
          background: #e8f5f2;
          color: #0f766e;
        }
        .search-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
        }
        .search-row input {
          width: 100%;
          min-height: 50px;
          padding: 0 16px;
          border: 1px solid #cbd6e2;
          border-radius: 8px;
          color: #14213d;
          outline: none;
          background: #fbfcfe;
        }
        .search-row input:focus {
          border-color: #0f766e;
          box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12);
        }
        .metric-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }
        .metric-grid div {
          min-height: 70px;
          padding: 14px;
          border: 1px solid #e3eaf2;
          border-radius: 8px;
          background: #f8fafc;
        }
        .metric-grid strong {
          display: block;
          color: #14213d;
          font-size: 22px;
          line-height: 1;
        }
        .metric-grid span {
          display: block;
          margin-top: 8px;
          color: #65758b;
          font-size: 13px;
        }
        .view-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 18px 0;
        }
        .view-tabs button {
          min-height: 42px;
          padding: 0 18px;
          border: 1px solid #d9e3ee;
          border-radius: 8px;
          background: #ffffff;
          color: #52627a;
          font-weight: 800;
        }
        .view-tabs button.active {
          border-color: #0f766e;
          background: #e8f5f2;
          color: #0f766e;
        }
        .workspace-grid {
          display: grid;
          grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }
        .result-list, .detail-card, .test-workspace, .wrong-panel {
          border: 1px solid #d9e3ee;
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 10px 24px rgba(20, 33, 61, 0.05);
        }
        .result-list {
          padding: 14px;
          display: grid;
          gap: 10px;
          max-height: calc(100vh - 220px);
          overflow: auto;
        }
        .section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 4px 2px 8px;
        }
        .section-head h2 {
          margin: 0;
          font-size: 18px;
        }
        .section-head span {
          color: #7a8799;
          font-size: 13px;
        }
        .result-button, .lesson-button {
          width: 100%;
          padding: 13px;
          border: 1px solid #e3eaf2;
          border-radius: 8px;
          background: #ffffff;
          text-align: left;
        }
        .result-button.active, .lesson-button.active {
          border-color: #0f766e;
          background: #f0faf8;
        }
        .result-button span, .lesson-button span {
          display: block;
          margin-bottom: 6px;
          color: #0f766e;
          font-size: 12px;
          font-weight: 800;
        }
        .result-button strong, .lesson-button strong {
          display: block;
          color: #14213d;
          font-size: 14px;
          line-height: 1.55;
        }
        .category-card {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border: 1px solid #e3eaf2;
          border-radius: 8px;
          background: #fbfcfe;
        }
        .category-card.active {
          border-color: #0f766e;
          background: #f0faf8;
        }
        .category-card strong, .category-card span {
          display: block;
        }
        .category-card strong {
          font-size: 15px;
        }
        .category-card span {
          margin-top: 6px;
          color: #65758b;
          font-size: 13px;
        }
        .category-card button {
          min-height: 34px;
          padding: 0 12px;
          border: 1px solid #d0dbe7;
          border-radius: 8px;
          background: #ffffff;
          color: #1f3a5f;
          font-weight: 800;
        }
        .detail-card {
          padding: clamp(18px, 3vw, 30px);
        }
        .detail-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .detail-meta span, .keyword-row span {
          display: inline-flex;
          align-items: center;
          min-height: 26px;
          padding: 0 10px;
          border-radius: 999px;
          background: #eef4fb;
          color: #52627a;
          font-size: 12px;
          font-weight: 800;
        }
        .detail-meta span:first-child {
          background: #e8f5f2;
          color: #0f766e;
        }
        .detail-card h2 {
          margin: 0 0 16px;
          color: #14213d;
          font-size: clamp(22px, 3vw, 30px);
          line-height: 1.35;
          letter-spacing: 0;
        }
        .answer-text, .qa-answer {
          color: #334155;
          font-size: 15px;
          line-height: 1.9;
        }
        .answer-text p, .qa-answer p {
          margin: 0 0 16px;
        }
        .answer-text p:last-child, .qa-answer p:last-child {
          margin-bottom: 0;
        }
        .keyword-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 20px;
        }
        .lesson-overview, .learning-block p {
          color: #52627a;
          line-height: 1.8;
        }
        .learning-block {
          margin-top: 22px;
          padding-top: 18px;
          border-top: 1px solid #e3eaf2;
        }
        .learning-block h3 {
          margin: 0 0 12px;
          color: #14213d;
          font-size: 17px;
        }
        .learning-block ul {
          margin: 0;
          padding-left: 22px;
          color: #334155;
          line-height: 1.8;
        }
        .qa-stack, .question-stack {
          display: grid;
          gap: 12px;
        }
        .qa-card {
          padding: 16px;
          border: 1px solid #e3eaf2;
          border-radius: 8px;
          background: #fbfcfe;
        }
        .qa-question {
          margin-bottom: 10px;
          color: #14213d;
          font-weight: 900;
          line-height: 1.6;
        }
        .test-workspace {
          padding: clamp(16px, 3vw, 24px);
        }
        .test-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          gap: 16px;
          align-items: center;
          margin-bottom: 16px;
        }
        .test-toolbar h2 {
          margin: 0;
          font-size: 22px;
        }
        .test-toolbar p {
          margin: 8px 0 0;
          color: #65758b;
        }
        .test-controls {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .test-controls select {
          min-height: 42px;
          padding: 0 12px;
          border: 1px solid #cbd6e2;
          border-radius: 8px;
          background: #ffffff;
          color: #14213d;
        }
        .test-controls .ghost {
          border: 1px solid #d0dbe7;
          background: #ffffff;
          color: #1f3a5f;
        }
        .score-card {
          min-width: 150px;
          padding: 12px 14px;
          border-radius: 8px;
          background: #fff7ed;
          color: #9a3412;
        }
        .score-card strong {
          display: block;
          font-size: 30px;
          line-height: 1;
        }
        .score-card span {
          display: block;
          margin-top: 8px;
          font-size: 12px;
          font-weight: 800;
        }
        .test-question {
          padding: 18px;
          border: 1px solid #e3eaf2;
          border-radius: 8px;
          background: #ffffff;
        }
        .test-question.correct {
          border-color: #86efac;
          background: #f0fdf4;
        }
        .test-question-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        .test-question-head strong {
          color: #14213d;
          line-height: 1.6;
        }
        .test-question-head span {
          flex: 0 0 auto;
          color: #0f766e;
          font-size: 12px;
          font-weight: 900;
        }
        .option-grid {
          display: grid;
          gap: 8px;
        }
        .option-button {
          display: grid;
          grid-template-columns: 28px 1fr;
          gap: 10px;
          align-items: start;
          width: 100%;
          min-height: 44px;
          padding: 10px 12px;
          border: 1px solid #d9e3ee;
          border-radius: 8px;
          background: #fbfcfe;
          color: #334155;
          text-align: left;
          line-height: 1.55;
        }
        .option-button span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: #eef4fb;
          color: #1f3a5f;
          font-size: 12px;
          font-weight: 900;
        }
        .option-button.selected {
          border-color: #1f3a5f;
          background: #eef4fb;
        }
        .option-button.right {
          border-color: #16a34a;
          background: #dcfce7;
          color: #14532d;
        }
        .option-button.wrong {
          border-color: #dc2626;
          background: #fef2f2;
          color: #991b1b;
        }
        .explanation {
          margin: 12px 0 0;
          color: #52627a;
          font-size: 14px;
          line-height: 1.7;
        }
        .wrong-panel {
          margin-top: 18px;
          padding: 20px;
        }
        .wrong-panel h2 {
          margin: 0 0 14px;
        }
        .wrong-item {
          padding: 14px 0;
          border-top: 1px solid #e3eaf2;
        }
        .wrong-item strong {
          display: block;
          line-height: 1.6;
        }
        .wrong-item p {
          margin: 8px 0 0;
          color: #52627a;
          line-height: 1.7;
        }
        @media (max-width: 900px) {
          .knowledge-page {
            width: min(100% - 20px, 760px);
            padding-top: 10px;
          }
          .hero {
            grid-template-columns: 1fr;
            padding: 22px;
          }
          .portal-button {
            width: 100%;
          }
          .workspace-grid {
            grid-template-columns: 1fr;
          }
          .entry-grid {
            grid-template-columns: 1fr;
          }
          .result-list {
            max-height: none;
          }
          .test-toolbar {
            grid-template-columns: 1fr;
          }
          .test-controls {
            justify-content: stretch;
          }
          .test-controls select, .test-controls button {
            flex: 1 1 140px;
          }
        }
        @media (max-width: 560px) {
          .knowledge-page {
            width: min(100% - 14px, 520px);
          }
          .hero, .search-panel, .detail-card, .test-workspace {
            border-radius: 8px;
          }
          .hero h1 {
            font-size: 30px;
          }
          .search-row, .metric-grid {
            grid-template-columns: 1fr;
          }
          .view-tabs button {
            flex: 1 1 100%;
          }
          .option-button {
            grid-template-columns: 26px 1fr;
          }
        }
      `}</style>
    </>
  );
}
