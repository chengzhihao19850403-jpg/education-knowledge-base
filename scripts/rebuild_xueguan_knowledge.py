from __future__ import annotations

import argparse
import json
import re
from datetime import date
from pathlib import Path

from docx import Document


QUESTION_START_PARAGRAPHS = [
    1,
    7,
    11,
    16,
    21,
    28,
    32,
    37,
    39,
    41,
    56,
    57,
    65,
    72,
    79,
    89,
    95,
    100,
    108,
    112,
    115,
    117,
    120,
    124,
    131,
    133,
    136,
    140,
    142,
    144,
    146,
    148,
    150,
    152,
    154,
    156,
    158,
    160,
    162,
    167,
    169,
    174,
    177,
    180,
    185,
    193,
    199,
    204,
    211,
]

CATEGORY_RULES = [
    (1, 6, "机构定位与课程价值"),
    (7, 12, "教学体系与班级服务"),
    (13, 24, "家长沟通与课程执行"),
    (25, 28, "宁波初中大讲堂"),
    (29, 33, "宁外贯通班"),
    (34, 38, "蛟川联培班"),
    (39, 43, "校区规则与中考定向"),
    (44, 49, "学习方法与课后衔接"),
]

LESSON_GROUPS = [
    ("L01", "品牌差异与机构定位", [1]),
    ("L02", "课堂容量与超前节奏", [2, 3]),
    ("L03", "奥数价值与初中加深", [4, 5]),
    ("L04", "小班师资、奥数波动与插班", [6, 7, 8]),
    ("L05", "程老师背景与小学班型", [9, 10]),
    ("L06", "课堂反馈标准与授课方法", [11, 12]),
    ("L07", "强基、距离与费用异议", [13, 14, 15]),
    ("L08", "奥数难度、资料发放与课程比例", [16, 17, 18]),
    ("L09", "提前学扎实度、大纲、出门测与回校听课", [19, 20, 21, 22]),
    ("L10", "高中内容提前学与红榜沟通", [23, 24]),
    ("L11", "宁波初中大讲堂", [25, 26, 27, 28]),
    ("L12", "宁外贯通班报名与政策", [29, 30, 31]),
    ("L13", "宁外贯通课程、优势与边界", [32, 33]),
    ("L14", "蛟川联培班定位、学籍与上课安排", [34, 35, 36]),
    ("L15", "蛟川联培报考、淘汰与项目比较", [37, 38]),
    ("L16", "校区上楼旁听与安全规则", [39]),
    ("L17", "宁波中考定向分配", [40, 41, 42, 43]),
    ("L18", "学习方法争议与板块学习判断", [44, 45]),
    ("L19", "请假补课与课后辅导", [46, 47]),
    ("L20", "奥数长期价值与小课衔接", [48, 49]),
]

STOP_MARKERS = {"解答"}
SECTION_HEADERS = {"27.大讲堂的班型划分与授课内容", "28.大讲堂升学价值与同类项目区分"}


def clean_question(raw: str, paragraph_number: int) -> tuple[str, str]:
    text = raw.strip()
    text = re.sub(r"^(家长问|问题|问)[:：]\s*", "", text)
    text = re.sub(r"^\d+\s*[\.、]\s*", "", text)

    if paragraph_number == 115:
        split_phrase = "收发出门测纸质版是需要时间的"
        if split_phrase in text:
            question, answer_head = text.split(split_phrase, 1)
            answer_head = f"{split_phrase}{answer_head}"
            return question.strip(), answer_head.strip()

    if "\n" not in text:
        return text.strip(), ""

    question, answer_head = text.split("\n", 1)
    question = question.strip()
    answer_head = answer_head.strip()
    answer_head = re.sub(r"^答[:：]\s*", "", answer_head)
    return question, answer_head


def normalize_for_compare(value: str) -> str:
    return re.sub(r"[\s、,，.。:：;；!?？！()（）【】\[\]《》\"'“”‘’\-—_/\\]", "", value)


def clean_answer_part(raw: str, question: str) -> str:
    text = raw.strip()
    if not text or text in STOP_MARKERS or text in SECTION_HEADERS:
        return ""
    text = re.sub(r"^(答|回复家长)[:：]\s*", "", text)
    if normalize_for_compare(text) == normalize_for_compare(question):
        return ""
    return text


def get_category(index: int) -> str:
    for start, end, name in CATEGORY_RULES:
        if start <= index <= end:
            return name
    return "学管标准问答"


def split_sentences(value: str) -> list[str]:
    parts = re.split(r"(?<=[。！？?!])\s*", value.replace("\n", " "))
    return [part.strip() for part in parts if part.strip()]


def short_text(value: str, limit: int = 74) -> str:
    text = re.sub(r"\s+", " ", value).strip()
    if len(text) <= limit:
        return text
    return f"{text[:limit]}..."


def make_keywords(question: str, answer: str, category: str) -> list[str]:
    # Keywords should describe the entry, not every incidental word in a long answer.
    # The full answer is still searchable in the page algorithm.
    source = question
    fixed_terms = [
        "学而思",
        "区别",
        "人数",
        "走神",
        "提前学",
        "奥数",
        "中考",
        "强基",
        "小班课",
        "插班",
        "程老师",
        "班型",
        "反馈",
        "距离",
        "收费",
        "学费",
        "资料",
        "大纲",
        "出门测",
        "红榜",
        "大讲堂",
        "宁外",
        "贯通班",
        "蛟川",
        "联培",
        "旁听",
        "上楼",
        "定向分配",
        "请假",
        "听不懂",
        "辅导",
        "跟不上",
    ]
    keywords = [term for term in fixed_terms if term in source]
    for token in re.findall(r"[\u4e00-\u9fa5A-Za-z0-9]{2,8}", question):
        if token not in keywords:
            keywords.append(token)
    if category not in keywords:
        keywords.append(category)
    return keywords[:22]


def read_qa_blocks(source_docx: Path) -> list[dict]:
    paragraphs = [p.text.strip() for p in Document(source_docx).paragraphs if p.text.strip()]
    blocks = []

    for offset, start in enumerate(QUESTION_START_PARAGRAPHS):
        end = QUESTION_START_PARAGRAPHS[offset + 1] - 1 if offset + 1 < len(QUESTION_START_PARAGRAPHS) else len(paragraphs)
        question, first_answer = clean_question(paragraphs[start - 1], start)
        answer_parts = []
        if first_answer:
            answer_parts.append(first_answer)
        for para_index in range(start + 1, end + 1):
            part = clean_answer_part(paragraphs[para_index - 1], question)
            if part:
                answer_parts.append(part)

        index = offset + 1
        category = get_category(index)
        answer = "\n\n".join(answer_parts).strip()
        if not question or not answer:
            raise ValueError(f"第 {index} 条问答抽取失败：question={question!r}, answer length={len(answer)}")

        blocks.append(
            {
                "id": f"XG{index:03d}",
                "q": question,
                "a": answer,
                "category": category,
                "keywords": make_keywords(question, answer, category),
                "aliases": [
                    question,
                    question.replace("怎么回复家长？", "").strip("，。；; "),
                    question.replace("，怎么回复家长？", "？"),
                ],
                "source": source_docx.name,
                "source_section": "7.1 学管学堂问答系统",
                "review_status": "原文导入",
            }
        )

    if len(blocks) != 49:
        raise ValueError(f"应抽取 49 条问答，实际抽取 {len(blocks)} 条")
    return blocks


def group_knowledge_base(blocks: list[dict], source_docx: Path) -> dict:
    categories: dict[str, list[dict]] = {}
    for block in blocks:
        item = {key: value for key, value in block.items() if key != "category"}
        categories.setdefault(block["category"], []).append(item)

    return {
        "version": "xueguan-knowledge-2026-07-01",
        "title": "学管知识库系统",
        "total": len(blocks),
        "updated_at": date.today().isoformat(),
        "source_file": source_docx.name,
        "categories": [
            {
                "id": f"C{index:02d}",
                "name": name,
                "description": "来自最新版学管学堂问答文档，保留原文标准话术。",
                "questions": questions,
            }
            for index, (name, questions) in enumerate(categories.items(), start=1)
        ],
    }


def get_qa_by_number(blocks: list[dict], number: int) -> dict:
    return blocks[number - 1]


def option_set(correct: str, distractors: list[str], seed: int) -> tuple[list[str], int]:
    unique = [correct]
    for item in distractors:
        if item and item not in unique:
            unique.append(item)
        if len(unique) >= 4:
            break
    while len(unique) < 4:
        unique.append("不确定时先脱离标准话术自行发挥。")
    shift = seed % 4
    rotated = unique[shift:] + unique[:shift]
    return rotated, rotated.index(correct)


def multiple_option_set(correct_items: list[str], distractors: list[str], seed: int) -> tuple[list[str], list[int]]:
    base = []
    for item in correct_items + distractors:
        if item and item not in base:
            base.append(item)
        if len(base) >= 4:
            break
    while len(base) < 4:
        base.append("只截取一句话回复家长，省略原答案中的关键背景。")
    correct_values = set(correct_items)
    shift = seed % 4
    rotated = base[shift:] + base[:shift]
    answer_indexes = [idx for idx, value in enumerate(rotated) if value in correct_values]
    return rotated, answer_indexes


def build_test_questions(lesson_id: str, lesson_qas: list[dict], all_qas: list[dict]) -> list[dict]:
    questions = []
    distractor_answers = [short_text(split_sentences(qa["a"])[0]) for qa in all_qas if split_sentences(qa["a"])]
    advantage_keywords = [
        "匠人程",
        "程老师",
        "宁波",
        "本地",
        "名校",
        "蛟川",
        "宁外",
        "强基",
        "考情",
        "出题",
        "经验",
        "分层",
        "因材施教",
        "适配",
        "冲刺",
        "押中",
        "体系",
    ]
    wrong_options = [
        "先承诺孩子一定能提分或录取，再解释课程安排。",
        "不确认孩子基础和家长真实问题，直接推荐最高强度班型。",
        "只截取一句话回复家长，省略原答案中的背景和边界。",
        "遇到政策、排课、费用等变化信息时，不复核最新口径就直接答复。",
        "为了促成报名，把课程效果说成确定结果。",
        "把不同项目、不同班型、不同年级的口径混在一起回答。",
        "家长提出质疑时，先反驳家长，不做解释和引导。",
        "只背标题，不回到完整答案理解语境。",
    ]

    def add_multiple(prompt: str, correct_items: list[str], distractors: list[str], explanation: str, seed: int) -> None:
        options, answer_indexes = multiple_option_set(correct_items, distractors, seed)
        questions.append(
            {
                "id": f"{lesson_id}-Q{len(questions) + 1:02d}",
                "type": "multiple",
                "question": prompt,
                "options": options,
                "answerIndexes": answer_indexes,
                "explanation": explanation,
            }
        )

    def advantage_sentences(sentences: list[str], fallback_items: list[str]) -> list[str]:
        matched = [sentence for sentence in sentences if any(keyword in sentence for keyword in advantage_keywords)]
        return unique_texts(
            matched
            + fallback_items
            + [
                "突出匠人程对宁波本地考情、名校节奏和孩子分层适配的理解。",
                "强调课程建议要结合孩子基础、目标学校和实际课堂表现，不做空泛承诺。",
            ]
        )

    for index, qa in enumerate(lesson_qas):
        sentences = split_sentences(qa["a"])
        answer_core = short_text(sentences[0] if sentences else qa["a"])
        second_core = short_text(sentences[1] if len(sentences) > 1 else "回复时应保留背景、边界和下一步建议，不随意压缩语境。")
        third_core = short_text(sentences[2] if len(sentences) > 2 else "遇到不确定或实时变化的信息，要先复核最新口径再回复。")
        fourth_core = short_text(sentences[3] if len(sentences) > 3 else "要把孩子基础、课程匹配和家长真实顾虑放在一起判断。")
        fifth_core = short_text(sentences[4] if len(sentences) > 4 else "表达时既要突出优势，也要保留事实边界，不做绝对化承诺。")
        advantage_cores = advantage_sentences(sentences, [answer_core, second_core, third_core])
        add_multiple(
            f"围绕家长问题“{short_text(qa['q'], 54)}”，哪些内容属于标准回复要点？",
            [answer_core, second_core],
            distractor_answers + wrong_options,
            "正确选项来自本节完整答案。老师要记住核心表达，同时回到原文理解完整语境。",
            index + 3,
        )
        add_multiple(
            f"处理“{short_text(qa['q'], 48)}”这类沟通时，哪些做法更合适？",
            ["先判断家长真正关心的是课程定位、学习效果、费用、政策还是执行细节。", "回复时保留标准话术中的背景、边界和下一步建议，不随意改口径。"],
            wrong_options,
            "这题考的是学管老师的沟通动作，不只是背一句答案。",
            index + 13,
        )
        add_multiple(
            f"复盘“{short_text(qa['q'], 48)}”这条问答时，哪些内容需要重点记住？",
            [answer_core, third_core],
            distractor_answers + wrong_options,
            "复盘题用于帮助老师记住答案重点、风险边界和不能乱答的地方。",
            index + 23,
        )
        add_multiple(
            f"回答“{short_text(qa['q'], 48)}”时，哪些表达更能突出匠人程的优势？",
            [advantage_cores[0], advantage_cores[1]],
            distractor_answers + wrong_options,
            "这题专门帮助老师记住匠人程的核心优势，答家长时要说出具体价值，不要只说空话。",
            index + 31,
        )
        add_multiple(
            f"为了帮助老师记住“{short_text(qa['q'], 48)}”的完整话术，哪些细节不该漏掉？",
            [second_core, fourth_core],
            distractor_answers + wrong_options,
            "记忆题用于把原答案里的关键细节留下来，避免只记标题、忘了支撑理由。",
            index + 41,
        )
        add_multiple(
            f"家长继续追问“{short_text(qa['q'], 44)}”时，哪些回应更稳妥、更专业？",
            [third_core, fifth_core],
            distractor_answers + wrong_options,
            "追问题考的是现场表达：既要讲清优势，也要保留边界，不能乱承诺。",
            index + 53,
        )

    return questions


def build_training_program(blocks: list[dict], source_docx: Path) -> dict:
    lessons = []
    tests = []

    for lesson_index, (lesson_id, title, numbers) in enumerate(LESSON_GROUPS, start=1):
        lesson_qas = [get_qa_by_number(blocks, number) for number in numbers]
        question_ids = [qa["id"] for qa in lesson_qas]
        objectives = [
            "能通过关键词或完整问题找到对应标准话术。",
            "学习完整答案中的背景、边界和回复顺序。",
            "能在实际沟通中保留原文语境，不随意压缩重要内容。",
        ]
        lessons.append(
            {
                "id": lesson_id,
                "title": title,
                "category": "学管课堂",
                "duration": "30-45分钟",
                "questionIds": question_ids,
                "objectives": objectives,
                "overview": f"本课学习 {len(question_ids)} 条标准问答，重点训练学管老师按原文话术理解、检索和复述。",
                "practice": "请先阅读本课完整问答，再用家长口语化提问进行搜索，确认能找到对应或相似答案。",
            }
        )
        test_questions = build_test_questions(lesson_id, lesson_qas, blocks)
        tests.append(
            {
                "id": f"T{lesson_index:02d}",
                "lessonId": lesson_id,
                "title": f"{title} 阶段测试",
                "scoreMode": "percent",
                "totalScore": 100,
                "questionCount": len(test_questions),
                "questions": test_questions,
            }
        )

    return {
        "version": "xueguan-training-2026-07-01",
        "updated_at": date.today().isoformat(),
        "title": "学管课堂",
        "description": "基于最新版 7.1 学管学堂问答系统整理成 20 节学习课，课堂内容以原问答为核心。",
        "source_file": source_docx.name,
        "testPolicy": {
            "mode": "multiple-choice-memory-test-by-lesson-content",
            "description": "每节课按现有题量翻倍生成全多选记忆测试，重点帮助老师记住标准话术和匠人程优势。",
            "totalScore": 100,
        },
        "lessons": lessons,
        "tests": tests,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source-docx",
        default="/Users/chengzhihao/Desktop/匠人程学管学堂问答系统(7.1).docx",
        help="最新版学管问答 Word 文档路径。",
    )
    parser.add_argument("--data-dir", default="data", help="输出 JSON 的 data 目录。")
    args = parser.parse_args()

    source_docx = Path(args.source_docx)
    data_dir = Path(args.data_dir)
    blocks = read_qa_blocks(source_docx)
    knowledge_base = group_knowledge_base(blocks, source_docx)
    training_program = build_training_program(blocks, source_docx)

    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "knowledge_base.json").write_text(
        json.dumps(knowledge_base, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (data_dir / "training_program.json").write_text(
        json.dumps(training_program, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"wrote {knowledge_base['total']} Q&A")
    print(f"wrote {len(training_program['lessons'])} lessons")
    print(f"wrote {sum(len(test['questions']) for test in training_program['tests'])} test questions")


if __name__ == "__main__":
    main()
