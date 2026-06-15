'use client';

import { useState } from 'react';

import knowledgeBase from '../data/knowledge_base.json';


// 学管课堂 - 课程与测试数据占位符
const jiaoguanCourses = {
  courses: [
    { id: 1, name: "课程名称待定", description: "课程简介待定" },
    // 20节课占位符
  ],
  tests: [
    { id: 1, question: "测试题题目待定", answer: "测试题答案待定" },
    // 20道测试题占位符
  ]
};

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '');
}

function searchKnowledge(query) {
  const queryLower = normalizeText(query);
  const results = [];

  for (const category of knowledgeBase.categories || []) {
    for (const item of category.questions || []) {
      const question = normalizeText(item.q);
      const answer = normalizeText(item.a);
      const keywords = normalizeText((item.keywords || []).join(' '));
      const source = normalizeText(`${item.source || ''} ${item.source_section || ''}`);
      let score = 0;

      if (question.includes(queryLower)) score += 10;
      if (keywords.includes(queryLower)) score += 6;
      if (answer.includes(queryLower)) score += 3;
      if (source.includes(queryLower)) score += 1;
      if (category.name === '小学课本目录' && score > 0) score += 8;

      if (score > 0) {
        results.push({
          id: item.id,
          question: item.q,
          answer: item.a,
          category: category.name,
          keywords: item.keywords || [],
          source: item.source,
          sourceSection: item.source_section,
          reviewStatus: item.review_status,
          score,
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 50);
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [focused, setFocused] = useState(false);

  const handleSearch = () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const searchResults = searchKnowledge(query);
    setResults(searchResults);
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
      setResults(searchResults);
    }, 50);
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
          {['学费多少钱', '圆柱与圆锥', '小学课本目录', '强基计划', '课后反馈'].map((item) => (
            <button key={item} onClick={() => quickSearch(item)} style={styles.quickButton}>{item}</button>
          ))}
        </div>
      </div>

      {/* 学管课堂入口 */}
      <div style={styles.jiaoguanSection}>
        <div style={styles.jiaoguanHeader}>
          <h2 style={styles.jiaoguanTitle}>学管课堂</h2>
          <p style={styles.jiaoguanSubtitle}>新人培养 · 考核验收</p>
        </div>
        <div style={styles.jiaoguanCards}>
          <div style={styles.jiaoguanCard} onClick={() => alert('课程列表即将上线')}>
            <div style={styles.jiaoguanIcon}>📚</div>
            <div style={styles.jiaoguanCardTitle}>学习内容</div>
            <div style={styles.jiaoguanCardDesc}>系统化学习路径</div>
          </div>
          <div style={styles.jiaoguanCard} onClick={() => alert('测试系统即将上线')}>
            <div style={styles.jiaoguanIcon}>📝</div>
            <div style={styles.jiaoguanCardTitle}>阶段测试</div>
            <div style={styles.jiaoguanCardDesc}>能力考核验收</div>
          </div>
        </div>
      </div>

      <div style={styles.results}>
        {results.length > 0 ? (
          <>
            <div style={styles.resultSummary}>找到 {results.length} 条最相关结果</div>
            {results.map((item) => (
          <div key={item.id} style={styles.resultItem}>
            <div style={styles.resultQuestion}>{item.question}</div>
            <div style={styles.resultAnswer}>{item.answer}</div>
            <div style={styles.metaRow}>
              <span style={styles.resultCategory}>{item.category}</span>
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
    maxWidth: '700px',
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
  jiaoguanCards: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
  },
  jiaoguanCard: {
    flex: 1,
    maxWidth: '280px',
    padding: '28px 24px',
    background: '#F5F7FA',
    borderRadius: '16px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  jiaoguanIcon: {
    fontSize: '36px',
    marginBottom: '12px',
  },
  jiaoguanCardTitle: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#1A202C',
    marginBottom: '6px',
  },
  jiaoguanCardDesc: {
    fontSize: '14px',
    color: '#718096',
  },
  tipsBox: {
    textAlign: 'center',
    padding: '60px 24px',
    color: '#A0AEC0',
    fontSize: '15px',
  },
};
