import Head from 'next/head';

export default function Home() {
  const handleSearch = async () => {
    const query = document.getElementById('query').value.trim();
    const resultsDiv = document.getElementById('results');

    if (!query) {
      resultsDiv.innerHTML = '<div class="no-results">请输入问题</div>';
      return;
    }

    resultsDiv.innerHTML = '<div class="no-results">正在搜索...</div>';

    try {
      const response = await fetch('/api/search?q=' + encodeURIComponent(query));
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        let html = '';
        for (const item of data.results) {
          html += `
            <div class="result-item">
              <div class="question">Q: ${item.question}</div>
              <div class="answer">A: ${item.answer}</div>
              <span class="category">${item.category}</span>
            </div>
          `;
        }
        resultsDiv.innerHTML = html;
      } else {
        resultsDiv.innerHTML = '<div class="no-results">未找到相关答案，请尝试其他关键词</div>';
      }
    } catch (error) {
      resultsDiv.innerHTML = '<div class="no-results">搜索出错，请稍后重试</div>';
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const quickSearch = (query) => {
    document.getElementById('query').value = query;
    handleSearch();
  };

  return (
    <div>
      <Head>
        <title>教培知识库 - 快速检索</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
        }
        .container { max-width: 600px; margin: 0 auto; }
        h1 {
          color: white;
          text-align: center;
          margin-bottom: 30px;
          font-size: 28px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        .search-box {
          background: white;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        .search-box h2 { color: #333; margin-bottom: 15px; font-size: 18px; }
        input[type="text"] {
          width: 100%;
          padding: 15px;
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          font-size: 16px;
          outline: none;
          transition: border-color 0.3s;
        }
        input[type="text"]:focus { border-color: #667eea; }
        button {
          width: 100%;
          margin-top: 15px;
          padding: 15px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }
        button:hover { transform: scale(1.02); }
        button:active { transform: scale(0.98); }
        .results { margin-top: 20px; }
        .result-item {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 15px;
          margin-bottom: 10px;
          border-left: 4px solid #667eea;
        }
        .result-item .question { color: #667eea; font-weight: 600; margin-bottom: 8px; }
        .result-item .answer { color: #333; line-height: 1.6; white-space: pre-line; }
        .result-item .category {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 12px;
          margin-top: 10px;
        }
        .no-results { text-align: center; color: #666; padding: 20px; }
        .category-list { margin-top: 20px; }
        .category-title { color: #333; font-size: 14px; margin-bottom: 10px; font-weight: 600; }
        .hot-questions { display: flex; flex-wrap: wrap; gap: 8px; }
        .hot-question {
          background: #e8eaf6;
          color: #667eea;
          padding: 8px 15px;
          border-radius: 20px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .hot-question:hover { background: #667eea; color: white; }
      `}</style>

      <div className="container">
        <h1>教培知识库</h1>
        <div className="search-box">
          <h2>输入问题，快速查找答案</h2>
          <input type="text" id="query" placeholder="例如：学费多少钱、能退费吗..." onKeyPress={handleKeyPress} />
          <button onClick={handleSearch}>查询</button>

          <div className="category-list">
            <div className="category-title">快捷问题：</div>
            <div className="hot-questions">
              <span className="hot-question" onClick={() => quickSearch('学费多少钱')}>学费多少钱</span>
              <span className="hot-question" onClick={() => quickSearch('能退费吗')}>能退费吗</span>
              <span className="hot-question" onClick={() => quickSearch('孩子几岁能学')}>孩子几岁能学</span>
              <span className="hot-question" onClick={() => quickSearch('怎么报名')}>怎么报名</span>
              <span className="hot-question" onClick={() => quickSearch('有优惠吗')}>有优惠吗</span>
              <span className="hot-question" onClick={() => quickSearch('上课时间')}>上课时间</span>
            </div>
          </div>

          <div className="results" id="results"></div>
        </div>
      </div>
    </div>
  );
}