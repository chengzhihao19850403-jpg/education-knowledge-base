'use client';

import { useState, useEffect } from 'react';

const knowledgeBase = {
  "categories": [
    {
      "name": "课程咨询",
      "questions": [
        {"q": "学费多少钱", "a": "我们的课程费用根据科目和课时套餐不同，从XXXX元到XXXX元不等。具体可以告诉我是哪个科目，我帮你查一下对应的费用。"},
        {"q": "能先试听吗", "a": "当然可以！我们提供免费试听课，您可以带孩子来体验一下课堂氛围，看看是否适合。您最近哪天方便？"},
        {"q": "课程有什么", "a": "我们开设的课程包括：【科目1】、【科目2】、【科目3】等，针对不同年龄段的孩子有相应的课程体系。"}
      ]
    },
    {
      "name": "退费相关",
      "questions": [
        {"q": "能退费吗", "a": "可以退费的。正常情况下，报名后7天内如未上过课，可以全额退费；上过课的按已上课时扣除后退还剩余费用。具体流程需要到前台办理。"},
        {"q": "怎么退费", "a": "退费需要携带报名时的收据和合同，到校区前台填写退费申请表，我们会在3-5个工作日内处理完成。"}
      ]
    },
    {
      "name": "年龄段问题",
      "questions": [
        {"q": "孩子几岁能学", "a": "不同科目适合的年龄不同：\n- 【科目1】：5-8岁\n- 【科目2】：8-12岁\n- 【科目3】：12岁以上\n您孩子多大了？"}
      ]
    },
    {
      "name": "上课安排",
      "questions": [
        {"q": "上课时间怎么安排", "a": "我们有平日班和周末班，时间比较灵活。具体上课时间可以根据您和孩子的情况来协调，推荐您先来校区让课程顾问帮您规划。"},
        {"q": "一个班多少学生", "a": "为了保证教学质量，我们采用小班制教学，每班控制在8-12人左右，确保每个孩子都能得到关注和指导。"}
      ]
    }
  ],
  "general_knowledge": [
    {"q": "你们地址在哪", "a": "我们的校区地址是：【具体地址】，欢迎您来参观。联系电话：【电话】"},
    {"q": "怎么报名", "a": "报名很简单：1. 来校区填写报名表 2. 缴纳费用 3. 领取听课证。您可以直接过来，或者打电话预约时间，我们有课程顾问接待您。"},
    {"q": "有优惠吗", "a": "我们经常有优惠活动，比如老带新、团购、节假日特惠等。建议您关注我们的公众号，有优惠时会第一时间推送。"}
  ]
};

function searchKnowledge(query) {
  const queryLower = query.toLowerCase();
  const results = [];

  for (const category of knowledgeBase.categories || []) {
    for (const item of category.questions || []) {
      if (queryLower.includes(item.q.toLowerCase()) ||
          queryLower.includes(item.a.toLowerCase()) ||
          item.q.toLowerCase().includes(queryLower)) {
        results.push({ question: item.q, answer: item.a, category: category.name });
      }
    }
  }

  for (const item of knowledgeBase.general_knowledge || []) {
    if (queryLower.includes(item.q.toLowerCase()) ||
        queryLower.includes(item.a.toLowerCase()) ||
        item.q.toLowerCase().includes(queryLower)) {
      results.push({ question: item.q, answer: item.a, category: '通用问题' });
    }
  }

  return results;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

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
    <div style={styles.container}>
      <h1 style={styles.title}>教培知识库</h1>

      <div style={styles.searchBox}>
        <h2 style={styles.subtitle}>输入问题，快速查找答案</h2>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="例如：学费多少钱、能退费吗..."
          style={styles.input}
        />
        <button onClick={handleSearch} style={styles.button}>查询</button>

        <div style={styles.quickSection}>
          <div style={styles.quickTitle}>快捷问题：</div>
          <div style={styles.quickList}>
            {['学费多少钱', '能退费吗', '孩子几岁能学', '怎么报名', '有优惠吗', '上课时间'].map((q) => (
              <span key={q} style={styles.quickItem} onClick={() => quickSearch(q)}>{q}</span>
            ))}
          </div>
        </div>

        <div style={styles.results}>
          {results.length > 0 ? results.map((item, idx) => (
            <div key={idx} style={styles.resultItem}>
              <div style={styles.resultQuestion}>Q: {item.question}</div>
              <div style={styles.resultAnswer}>A: {item.answer}</div>
              <span style={styles.resultCategory}>{item.category}</span>
            </div>
          )) : query.trim() && (
            <div style={styles.noResults}>未找到相关答案，请尝试其他关键词</div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: '600px', margin: '0 auto', padding: '20px', minHeight: '100vh' },
  title: { color: 'white', textAlign: 'center', marginBottom: '30px', fontSize: '28px', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' },
  searchBox: { background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' },
  subtitle: { color: '#333', marginBottom: '15px', fontSize: '18px' },
  input: { width: '100%', padding: '15px', border: '2px solid #e0e0e0', borderRadius: '12px', fontSize: '16px', outline: 'none', boxSizing: 'border-box' },
  button: { width: '100%', marginTop: '15px', padding: '15px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' },
  quickSection: { marginTop: '20px' },
  quickTitle: { color: '#333', fontSize: '14px', marginBottom: '10px', fontWeight: '600' },
  quickList: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  quickItem: { background: '#e8eaf6', color: '#667eea', padding: '8px 15px', borderRadius: '20px', fontSize: '14px', cursor: 'pointer' },
  results: { marginTop: '20px' },
  resultItem: { background: '#f8f9fa', borderRadius: '12px', padding: '15px', marginBottom: '10px', borderLeft: '4px solid #667eea' },
  resultQuestion: { color: '#667eea', fontWeight: '600', marginBottom: '8px' },
  resultAnswer: { color: '#333', lineHeight: '1.6', whiteSpace: 'pre-line' },
  resultCategory: { display: 'inline-block', background: '#667eea', color: 'white', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', marginTop: '10px' },
  noResults: { textAlign: 'center', color: '#666', padding: '20px' },
};