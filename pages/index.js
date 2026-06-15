'use client';

import { useState } from 'react';

import knowledgeBase from '../data/knowledge_base.json';
import trainingProgram from '../data/training_program.json';


function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '');
}

function getSearchTokens(value) {
  const normalized = normalizeText(value).replace(/[^\u4e00-\u9fa5a-z0-9]/g, '');
  const ignoredTokens = new Set(['完全', '不', '无', '有', '没有', '多少', '怎么', '什么', '问题', '答案']);
  const tokens = new Set();

  for (const char of normalized) {
    if (!ignoredTokens.has(char)) tokens.add(char);
  }

  for (let index = 0; index < normalized.length - 1; index += 1) {
    const token = normalized.slice(index, index + 2);
    if (!ignoredTokens.has(token)) tokens.add(token);
  }

  return tokens;
}

function getTokenWeight(token) {
  return token.length === 1 ? 1 : 3;
}

function weightedOverlap(queryTokens, targetTokens) {
  let overlap = 0;

  for (const token of queryTokens) {
    if (targetTokens.has(token)) overlap += getTokenWeight(token);
  }

  return overlap;
}

function similarityScore(query, item, categoryName) {
  const queryTokens = getSearchTokens(query);
  if (queryTokens.size === 0) return 0;

  const maxScore = Array.from(queryTokens).reduce((sum, token) => sum + getTokenWeight(token), 0);
  const questionOverlap = weightedOverlap(queryTokens, getSearchTokens(item.q));
  const keywordOverlap = weightedOverlap(queryTokens, getSearchTokens((item.keywords || []).join(' ')));
  const answerOverlap = weightedOverlap(queryTokens, getSearchTokens(item.a));
  const sourceOverlap = weightedOverlap(queryTokens, getSearchTokens(`${item.source || ''} ${item.source_section || ''}`));
  const categoryOverlap = weightedOverlap(queryTokens, getSearchTokens(categoryName));
  const coverage = Math.max(questionOverlap, keywordOverlap, answerOverlap, sourceOverlap, categoryOverlap) / maxScore;
  const question = normalizeText(item.q);
  const answer = normalizeText(item.a);
  const category = normalizeText(categoryName);
  const queryLower = normalizeText(query);
  let overlap = questionOverlap * 4 + keywordOverlap * 3 + answerOverlap + sourceOverlap + categoryOverlap;

  if (coverage < 0.25) return 0;

  if (question.includes(queryLower.slice(0, 2))) overlap += 2;
  if (answer.includes(queryLower.slice(0, 2))) overlap += 1;
  if (category.includes(queryLower.slice(0, 2))) overlap += 1;

  return overlap;
}

function createResult(item, categoryName, score, isSimilar = false) {
  return {
    id: item.id,
    question: item.q,
    answer: item.a,
    category: categoryName,
    keywords: item.keywords || [],
    source: item.source,
    sourceSection: item.source_section,
    reviewStatus: item.review_status,
    score,
    isSimilar,
  };
}

function searchKnowledge(query) {
  const queryLower = normalizeText(query);
  const results = [];
  const similarResults = [];

  for (const category of knowledgeBase.categories || []) {
    for (const item of category.questions || []) {
      const question = normalizeText(item.q);
      const answer = normalizeText(item.a);
      const keywords = normalizeText((item.keywords || []).join(' '));
      const source = normalizeText(`${item.source || ''} ${item.source_section || ''}`);
      const categoryName = normalizeText(category.name);
      let score = 0;

      if (question.includes(queryLower)) score += 10;
      if (categoryName.includes(queryLower)) score += 7;
      if (keywords.includes(queryLower)) score += 6;
      if (answer.includes(queryLower)) score += 3;
      if (source.includes(queryLower)) score += 1;
      if (['小学课本目录', '初中课本目录'].includes(category.name) && score > 0) score += 8;

      if (score > 0) {
        results.push(createResult(item, category.name, score));
      } else {
        const similarScore = similarityScore(query, item, category.name);
        if (similarScore >= 5) {
          similarResults.push(createResult(item, category.name, similarScore, true));
        }
      }
    }
  }

  if (results.length > 0) {
    return {
      items: results.sort((a, b) => b.score - a.score).slice(0, 50),
      isFallback: false,
    };
  }

  return {
    items: similarResults.sort((a, b) => b.score - a.score).slice(0, 12),
    isFallback: true,
  };
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isFallback, setIsFallback] = useState(false);
  const [focused, setFocused] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState(trainingProgram.lessons?.[0]?.id);
  const [selectedTestId, setSelectedTestId] = useState(trainingProgram.tests?.[0]?.id);
  const [testAnswers, setTestAnswers] = useState({});
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [activeTrainingModule, setActiveTrainingModule] = useState(null);

  const selectedLesson = (trainingProgram.lessons || []).find((lesson) => lesson.id === selectedLessonId) || trainingProgram.lessons?.[0];
  const selectedTest = (trainingProgram.tests || []).find((test) => test.id === selectedTestId) || trainingProgram.tests?.[0];
  const selectedTestLesson = (trainingProgram.lessons || []).find((lesson) => lesson.id === selectedTest?.lessonId);
  const testScore = selectedTest?.questions?.reduce((score, question) => {
    return score + (testAnswers[question.id] === question.answerIndex ? 1 : 0);
  }, 0) || 0;

  const handleSearch = () => {
    if (!query.trim()) {
      setResults([]);
      setIsFallback(false);
      return;
    }
    const searchResults = searchKnowledge(query);
    setResults(searchResults.items);
    setIsFallback(searchResults.isFallback);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const quickSearch = (q) => {
    setQuery(q);
    setTimeout(() => {
      const searchResults = searchKnowledge(q);
      setResults(searchResults.items);
      setIsFallback(searchResults.isFallback);
    }, 50);
  };

  const selectLesson = (lessonId) => {
    setActiveTrainingModule('lessons');
    setSelectedLessonId(lessonId);
    const linkedTest = (trainingProgram.tests || []).find((test) => test.lessonId === lessonId);
    if (linkedTest) {
      setSelectedTestId(linkedTest.id);
      setTestAnswers({});
      setTestSubmitted(false);
    }
  };

  const selectTest = (testId) => {
    setActiveTrainingModule('tests');
    setSelectedTestId(testId);
    setTestAnswers({});
    setTestSubmitted(false);
    const linkedTest = (trainingProgram.tests || []).find((test) => test.id === testId);
    if (linkedTest) setSelectedLessonId(linkedTest.lessonId);
  };

  const chooseAnswer = (questionId, answerIndex) => {
    if (testSubmitted) return;
    setTestAnswers((current) => ({ ...current, [questionId]: answerIndex }));
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>匠人程学校知识库</h1>
        <p style={styles.subtitle}>输入问题，快速找到答案</p>
        <div style={styles.versionInfo}>知识库 {knowledgeBase.version} · {knowledgeBase.total} 条问答</div>
      </div>

      <div style={styles.searchContainer}>
        <div style={{
          ...styles.searchBox,
          boxShadow: focused ? '0 4px 30px rgba(13, 148, 136, 0.12)' : '0 2px 20px rgba(0,0,0,0.04)'
        }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="搜索问题..."
            style={styles.input}
          />
          <button onClick={handleSearch} style={styles.button}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            查询
          </button>
        </div>

        <div style={styles.quickSearches}>
          {['学费多少钱', '圆柱与圆锥', '初中课本目录', '二次函数', '勾股定理'].map((item) => (
            <button key={item} onClick={() => quickSearch(item)} style={styles.quickButton}>{item}</button>
          ))}
        </div>
      </div>

      <div style={styles.jiaoguanSection}>
        <div style={styles.jiaoguanHeader}>
          <h2 style={styles.jiaoguanTitle}>学管课堂</h2>
          <p style={styles.jiaoguanSubtitle}>20 节新人培训课 · 20 套线上小测试</p>
        </div>

        {!activeTrainingModule ? (
          <div style={styles.moduleGrid}>
            <button onClick={() => setActiveTrainingModule('lessons')} style={styles.moduleCard}>
              <div style={styles.moduleIcon}>📚</div>
              <div style={styles.moduleTitle}>学习内容</div>
              <div style={styles.moduleDesc}>20 节系统课程，按新人上岗路径逐课学习</div>
            </button>
            <button onClick={() => setActiveTrainingModule('tests')} style={styles.moduleCard}>
              <div style={styles.moduleIcon}>📝</div>
              <div style={styles.moduleTitle}>阶段测试</div>
              <div style={styles.moduleDesc}>20 套线上小测试，提交后显示得分和解析</div>
            </button>
          </div>
        ) : (
          <div style={styles.trainingShell}>
            <div style={styles.moduleToolbar}>
              <button onClick={() => setActiveTrainingModule(null)} style={styles.backButton}>返回学管课堂</button>
              <div style={styles.moduleToolbarTitle}>
                {activeTrainingModule === 'lessons' ? '学习内容' : '阶段测试'}
              </div>
            </div>

            {activeTrainingModule === 'lessons' && (
              <>
                <div style={styles.lessonList}>
                  {(trainingProgram.lessons || []).map((lesson) => (
                    <button
                      key={lesson.id}
                      onClick={() => selectLesson(lesson.id)}
                      style={{
                        ...styles.lessonButton,
                        ...(lesson.id === selectedLessonId ? styles.lessonButtonActive : {}),
                      }}
                    >
                      <span style={styles.lessonButtonId}>{lesson.id}</span>
                      <span style={styles.lessonButtonText}>{lesson.title}</span>
                    </button>
                  ))}
                </div>

                {selectedLesson && (
                  <div style={styles.lessonDetail}>
                    <div style={styles.lessonMetaRow}>
                      <span style={styles.lessonTag}>{selectedLesson.category}</span>
                      <span style={styles.lessonTag}>{selectedLesson.duration}</span>
                    </div>
                    <h3 style={styles.lessonTitle}>{selectedLesson.id} {selectedLesson.title}</h3>

                    <div style={styles.trainingBlock}>
                      <div style={styles.trainingBlockTitle}>学习目标</div>
                      <ul style={styles.trainingList}>
                        {selectedLesson.objectives.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>

                    <div style={styles.trainingBlock}>
                      <div style={styles.trainingBlockTitle}>课程内容</div>
                      {selectedLesson.content.map((item) => (
                        <p key={item} style={styles.lessonParagraph}>{item}</p>
                      ))}
                    </div>

                    <div style={styles.trainingBlock}>
                      <div style={styles.trainingBlockTitle}>关键要点</div>
                      <div style={styles.keyPointWrap}>
                        {selectedLesson.keyPoints.map((item) => <span key={item} style={styles.keyPoint}>{item}</span>)}
                      </div>
                    </div>

                    <div style={styles.trainingBlock}>
                      <div style={styles.trainingBlockTitle}>课后练习</div>
                      <p style={styles.lessonParagraph}>{selectedLesson.practice}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTrainingModule === 'tests' && (
              <>
                <div style={styles.lessonList}>
                  {(trainingProgram.tests || []).map((test) => {
                    const lesson = (trainingProgram.lessons || []).find((item) => item.id === test.lessonId);
                    return (
                      <button
                        key={test.id}
                        onClick={() => selectTest(test.id)}
                        style={{
                          ...styles.lessonButton,
                          ...(test.id === selectedTestId ? styles.lessonButtonActive : {}),
                        }}
                      >
                        <span style={styles.lessonButtonId}>{test.id}</span>
                        <span style={styles.lessonButtonText}>{lesson?.title || test.title}</span>
                      </button>
                    );
                  })}
                </div>

                <div style={styles.testPanel}>
                  <div style={styles.testHeader}>
                    <div>
                      <div style={styles.trainingBlockTitle}>线上小测试</div>
                      <div style={styles.testSubtitle}>{selectedTestLesson?.id} {selectedTestLesson?.title}</div>
                    </div>
                    <select
                      value={selectedTestId}
                      onChange={(event) => selectTest(event.target.value)}
                      style={styles.testSelect}
                    >
                      {(trainingProgram.tests || []).map((test) => (
                        <option key={test.id} value={test.id}>{test.id}</option>
                      ))}
                    </select>
                  </div>

                  {selectedTest?.questions?.map((question, questionIndex) => (
                    <div key={question.id} style={styles.questionBlock}>
                      <div style={styles.questionTitle}>{questionIndex + 1}. {question.question}</div>
                      <div style={styles.optionList}>
                        {question.options.map((option, optionIndex) => {
                          const isChosen = testAnswers[question.id] === optionIndex;
                          const isCorrect = question.answerIndex === optionIndex;
                          const showCorrect = testSubmitted && isCorrect;
                          const showWrong = testSubmitted && isChosen && !isCorrect;
                          return (
                            <button
                              key={option}
                              onClick={() => chooseAnswer(question.id, optionIndex)}
                              style={{
                                ...styles.optionButton,
                                ...(isChosen ? styles.optionButtonChosen : {}),
                                ...(showCorrect ? styles.optionButtonCorrect : {}),
                                ...(showWrong ? styles.optionButtonWrong : {}),
                              }}
                            >
                              {String.fromCharCode(65 + optionIndex)}. {option}
                            </button>
                          );
                        })}
                      </div>
                      {testSubmitted && <div style={styles.explanation}>解析：{question.explanation}</div>}
                    </div>
                  ))}

                  <div style={styles.testActions}>
                    <button
                      onClick={() => setTestSubmitted(true)}
                      style={styles.testSubmitButton}
                    >
                      提交测试
                    </button>
                    <button
                      onClick={() => {
                        setTestAnswers({});
                        setTestSubmitted(false);
                      }}
                      style={styles.testResetButton}
                    >
                      重新作答
                    </button>
                    {testSubmitted && (
                      <div style={styles.scoreText}>
                        得分：{testScore}/{selectedTest.questions.length}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div style={styles.results}>
        {results.length > 0 ? (
          <>
            <div style={styles.resultSummary}>
              {isFallback
                ? `没有找到完全匹配，显示 ${results.length} 条相似问题`
                : `找到 ${results.length} 条最相关结果`}
            </div>
            {results.map((item) => (
          <div key={item.id} style={styles.resultItem}>
            <div style={styles.resultQuestion}>{item.question}</div>
            <div style={styles.resultAnswer}>{item.answer}</div>
            <div style={styles.metaRow}>
              <span style={styles.resultCategory}>{item.category}</span>
              {item.isSimilar && <span style={styles.similarTag}>相似问题</span>}
              {item.reviewStatus && <span style={styles.statusTag}>{item.reviewStatus}</span>}
            </div>
            {(item.source || item.sourceSection) && (
              <div style={styles.sourceText}>来源：{item.source}{item.sourceSection ? ` · ${item.sourceSection}` : ''}</div>
            )}
          </div>
            ))}
          </>
        ) : query.trim() ? (
          <div style={styles.noResults}>未找到相关答案</div>
        ) : (
          <div style={styles.tipsBox}>
            💡 点击上方快捷问题，或输入关键词搜索
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', sans-serif; }
        input::placeholder { color: #A0AEC0; }
        button:hover { opacity: 0.9; }
        button:active { transform: scale(0.98); }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#FFFFFF',
    paddingBottom: '80px',
  },
  header: {
    textAlign: 'center',
    padding: '80px 24px 48px',
  },
  title: {
    fontSize: '36px',
    fontWeight: '700',
    color: '#1A202C',
    letterSpacing: '-0.02em',
    marginBottom: '10px',
  },
  subtitle: {
    fontSize: '24px',
    fontWeight: '400',
    color: '#718096',
    marginTop: '0',
  },
  versionInfo: {
    display: 'inline-block',
    marginTop: '18px',
    padding: '6px 12px',
    borderRadius: '999px',
    background: '#EFF7F6',
    color: '#0D9488',
    fontSize: '13px',
    fontWeight: '600',
  },
  searchContainer: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '0 24px',
  },
  searchBox: {
    display: 'flex',
    background: '#F5F7FA',
    borderRadius: '22px',
    padding: '6px',
    transition: 'box-shadow 0.3s ease',
  },
  input: {
    flex: 1,
    padding: '16px 24px',
    border: 'none',
    background: 'transparent',
    fontSize: '17px',
    outline: 'none',
    color: '#1A202C',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 26px',
    background: '#0D9488',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '18px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  quickSearches: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '16px',
    justifyContent: 'center',
  },
  quickButton: {
    border: '1px solid #D7E8E5',
    background: '#FFFFFF',
    color: '#0D9488',
    borderRadius: '999px',
    padding: '8px 12px',
    fontSize: '13px',
    cursor: 'pointer',
  },

  results: {
    maxWidth: '700px',
    margin: '40px auto',
    padding: '0 24px',
  },
  resultSummary: {
    color: '#718096',
    fontSize: '14px',
    marginBottom: '14px',
    textAlign: 'center',
  },
  resultItem: {
    background: '#FFFFFF',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '16px',
    border: '1px solid #E2E8F0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  resultQuestion: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#1A202C',
    marginBottom: '12px',
    lineHeight: '1.5',
  },
  resultAnswer: {
    fontSize: '15px',
    color: '#4A5568',
    lineHeight: '1.7',
    marginBottom: '12px',
  },
  resultCategory: {
    display: 'inline-block',
    padding: '4px 12px',
    background: '#EFF7F6',
    color: '#0D9488',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
  },
  metaRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: '8px',
  },
  statusTag: {
    display: 'inline-block',
    padding: '4px 10px',
    background: '#F7FAFC',
    color: '#718096',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
  },
  similarTag: {
    display: 'inline-block',
    padding: '4px 10px',
    background: '#FFF7ED',
    color: '#C2410C',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
  },
  sourceText: {
    color: '#A0AEC0',
    fontSize: '12px',
    lineHeight: '1.5',
  },
  noResults: {
    textAlign: 'center',
    padding: '60px 24px',
    color: '#A0AEC0',
    fontSize: '15px',
  },

  jiaoguanSection: {
    maxWidth: '1100px',
    marginTop: '120px',
    margin: '0 auto 40px',
    padding: '0 24px',
    paddingTop: '0',
  },
  jiaoguanHeader: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  jiaoguanTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: '8px',
  },
  jiaoguanSubtitle: {
    fontSize: '14px',
    color: '#A0AEC0',
    margin: '0',
  },
  moduleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
  },
  moduleCard: {
    minHeight: '160px',
    padding: '28px 24px',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    background: '#FFFFFF',
    color: '#1A202C',
    textAlign: 'center',
    cursor: 'pointer',
  },
  moduleIcon: {
    fontSize: '36px',
    marginBottom: '12px',
  },
  moduleTitle: {
    fontSize: '18px',
    fontWeight: '700',
    marginBottom: '8px',
  },
  moduleDesc: {
    color: '#718096',
    fontSize: '14px',
    lineHeight: '1.6',
  },
  trainingShell: {
    display: 'flex',
    gap: '18px',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  moduleToolbar: {
    flex: '1 1 100%',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '2px',
  },
  backButton: {
    padding: '9px 12px',
    border: '1px solid #D7E8E5',
    borderRadius: '8px',
    background: '#FFFFFF',
    color: '#0D9488',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  moduleToolbarTitle: {
    color: '#1A202C',
    fontSize: '18px',
    fontWeight: '700',
  },
  lessonList: {
    flex: '0 1 280px',
    display: 'grid',
    gap: '8px',
  },
  lessonButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    minHeight: '44px',
    padding: '10px 12px',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    background: '#FFFFFF',
    color: '#1A202C',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '13px',
  },
  lessonButtonActive: {
    borderColor: '#0D9488',
    background: '#EFF7F6',
  },
  lessonButtonId: {
    flex: '0 0 auto',
    color: '#0D9488',
    fontSize: '12px',
    fontWeight: '600',
  },
  lessonButtonText: {
    lineHeight: '1.35',
  },
  lessonDetail: {
    flex: '1 1 420px',
    minWidth: '280px',
    padding: '22px',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    background: '#FFFFFF',
  },
  lessonMetaRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '10px',
  },
  lessonTag: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '12px',
    background: '#F7FAFC',
    color: '#718096',
    fontSize: '12px',
  },
  lessonTitle: {
    margin: '0 0 16px',
    color: '#1A202C',
    fontSize: '22px',
    lineHeight: '1.35',
  },
  trainingBlock: {
    marginTop: '16px',
  },
  trainingBlockTitle: {
    color: '#1A202C',
    fontSize: '15px',
    fontWeight: '700',
    marginBottom: '8px',
  },
  trainingList: {
    margin: '0',
    paddingLeft: '20px',
    color: '#4A5568',
    fontSize: '14px',
    lineHeight: '1.7',
  },
  lessonParagraph: {
    margin: '0 0 10px',
    color: '#4A5568',
    fontSize: '14px',
    lineHeight: '1.8',
  },
  keyPointWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  keyPoint: {
    display: 'inline-block',
    padding: '5px 10px',
    borderRadius: '12px',
    background: '#EFF7F6',
    color: '#0D9488',
    fontSize: '12px',
    fontWeight: '600',
  },
  testPanel: {
    flex: '1 1 100%',
    padding: '22px',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    background: '#FFFFFF',
  },
  testHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: '16px',
  },
  testSubtitle: {
    color: '#718096',
    fontSize: '13px',
  },
  testSelect: {
    minWidth: '110px',
    padding: '9px 10px',
    border: '1px solid #CBD5E0',
    borderRadius: '8px',
    background: '#FFFFFF',
    color: '#1A202C',
  },
  questionBlock: {
    padding: '16px 0',
    borderTop: '1px solid #EDF2F7',
  },
  questionTitle: {
    color: '#1A202C',
    fontSize: '15px',
    fontWeight: '600',
    lineHeight: '1.5',
    marginBottom: '10px',
  },
  optionList: {
    display: 'grid',
    gap: '8px',
  },
  optionButton: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    background: '#FFFFFF',
    color: '#4A5568',
    textAlign: 'left',
    fontSize: '14px',
    lineHeight: '1.45',
    cursor: 'pointer',
  },
  optionButtonChosen: {
    borderColor: '#0D9488',
    background: '#EFF7F6',
    color: '#1A202C',
  },
  optionButtonCorrect: {
    borderColor: '#16A34A',
    background: '#F0FDF4',
    color: '#166534',
  },
  optionButtonWrong: {
    borderColor: '#DC2626',
    background: '#FEF2F2',
    color: '#991B1B',
  },
  explanation: {
    marginTop: '8px',
    color: '#718096',
    fontSize: '13px',
    lineHeight: '1.6',
  },
  testActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingTop: '16px',
    borderTop: '1px solid #EDF2F7',
  },
  testSubmitButton: {
    padding: '10px 16px',
    border: 'none',
    borderRadius: '8px',
    background: '#0D9488',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  testResetButton: {
    padding: '10px 16px',
    border: '1px solid #D7E8E5',
    borderRadius: '8px',
    background: '#FFFFFF',
    color: '#0D9488',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  scoreText: {
    color: '#1A202C',
    fontSize: '15px',
    fontWeight: '700',
  },
  tipsBox: {
    textAlign: 'center',
    padding: '60px 24px',
    color: '#A0AEC0',
    fontSize: '15px',
  },
};
