import fs from 'node:fs';

const kbPath = new URL('../data/knowledge_base.json', import.meta.url);
const kb = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
const categories = kb.categories || kb.bd || [];
const pricing = categories.find((category) => category.name === '课程收费');

if (!pricing) {
  throw new Error('未找到课程收费分类');
}

const newItems = [
  {
    id: 'HQ_PRICE_001',
    q: '小课价格是多少？',
    a: '小课（一对多）常见为一对3-6人，220~260元/次。原文案例中也出现“小课是3个人，小课费用260一次，90分钟”“小课260一次，110分钟”。具体价格、人数、课时长度和剩余课次，以教务最新确认为准。',
    keywords: ['小课', '小课价格', '小课多少钱', '一对多', '一对3-6人', '220', '260', '90分钟', '110分钟', '课程收费'],
    source: '03-课程收费一览-v002.md',
    source_section: '课程收费 / 小课价格',
    review_status: 'stable',
    quality_score: 10,
    source_id: 'manual_price_001',
  },
  {
    id: 'HQ_PRICE_002',
    q: '程老师班课价格是多少？',
    a: '程老师班课数学常见价格为220元/次。原文中有“程老师的课都是220一次哦 / 1小时50分钟 / 我们都是现学现测的 / 会留20分钟的时间给他们考试”“班课：程老师班课，220元/次，周日13:00~14:50”等口径。具体按当前班型、科目、剩余课次和教务最新确认为准。',
    keywords: ['程老师班课', '班课价格', '程老师课多少钱', '数学220', '220元/次', '1小时50分钟', '周日13:00~14:50', '课程收费'],
    source: '03-课程收费一览-v002.md',
    source_section: '课程收费 / 程老师班课价格',
    review_status: 'stable',
    quality_score: 10,
    source_id: 'manual_price_002',
  },
  {
    id: 'HQ_PRICE_003',
    q: '一对一和2-3人小班怎么收费？',
    a: '原文报价口径为：“如果是一对一的话，3-6年级是350一次（一个半小时），2-3人小班是260一次”。具体是否适用、课时安排和优惠，以试听后教务最新确认为准。',
    keywords: ['一对一', '1对1', '2-3人小班', '小班', '350一次', '260一次', '一个半小时', '课程收费'],
    source: '03-课程收费一览-v002.md',
    source_section: '课程收费 / 一对一与小班报价',
    review_status: 'stable',
    quality_score: 10,
    source_id: 'manual_price_003',
  },
  {
    id: 'HQ_PRICE_004',
    q: '数学班课和科学班课怎么收费？',
    a: '原文口径为：“我们这里是班课的形式，数学220一次，科学200一次”。不同班型、不同阶段、剩余课次可能不同，实际报价以教务最新确认为准。',
    keywords: ['数学班课', '科学班课', '数学220', '科学200', '班课收费', '课程收费'],
    source: '03-课程收费一览-v002.md',
    source_section: '课程收费 / 数学与科学班课',
    review_status: 'stable',
    quality_score: 10,
    source_id: 'manual_price_004',
  },
  {
    id: 'HQ_PRICE_005',
    q: '家长问学费多少应该怎么回答？',
    a: '先了解孩子年级、基础、目标和适合班型，再告知对应学费。费用以家长主动问询为主，不要主动推销时提及；试听免费，确认报名后再收费；优惠幅度由教务或程老师统一确认，新老师不擅自承诺折扣。',
    keywords: ['学费多少', '怎么收费', '报价话术', '费用口径', '试听免费', '优惠', '教务确认', '课程收费'],
    source: '03-课程收费一览-v002.md',
    source_section: '课程收费 / 报价注意事项',
    review_status: 'stable',
    quality_score: 10,
    source_id: 'manual_price_005',
  },
  {
    id: 'HQ_PRICE_006',
    q: '一对一怎么收费？',
    a: '一对一原文报价口径为：3-6年级350元/次，一个半小时。具体是否开一对一、适合哪个老师、课时怎么排，需要根据孩子基础和教务最新安排确认。',
    keywords: ['一对一怎么收费', '一对一多少钱', '1对1', '350元/次', '一个半小时', '3-6年级', '课程收费'],
    source: '03-课程收费一览-v002.md',
    source_section: '课程收费 / 一对一报价',
    review_status: 'stable',
    quality_score: 10,
    source_id: 'manual_price_006',
  },
  {
    id: 'HQ_PRICE_007',
    q: '数学班课多少钱？',
    a: '数学班课常见口径为220元/次。原文中有“我们这里是班课的形式，数学220一次，科学200一次”“数学班课：220元/次，每周一次”等记录。具体按班型、剩余课次、试听和教务最新确认为准。',
    keywords: ['数学班课多少钱', '数学班课价格', '数学220', '220元/次', '每周一次', '课程收费'],
    source: '03-课程收费一览-v002.md',
    source_section: '课程收费 / 数学班课报价',
    review_status: 'stable',
    quality_score: 10,
    source_id: 'manual_price_007',
  },
  {
    id: 'HQ_PRICE_008',
    q: '班课多少钱？',
    a: '班课原文口径为：数学220元/次，科学200元/次。程老师数学班课也按220元/次的口径出现过。具体报价要结合科目、班型、剩余课次、试听情况和教务最新安排确认。',
    keywords: ['班课多少钱', '班课价格', '科学班课多少钱', '科学200', '数学220', '程老师班课', '课程收费'],
    source: '03-课程收费一览-v002.md',
    source_section: '课程收费 / 班课报价',
    review_status: 'stable',
    quality_score: 10,
    source_id: 'manual_price_008',
  },
];

const existingIds = new Set(pricing.questions.map((item) => item.id));
pricing.questions = [
  ...newItems.filter((item) => !existingIds.has(item.id)),
  ...pricing.questions,
];

kb.total = categories.reduce((sum, category) => sum + (category.questions || []).length, 0);
kb.updated_at = '2026-06-15';
kb.version = 'v009 价格问答补强版';

fs.writeFileSync(kbPath, `${JSON.stringify(kb)}\n`);
