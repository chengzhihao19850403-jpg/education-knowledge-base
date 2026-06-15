import fs from 'node:fs';

const kbPath = new URL('../data/knowledge_base.json', import.meta.url);
const trainingPath = new URL('../data/training_program.json', import.meta.url);
const sourcePath = new URL('../../../outputs/course-system/v001-four-season/一年四学期课程体系-结构化.json', import.meta.url);
const versionDir = new URL('../../../outputs/school-qa-bank/versions/v012/', import.meta.url);

const kb = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const TODAY = '2026-06-16';
const VERSION = 'v012 问答精修与学管课堂新版';

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function compact(value, max = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function q(id, question, answer, keywords = [], sourceSection = '一年四学期课程体系') {
  return {
    id,
    q: question,
    a: answer,
    keywords: unique(keywords),
    source: '一年四学期课程体系.xlsx',
    source_section: sourceSection,
    review_status: '最新动态资料',
    quality_score: 10,
  };
}

function displayCourseName(entry) {
  if (String(entry.class_name || '').startsWith(entry.season)) return entry.class_name;
  return `${entry.season}${entry.class_name}`;
}

function mergeCourseEntries(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const name = displayCourseName(entry);
    if (!groups.has(name)) {
      groups.set(name, {
        season: entry.season,
        sheet: entry.sheet,
        section: entry.section,
        grade: entry.grade,
        class_name: entry.class_name,
        display_name: name,
        variants: [],
        lessons: [],
      });
    }
    const group = groups.get(name);
    group.variants.push({
      section: entry.section,
      lesson_count: entry.lessons.length,
      first_lesson: entry.lessons[0]?.content || '',
    });
    for (const lesson of entry.lessons || []) {
      group.lessons.push({
        lesson_no: lesson.lesson_no,
        content: lesson.content,
        variant: entry.section,
      });
    }
  }

  for (const group of groups.values()) {
    const seen = new Set();
    group.lessons = group.lessons.filter((lesson) => {
      const key = `${lesson.lesson_no}::${lesson.content}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const byLessonNo = new Map();
    for (const lesson of group.lessons) {
      if (!byLessonNo.has(lesson.lesson_no)) byLessonNo.set(lesson.lesson_no, []);
      byLessonNo.get(lesson.lesson_no).push(lesson);
    }
    group.lesson_groups = Array.from(byLessonNo.entries()).map(([lesson_no, lessons]) => ({
      lesson_no,
      lessons,
      content: lessons
        .map((lesson) => `${group.variants.length > 1 ? `${lesson.variant}：` : ''}${lesson.content}`)
        .join('；'),
    }));
  }
  return Array.from(groups.values());
}

function lessonSummary(entry) {
  const parts = entry.lessons.map((lesson) => {
    const variantText = entry.variants.length > 1 ? `（${lesson.variant}）` : '';
    return `${lesson.lesson_no}${variantText}：${lesson.content}`;
  });
  return parts.join('；');
}

function outlineList(outline) {
  return (outline.topics || []).map((topic) => `${topic.topic}：${topic.knowledge}`).join('；');
}

function mergeOutlineTopics(topics) {
  const groups = new Map();
  for (const topic of topics || []) {
    if (!groups.has(topic.topic)) groups.set(topic.topic, []);
    groups.get(topic.topic).push(topic.knowledge);
  }
  return Array.from(groups.entries()).map(([topic, knowledgeItems]) => ({
    topic,
    knowledge: unique(knowledgeItems).join('；'),
  }));
}

function category(name) {
  return (kb.categories || []).find((item) => item.name === name);
}

function rebuildCourseQuestions() {
  const mergedEntries = mergeCourseEntries(source.course_system || []);
  const bySeason = new Map();
  for (const entry of mergedEntries) {
    if (!bySeason.has(entry.season)) bySeason.set(entry.season, []);
    bySeason.get(entry.season).push(entry.display_name);
  }

  const questions = [
    q('V012_CURRICULUM_CORE_001', '新学年从什么时候开始？', '新学年从暑假开始。以后判断年级、课程进度、四季课程安排和教学总纲时，暑假是新学年的起点，不按自然年1月开始，也不能只按秋季开学才开始计算。', ['新学年', '暑假开始', '学年起点', '教学进度', '课程体系'], '核心规则'),
    q('V012_CURRICULUM_CORE_002', '教学进度以哪个版本为准？', '教学进度是动态资料。当前以v012基于《一年四学期课程体系.xlsx》重建后的资料为准。v010及更早版本里的“当前进度”只作为历史参考，不能直接当作现在进度对外回答。涉及实际报班、插班、调课、当前上到第几次课，还要以教务最新确认为准。', ['教学进度', '最新版本', 'v012', '历史参考', '教务确认'], '核心规则'),
    q('V012_CURRICULUM_CORE_003', '一年四学期课程体系包括哪几个学期？', `一年四学期课程体系包括暑假、秋季、寒假、春季四个阶段。当前结构化资料包含${mergedEntries.length}个去重后的课程班级、${source.lesson_count || 897}条原始课次、${source.outline_count}个课程总纲、${source.outline_topic_count || 854}条总纲知识点。`, ['一年四学期', '暑假', '秋季', '寒假', '春季', '课程体系'], '核心规则'),
  ];

  for (const season of ['暑假', '秋季', '寒假', '春季']) {
    questions.push(q(
      `V012_CURRICULUM_SEASON_${season}`,
      `${season}有哪些课程班级？`,
      `${season}课程包括：${(bySeason.get(season) || []).join('、')}。${season === '暑假' ? '暑假是新学年的起点，查询新年级课程时优先看暑假课程。' : '查询具体课程时，请同时输入季节和班级名称。'}`,
      [season, `${season}课程`, '课程班级', '课程体系'],
      `${season}课程体系`,
    ));
  }

  mergedEntries.forEach((entry, index) => {
    const id = String(index + 1).padStart(4, '0');
    const variantNote = entry.variants.length > 1
      ? `该班级在原表中有${entry.variants.length}组同名安排，已合并展示；实际使用时要结合教务确认采用哪一组。`
      : '';
    questions.push(q(
      `V012_CURRICULUM_CLASS_${id}`,
      `${entry.display_name}学什么？`,
      `${entry.display_name}共整理${entry.lessons.length}条课次安排。${variantNote}完整课次：${lessonSummary(entry)}。`,
      [entry.season, entry.display_name, entry.class_name, entry.grade, '学什么', '课次安排', '教学进度'],
      `${entry.sheet} / ${entry.display_name}`,
    ));
    (entry.lesson_groups || []).forEach((lesson, lessonIndex) => {
      questions.push(q(
        `V012_CURRICULUM_LESSON_${id}_${String(lessonIndex + 1).padStart(2, '0')}`,
        `${entry.display_name}${lesson.lesson_no}学什么？`,
        `${entry.display_name}${lesson.lesson_no}的课时内容是：${lesson.content}。${entry.variants.length > 1 ? '该班级在原表中有同名多组安排，实际采用哪一组需教务确认。' : ''}`,
        [entry.season, entry.display_name, lesson.lesson_no, lesson.content, '教学进度'],
        `${entry.sheet} / ${entry.display_name}`,
      ));
    });
  });

  const outlineNameCounts = new Map();
  for (const outline of source.outlines || []) {
    outlineNameCounts.set(outline.class_name, (outlineNameCounts.get(outline.class_name) || 0) + 1);
  }

  (source.outlines || []).forEach((outline, index) => {
    const id = String(index + 1).padStart(4, '0');
    const displayName = outlineNameCounts.get(outline.class_name) > 1 ? `${outline.sheet} · ${outline.class_name}` : outline.class_name;
    const mergedTopics = mergeOutlineTopics(outline.topics || []);
    questions.push(q(
      `V012_OUTLINE_CLASS_${id}`,
      `${displayName}是什么？`,
      `${displayName}的课程总纲是：${outline.objectives}。课程主要内容共${mergedTopics.length}项：${outlineList({ topics: mergedTopics })}。`,
      [outline.sheet, outline.class_name, displayName, '课程总纲', '教学总纲', '知识体系'],
      `${outline.sheet} / ${outline.class_name}`,
    ));
    mergedTopics.forEach((topic, topicIndex) => {
      questions.push(q(
        `V012_OUTLINE_TOPIC_${id}_${String(topicIndex + 1).padStart(2, '0')}`,
        `${displayName}的${topic.topic}涵盖什么？`,
        `${displayName}中“${topic.topic}”涵盖的知识体系是：${topic.knowledge}。`,
        [outline.sheet, outline.class_name, displayName, topic.topic, topic.knowledge, '课程总纲'],
        `${outline.sheet} / ${outline.class_name}`,
      ));
    });
  });

  return questions;
}

function rebuildKnowledgeBase(courseQuestions) {
  kb.categories = (kb.categories || []).filter((item) => item.name !== '一年四学期课程体系');

  let priority = category('重点业务问答');
  if (!priority) {
    priority = { name: '重点业务问答', questions: [] };
    kb.categories.unshift(priority);
  }
  priority.questions = (priority.questions || []).filter((item) => !String(item.id || '').startsWith('V011_CURRICULUM_') && !String(item.id || '').startsWith('V012_CURRICULUM_'));
  priority.questions = [
    ...courseQuestions.filter((item) => item.id.startsWith('V012_CURRICULUM_CORE_') || item.id.startsWith('V012_CURRICULUM_SEASON_')),
    ...priority.questions,
  ];

  for (const cat of kb.categories || []) {
    for (const item of cat.questions || []) {
      if (['V010_CLASS_001', 'V010_CLASS_002', 'V010_CLASS_003'].includes(item.id)) {
        item.review_status = '历史参考';
        item.quality_score = 1;
        item.a = String(item.a || '')
          .replace('历史参考：这条是v010旧版概览，教学进度已经由v011《一年四学期课程体系.xlsx》替代。', '')
          .replace('历史参考：这条是旧版概览，教学进度已经由v012《一年四学期课程体系.xlsx》替代。', '');
        item.a = `历史参考：这条是旧版概览，教学进度已经由v012《一年四学期课程体系.xlsx》替代。${item.a}`;
        item.keywords = unique([...(item.keywords || []), '历史参考', '旧版进度', '以v012为准']);
      }
    }
  }

  const insertIndex = Math.max(1, kb.categories.findIndex((item) => item.name === '重点业务问答') + 1);
  kb.categories.splice(insertIndex, 0, { name: '一年四学期课程体系', questions: courseQuestions });
  kb.version = VERSION;
  kb.updated_at = TODAY;
  kb.total = kb.categories.reduce((sum, item) => sum + (item.questions || []).length, 0);
}

const lessonBlueprints = [
  ['L01', '新版知识库规则与动态资料边界', '基础认知', ['理解v012版本变化', '知道教学进度以四季课程表为准', '能区分最新资料和历史参考'], ['重点业务问答', '一年四学期课程体系', '系统总览']],
  ['L02', '一年四学期课程体系总览', '课程体系', ['掌握暑假、秋季、寒假、春季四阶段', '知道新学年从暑假开始', '能按季节查询课程'], ['一年四学期课程体系']],
  ['L03', '暑假课程体系与新学年起点', '课程体系', ['掌握暑假作为新学年起点', '能查询暑假各班课次', '能解释同名班级需教务确认'], ['一年四学期课程体系']],
  ['L04', '秋季课程体系承接', '课程体系', ['掌握秋季课程承接暑假', '能定位秋季班级', '能说明全年链路'], ['一年四学期课程体系']],
  ['L05', '寒假课程体系与集中突破', '课程体系', ['掌握寒假短周期课程特点', '能查询寒假课次', '能识别阶段性复习和强基内容'], ['一年四学期课程体系']],
  ['L06', '春季课程体系与年度收束', '课程体系', ['掌握春季课程定位', '能查询春季课次', '能说明春季与升学节点关系'], ['一年四学期课程体系', '升学政策']],
  ['L07', '小学低段课程规划', '课程体系', ['能解释一二三年级四季课程', '能识别奥数启蒙和校内拓展', '能给家长合理预期'], ['一年四学期课程体系', '小学课本目录']],
  ['L08', '小学中高段课程规划', '课程体系', ['能解释四五六年级课程链路', '理解小升初与初中衔接', '能判断补弱和拔高路径'], ['一年四学期课程体系', '小学课本目录', '初中课本目录']],
  ['L09', '新初一衔接与暑假关键期', '课程体系', ['掌握新初一暑假课程重点', '理解有理数、整式、方程、几何衔接', '能解释为什么暑假重要'], ['一年四学期课程体系', '初中课本目录']],
  ['L10', '初二强基与压轴题能力', '课程体系', ['掌握初二代数几何强基线', '理解函数、四边形、二次根式等重点', '能说明强基训练价值'], ['一年四学期课程体系', '初中课本目录']],
  ['L11', '初三中考强基与初高衔接', '课程体系', ['掌握初三压轴题与总复习', '理解强基和初高衔接', '能解释免费送课和高中衔接价值'], ['一年四学期课程体系', '升学政策']],
  ['L12', '课程总纲阅读与知识体系拆解', '课程体系', ['会读课程总纲', '能把课程主要内容转成家长话术', '能定位知识体系覆盖范围'], ['一年四学期课程体系']],
  ['L13', '咨询接待与信息采集', '咨询能力', ['掌握小学和初中咨询必问信息', '能先诊断再推荐', '能记录家长需求'], ['咨询接待', '重点业务问答']],
  ['L14', '试听测评与分班判断', '咨询能力', ['掌握试听前准备', '能根据基础推荐班型', '能处理跟不上问题'], ['咨询接待', '班级体系', '一年四学期课程体系']],
  ['L15', '收费报价与优惠边界', '业务边界', ['掌握小课和班课价格口径', '知道报价红线', '能处理优惠问题'], ['课程收费', '重点业务问答']],
  ['L16', '课后反馈与学情表达', '服务能力', ['能写具体课后反馈', '区分优秀中等偏弱学生表达', '能给居家建议'], ['课后反馈']],
  ['L17', '续报、转介绍与家长粘度', '运营能力', ['理解家长续报心理', '会分层维护家长', '能规范转介绍'], ['转介绍运营', '课后反馈']],
  ['L18', '宁波升学政策与强基路径', '升学规划', ['掌握重高路径', '理解强基和定向', '避免政策承诺'], ['升学政策', '学校数据']],
  ['L19', '搜索复审与相似问题判断', '工具能力', ['会使用问答库检索', '知道相似问题不能直接照搬', '能识别动态信息'], ['重点业务问答', '一年四学期课程体系', '系统总览']],
  ['L20', '综合实战：从咨询到跟进闭环', '综合演练', ['能完成完整接待流程', '能把课程体系用于推荐', '能记录并升级敏感问题'], ['咨询接待', '一年四学期课程体系', '课程收费', '课后反馈', '升学政策']],
];

function findQuestions(sources, limit = 12) {
  const categories = new Map((kb.categories || []).map((item) => [item.name, item.questions || []]));
  const result = [];
  for (const sourceName of sources) {
    for (const item of categories.get(sourceName) || []) {
      if (!item.q || !item.a) continue;
      if (String(item.a).length < 8) continue;
      result.push({
        question: item.q,
        answer: item.a,
        source: item.source || sourceName,
        sourceSection: item.source_section || '',
      });
      if (result.length >= limit) return result;
    }
  }
  return result;
}

function buildLessons() {
  return lessonBlueprints.map(([id, title, categoryName, objectives, sources], index) => {
    const referenceQa = findQuestions(sources, 14);
    const content = [
      `本节围绕“${title}”训练新人把知识库内容转化为实际工作动作。`,
      index <= 11
        ? '课程体系相关内容必须按v012处理：新学年从暑假开始，四季课程表是当前教学进度的最新来源，旧版进度只作历史参考。'
        : '家长沟通中要先收集事实，再判断适配，最后给统一口径；涉及动态信息、价格、政策和特殊安排必须二次确认。',
      '新人必须能说清楚：哪些是可以直接回答的事实，哪些需要结合孩子情况判断，哪些必须升级给教务或负责人确认。',
    ];
    return {
      id,
      title,
      category: categoryName,
      duration: '60分钟',
      objectives,
      content,
      keyPoints: unique([
        objectives[0],
        index <= 11 ? '新学年从暑假开始' : '先诊断再推荐',
        index <= 11 ? '动态进度以v012为准' : '敏感信息二次确认',
      ]),
      practice: index <= 11
        ? `请用知识库搜索一个具体班级，例如“暑假新三年级课程第1次课学什么”，并整理成可以发给家长的一句话。`
        : `请围绕“${title}”做一次家长沟通角色扮演，并标出需要教务确认的内容。`,
      sources,
      expandedSections: [
        {
          title: '学习重点',
          items: [
            ...objectives,
            index <= 11 ? '所有课程进度必须引用“一年四学期课程体系”模块。' : '所有对外话术必须保留边界，不做过度承诺。',
          ],
        },
        {
          title: '标准操作流程',
          items: index <= 11
            ? ['先确认家长问的是哪个季节、哪个班级、哪一次课。', '再搜索课程体系模块中的对应问答。', '如果同名班级或实际在读进度不确定，明确说明需要教务确认。']
            : ['先问年级、学校、基础、目标和家长关注点。', '再结合知识库给出统一口径。', '最后记录待确认事项和下一步跟进时间。'],
        },
        {
          title: '标准表达话术',
          items: index <= 11
            ? ['我们新学年是从暑假开始看的，所以这个年级的课程要先看暑假安排。', '我先按当前课程体系表给您说明，实际插班和当前进度还要以教务确认为准。']
            : ['我先了解孩子情况，再判断更适合哪个课程路径。', '这个涉及最新安排，我帮您和教务确认后再准确回复。'],
        },
        {
          title: '常见错误',
          items: index <= 11
            ? ['沿用v010旧进度。', '把秋季当作新学年起点。', '看到同名班级不确认就直接回答。']
            : ['没有诊断就直接推荐。', '把相似答案当成完全匹配。', '对价格、政策、名额或结果做现场承诺。'],
        },
      ],
      referenceQa,
      trainerNotes: [
        '本节必须让新人现场搜索一次知识库，而不是只听讲。',
        '遇到动态资料，必须训练新人说出“以最新表格和教务确认为准”。',
        '讲师要检查新人是否能把知识库答案改写成家长能听懂的话。',
      ],
    };
  });
}

function makeQuestion(id, question, correct, wrong, explanation, shift = 0) {
  const options = unique([correct, ...wrong]).slice(0, 4);
  while (options.length < 4) options.push(['现场承诺结果', '忽略孩子基础', '沿用旧版进度', '不记录待确认事项'][options.length]);
  const answer = options[0];
  const rotated = options.slice(shift % 4).concat(options.slice(0, shift % 4));
  return {
    id,
    question: compact(question, 150),
    options: rotated.map((item) => compact(item, 120)),
    answerIndex: rotated.indexOf(answer),
    explanation: compact(explanation, 160),
  };
}

function buildTests(lessons) {
  return lessons.map((lesson, lessonIndex) => {
    const pool = [
      ...(lesson.objectives || []),
      ...(lesson.keyPoints || []),
      ...(lesson.expandedSections || []).flatMap((section) => section.items || []),
      ...(lesson.referenceQa || []).map((item) => `${item.question}：${item.answer}`),
      ...(lesson.trainerNotes || []),
    ].filter(Boolean);
    const questions = [];
    const wrong = ['现场承诺提分或录取', '不确认最新口径直接答复', '只按家长期望推荐最高班', '把历史参考当最新进度'];
    for (let i = 0; i < 50; i += 1) {
      const correct = pool[i % pool.length] || '先确认事实，再按统一口径处理';
      questions.push(makeQuestion(
        `${lesson.id}-TQ${String(i + 1).padStart(2, '0')}`,
        `关于“${lesson.title}”，哪一项是正确做法？`,
        correct,
        wrong,
        `该题用于检查新人是否掌握“${lesson.title}”的关键动作和边界。`,
        i,
      ));
    }
    return {
      id: `T${String(lessonIndex + 1).padStart(2, '0')}`,
      lessonId: lesson.id,
      title: `${lesson.title}阶段测试`,
      questionCount: 50,
      questions,
    };
  });
}

const courseQuestions = rebuildCourseQuestions();
rebuildKnowledgeBase(courseQuestions);

const lessons = buildLessons();
const training = {
  version: 'training-v004-four-season-curriculum',
  updated_at: TODAY,
  title: '匠人程新人培训课程包',
  description: '基于v012问答库重建，正式纳入一年四学期课程体系、新学年从暑假开始、动态教学进度使用规则、咨询服务与阶段测试。',
  lessons,
  tests: buildTests(lessons),
};

fs.writeFileSync(kbPath, `${JSON.stringify(kb, null, 2)}\n`);
fs.writeFileSync(trainingPath, `${JSON.stringify(training, null, 2)}\n`);
fs.mkdirSync(versionDir, { recursive: true });
fs.writeFileSync(new URL('匠人程学校知识库问答库-v012.json', versionDir), `${JSON.stringify(kb, null, 2)}\n`);
fs.writeFileSync(new URL('../../../outputs/school-qa-bank/LATEST_HIGH_QUALITY_VERSION.txt', import.meta.url), `${VERSION}\n`);

console.log(JSON.stringify({
  kb_version: kb.version,
  kb_total: kb.total,
  course_questions: courseQuestions.length,
  lessons: training.lessons.length,
  tests: training.tests.length,
  questions_per_test: training.tests[0]?.questions.length,
}, null, 2));
