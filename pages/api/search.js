import path from 'path';
import { promises as fs } from 'fs';

export default async function handler(req, res) {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: '缺少搜索关键词' });
  }

  const kbPath = path.join(process.cwd(), 'data', 'knowledge_base.json');
  const kb = JSON.parse(await fs.readFile(kbPath, 'utf-8'));

  const queryLower = q.toLowerCase();
  const results = [];

  for (const category of kb.categories || []) {
    for (const item of category.questions || []) {
      if (queryLower.includes(item.q.toLowerCase()) ||
          queryLower.includes(item.a.toLowerCase()) ||
          item.q.toLowerCase().includes(queryLower)) {
        results.push({
          question: item.q,
          answer: item.a,
          category: category.name
        });
      }
    }
  }

  for (const item of kb.general_knowledge || []) {
    if (queryLower.includes(item.q.toLowerCase()) ||
        queryLower.includes(item.a.toLowerCase()) ||
        item.q.toLowerCase().includes(queryLower)) {
      results.push({
        question: item.q,
        answer: item.a,
        category: '通用问题'
      });
    }
  }

  res.status(200).json({ results });
}