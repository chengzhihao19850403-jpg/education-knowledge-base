import fs from 'node:fs';

const kbPath = new URL('../data/knowledge_base.json', import.meta.url);
const sourcePath = new URL('../../../outputs/course-system/v001-four-season/一年四学期课程体系-结构化.json', import.meta.url);
const versionDir = new URL('../../../outputs/school-qa-bank/versions/v011/', import.meta.url);

const kb = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

function q(id, question, answer, keywords = [], sourceSection = '一年四学期课程体系') {
  return {
    id,
    q: question,
    a: answer,
    keywords,
    source: '一年四学期课程体系.xlsx',
    source_section: sourceSection,
    review_status: '最新动态资料',
    quality_score: 10,
  };
}

function lessonList(entry) {
  return entry.lessons.map((lesson) => `${lesson.lesson_no}：${lesson.content}`).join('；');
}

function outlineList(outline) {
  return outline.topics.map((topic) => `${topic.topic}：${topic.knowledge}`).join('；');
}

function displayCourseName(entry) {
  if (String(entry.class_name || '').startsWith(entry.season)) return entry.class_name;
  return `${entry.season}${entry.class_name}`;
}

const seasonNames = ['暑假', '秋季', '寒假', '春季'];
const classesBySeason = new Map();
for (const season of seasonNames) classesBySeason.set(season, []);
for (const entry of source.course_system || []) {
  if (!classesBySeason.has(entry.season)) classesBySeason.set(entry.season, []);
  classesBySeason.get(entry.season).push(entry.class_name);
}

const priority = [
  q(
    'V011_CURRICULUM_CORE_001',
    '新学年从什么时候开始？',
    '新学年从暑假开始。以后判断年级、课程进度、四季课程安排和教学总纲时，暑假是新学年的起点，不按自然年1月开始，也不能只按秋季开学才开始计算。',
    ['新学年', '暑假开始', '学年起点', '教学进度', '课程体系'],
    '核心规则',
  ),
  q(
    'V011_CURRICULUM_CORE_002',
    '一年四学期课程体系包括哪几个学期？',
    '一年四学期课程体系包括暑假、秋季、寒假、春季四个阶段。当前导入资料共包含62个课程班级、897条课次、46个课程总纲、854条总纲知识点。查询具体班级时，要按季节加班级名称定位，例如“暑假新三年级课程”“秋季初二1班课程”“寒假四1班课程”“春季初三课程”。',
    ['一年四学期', '暑假', '秋季', '寒假', '春季', '课程体系'],
    '核心规则',
  ),
  q(
    'V011_CURRICULUM_CORE_003',
    '教学进度以哪个版本为准？',
    '教学进度是动态资料。网站和知识库中关于四季课程、课次安排、课程总纲的问题，应以v011导入的《一年四学期课程体系.xlsx》为最新来源。v010及更早版本里的“当前进度”只作为历史参考，不能直接当作现在进度对外回答。涉及报名、插班、调课和当前实际上到第几次课时，还要再向教务确认。',
    ['教学进度', '教学进度以哪个版本为准', '最新版本', 'v011', '历史参考', '教务确认'],
    '核心规则',
  ),
  q(
    'V011_CURRICULUM_CORE_004',
    '暑假有哪些课程班级？',
    `暑假课程包括：${(classesBySeason.get('暑假') || []).join('、')}。暑假是新学年起点，查询新年级课程时优先看暑假课程。`,
    ['暑假课程', '新学年', '新三年级', '新初三', '课程班级'],
    '暑假课程体系',
  ),
  q(
    'V011_CURRICULUM_CORE_005',
    '秋季有哪些课程班级？',
    `秋季课程包括：${(classesBySeason.get('秋季') || []).join('、')}。秋季课程要接在暑假新学年课程之后理解。`,
    ['秋季课程', '课程班级', '一年级', '初三'],
    '秋季课程体系',
  ),
  q(
    'V011_CURRICULUM_CORE_006',
    '寒假有哪些课程班级？',
    `寒假课程包括：${(classesBySeason.get('寒假') || []).join('、')}。寒假课程是四季课程体系中的阶段性集中课程。`,
    ['寒假课程', '课程班级'],
    '寒假课程体系',
  ),
  q(
    'V011_CURRICULUM_CORE_007',
    '春季有哪些课程班级？',
    `春季课程包括：${(classesBySeason.get('春季') || []).join('、')}。春季课程要结合暑假、秋季、寒假的全年链路理解。`,
    ['春季课程', '课程班级'],
    '春季课程体系',
  ),
];

const courseQuestions = [...priority];

for (const [index, entry] of (source.course_system || []).entries()) {
  const safeId = String(index + 1).padStart(4, '0');
  const fullName = displayCourseName(entry);
  const overview = `${fullName}共${entry.lessons.length}次课。完整课次安排：${lessonList(entry)}。`;
  courseQuestions.push(
    q(
      `V011_CURRICULUM_CLASS_${safeId}`,
      `${fullName}学什么？`,
      overview,
      [entry.season, entry.class_name, entry.grade, '课程体系', '课次安排', '教学进度'],
      `${entry.sheet} / ${entry.class_name}`,
    ),
  );
  for (const [lessonIndex, lesson] of entry.lessons.entries()) {
    courseQuestions.push(
      q(
        `V011_CURRICULUM_LESSON_${safeId}_${String(lessonIndex + 1).padStart(2, '0')}`,
        `${fullName}${lesson.lesson_no}学什么？`,
        `${fullName}${lesson.lesson_no}的课时内容是：${lesson.content}。`,
        [entry.season, entry.class_name, lesson.lesson_no, lesson.content, '教学进度'],
        `${entry.sheet} / ${entry.class_name}`,
      ),
    );
  }
}

for (const [index, outline] of (source.outlines || []).entries()) {
  const safeId = String(index + 1).padStart(4, '0');
  courseQuestions.push(
    q(
      `V011_OUTLINE_CLASS_${safeId}`,
      `${outline.class_name}是什么？`,
      `${outline.class_name}的课程总纲是：${outline.objectives}。课程主要内容共${outline.topics.length}项：${outlineList(outline)}。`,
      [outline.sheet, outline.class_name, '课程总纲', '教学总纲', '知识体系'],
      `${outline.sheet} / ${outline.class_name}`,
    ),
  );
  for (const [topicIndex, topic] of outline.topics.entries()) {
    courseQuestions.push(
      q(
        `V011_OUTLINE_TOPIC_${safeId}_${String(topicIndex + 1).padStart(2, '0')}`,
        `${outline.class_name}的${topic.topic}涵盖什么？`,
        `${outline.class_name}中“${topic.topic}”涵盖的知识体系是：${topic.knowledge}。`,
        [outline.sheet, outline.class_name, topic.topic, topic.knowledge, '课程总纲'],
        `${outline.sheet} / ${outline.class_name}`,
      ),
    );
  }
}

kb.categories = (kb.categories || []).filter((category) => category.name !== '一年四学期课程体系');

let priorityCategory = kb.categories.find((category) => category.name === '重点业务问答');
if (!priorityCategory) {
  priorityCategory = { name: '重点业务问答', questions: [] };
  kb.categories.unshift(priorityCategory);
}

const oldDynamicIds = new Set(['V010_CLASS_001', 'V010_CLASS_002', 'V010_CLASS_003']);
for (const category of kb.categories) {
  for (const item of category.questions || []) {
    if (oldDynamicIds.has(item.id)) {
      item.review_status = '历史参考';
      item.quality_score = 2;
      if (!String(item.a || '').startsWith('历史参考：')) {
        item.a = `历史参考：这条是v010旧版概览，教学进度已经由v011《一年四学期课程体系.xlsx》替代。${item.a}`;
      }
      item.keywords = Array.from(new Set([...(item.keywords || []), '历史参考', '旧版进度', '以v011为准']));
    }
  }
}

priorityCategory.questions = [
  ...priority,
  ...(priorityCategory.questions || []).filter((item) => !item.id?.startsWith('V011_CURRICULUM_') && !oldDynamicIds.has(item.id)),
];

const insertIndex = Math.max(1, kb.categories.findIndex((category) => category.name === '重点业务问答') + 1);
kb.categories.splice(insertIndex, 0, {
  name: '一年四学期课程体系',
  questions: courseQuestions,
});

kb.version = 'v011 四季课程体系更新版';
kb.updated_at = '2026-06-16';
kb.total = kb.categories.reduce((sum, category) => sum + (category.questions || []).length, 0);

fs.writeFileSync(kbPath, `${JSON.stringify(kb, null, 2)}\n`);
fs.mkdirSync(versionDir, { recursive: true });
fs.writeFileSync(new URL('匠人程学校知识库问答库-四季课程体系-v011.json', versionDir), `${JSON.stringify(kb, null, 2)}\n`);
fs.writeFileSync(new URL('../../../outputs/school-qa-bank/LATEST_HIGH_QUALITY_VERSION.txt', import.meta.url), 'v011 四季课程体系更新版\n');

console.log(JSON.stringify({
  version: kb.version,
  total: kb.total,
  imported_questions: courseQuestions.length,
  course_system_count: source.course_system_count,
  outline_count: source.outline_count,
}, null, 2));
