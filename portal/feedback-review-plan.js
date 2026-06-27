(function () {
  const reviewPlan = [
    {
      seq: 1,
      teacher: "颜雨涵",
      username: "yanyuhan",
      system: "招生管理系统",
      match: ["开课时间", "渠道归属"],
      status: "已修改待复核",
      resolution: "招生报名登记已补开课时间选择、可自定义时间段并保存；生源来源已简化为线上客户、老生家长转介绍、扩科、其他。",
      action: "进入招生系统新增或编辑一条报名记录，检查开课时间能否选择/自定义，渠道归属是否按新选项显示。"
    },
    {
      seq: 2,
      teacher: "颜雨涵",
      username: "yanyuhan",
      system: "招生管理系统",
      match: ["课程产品", "暑假数学提升班"],
      status: "已修改待复核",
      resolution: "报名课程产品已补程老师班课、科学班课、数学小班课、科学小班课、数学一对一、科学一对一。",
      action: "进入报名登记，检查课程产品下拉是否够用，能否保存到线索/报名档案。"
    },
    {
      seq: 3,
      teacher: "颜雨涵",
      username: "yanyuhan",
      system: "招生管理系统",
      match: ["试听中心", "反馈对应学生"],
      status: "已修改待复核",
      resolution: "试听中心已补试听学生、学校、年级、试听班级、联系方式、微信、试听时间、试听老师、跟进对象、跟进内容、提醒时间、试听反馈、下一步状态等字段。",
      action: "完整预约一名试听学生，再填写试听反馈，确认学生姓名、提醒时间和反馈内容都能保存。"
    },
    {
      seq: 4,
      teacher: "高芳燕",
      username: "gaofangyan",
      system: "学生与家长服务系统",
      match: ["上课日期", "班级进行分类"],
      status: "已修改待复核",
      resolution: "学生服务已按日期、时间、老师、班级筛选点名；缺勤异常已按班级维度过滤，避免全站学生全部铺开。",
      action: "选择一节具体课程，带出班级名单，保存点名后进入缺勤异常，确认只显示该班级需处理学生。"
    },
    {
      seq: 5,
      teacher: "高芳燕",
      username: "gaofangyan",
      system: "学生与家长服务系统",
      match: ["程老师班课系统", "科学班课系统"],
      status: "已修改待复核",
      resolution: "学生与家长服务系统已拆成程老师班课系统、小班课系统、科学课系统三个入口。",
      action: "进入学生与家长服务系统，先点三个入口，确认每个入口看到的学生范围符合实际。"
    },
    {
      seq: 6,
      teacher: "周珊",
      username: "zhoushan",
      system: "AI 助手",
      match: ["看不到老师们写的反馈", "怎么转"],
      status: "部分修改待复核",
      resolution: "AI 助手草稿和已归档反馈已按账号权限显示；普通老师只看自己的草稿/归档，管理角色可通过学生服务查看已归档课堂反馈。",
      action: "周珊请重点测试：老师归档课堂反馈后，自己是否能在学生服务的课堂反馈时间轴看到；如果看不到，请写清楚是哪位老师、哪个学生、是否已经归档。"
    },
    {
      seq: 7,
      teacher: "刘大君",
      username: "liudajun",
      system: "财务系统",
      match: ["排课行与工资行", "老师排列顺序"],
      status: "部分修改待复核",
      resolution: "财务系统已增加老师结算结果、数据核对中心、排课行与工资行逐条查看入口；排序和口径仍需要刘老师按真实核对习惯复核。",
      action: "进入财务系统切到对应月份，查看排课行/工资行明细是否更容易按老师和日期核对；如仍乱，请指出希望的排序字段。"
    },
    {
      seq: 8,
      teacher: "高芳燕",
      username: "gaofangyan",
      system: "学生与家长服务系统",
      match: ["学生反馈", "适当折叠"],
      status: "已修改待复核",
      resolution: "学生反馈和课堂反馈时间轴已做折叠展示，减少学生量增多后的页面长度。",
      action: "进入学生服务台账，查看反馈是否能展开/收起，搜索学生时是否更方便。"
    },
    {
      seq: 9,
      teacher: "叶源泽",
      username: "yeyuanze",
      system: "AI 助手",
      match: ["ai整理出来的", "人工修改"],
      status: "已修改待复核",
      resolution: "AI 整理结果、草稿内容已支持直接编辑，编辑后可保存草稿或归档。",
      action: "生成一条课堂反馈，直接在右侧结果框修改，再保存草稿和归档，确认修改后的内容被保存。"
    },
    {
      seq: 10,
      teacher: "赵萱",
      username: "zhaoxuan",
      system: "教研与课程产品系统",
      match: ["课程产品总览", "无法点击"],
      status: "部分修改待复核",
      resolution: "教研系统已强化授课大纲、资料台账、上传下载和分类入口；总览卡片是否全部按赵老师预期跳转仍需复核。",
      action: "点击课程产品总览各卡片，记录哪些已经跳转正确，哪些仍只是展示不能进入。"
    },
    {
      seq: 11,
      teacher: "叶源泽",
      username: "yeyuanze",
      system: "建议与任务协同系统",
      match: ["指派任务完成", "适当进行删除"],
      status: "部分修改待复核",
      resolution: "建议/任务系统已简化为提出问题、支持、派任务、负责人反馈、提出人复核；删除已增加确认，已完成内容进入闭环状态。",
      action: "创建一条建议并派任务，负责人提交完成反馈后，检查界面是否不再混乱；如仍希望隐藏哪些卡片，请指出。"
    },
    {
      seq: 12,
      teacher: "叶源泽",
      username: "yeyuanze",
      system: "建议与任务协同系统",
      match: ["提交完成反馈", "负责人"],
      status: "部分修改待复核",
      resolution: "任务闭环已要求负责人提交完成反馈，并回写到原建议/反馈；负责人权限限制还需要用多个账号复测。",
      action: "用非负责人账号尝试提交完成反馈；如果仍能提交，请截图并反馈账号名。"
    },
    {
      seq: 13,
      teacher: "叶源泽",
      username: "yeyuanze",
      system: "建议与任务协同系统",
      match: ["个人短信", "信息界面"],
      status: "部分修改待复核",
      resolution: "首页已加模块负责人任务和我的任务，反馈状态能回到个人台账；短信/外部消息提醒暂不做第一阶段。",
      action: "查看自己的主页我的任务/我的反馈，确认能看到与自己相关的任务和整改状态；短信提醒先不复核。"
    },
    {
      seq: 14,
      teacher: "郑嘉艺",
      username: "zhengjiayi",
      system: "教学质量系统",
      match: ["所有按钮都点不开"],
      status: "需重新测试定位",
      resolution: "这条是教学质量系统按钮全量失效，当前需要复测确认是浏览器缓存、权限、还是具体按钮逻辑。",
      action: "部署新版本后重新打开教学质量系统，点每个按钮；如果仍点不开，请写清楚按钮名称、账号、设备和截图。"
    },
    {
      seq: 15,
      teacher: "程志豪",
      username: "chengzhihao",
      system: "匠人程工作台",
      match: ["至少50个问答"],
      status: "暂不修改/内容补充",
      resolution: "知识库问答数量不足属于内容建设，不是本轮程序问题；后续可继续补充问答素材。",
      action: "如果希望补充知识库，请按题目/答案/分类整理内容，后续批量录入。"
    },
    {
      seq: 16,
      teacher: "李舒",
      username: "lishu",
      system: "AI 助手",
      match: ["开始语音无法点击", "只能文字输入"],
      status: "已修改待复核",
      resolution: "AI 助手手机语音已改为先申请麦克风权限；不支持网页实时识别时尝试调起手机原生录音或键盘听写。",
      action: "用手机 HTTPS 地址进入 AI 助手，点开始语音/听写，确认是否弹出麦克风权限或可进入听写。"
    },
    {
      seq: 17,
      teacher: "叶源泽",
      username: "yeyuanze",
      system: "AI 助手",
      match: ["开始语音", "没有开始录制"],
      status: "已修改待复核",
      resolution: "AI 语音按钮已做移动端触摸兼容和麦克风权限检测；原先已确认解决的记录建议再复测一次。",
      action: "叶老师用自己的手机再试一次开始语音；如仍不行，请反馈手机型号、浏览器、是否微信内打开。"
    },
    {
      seq: 18,
      teacher: "李舒",
      username: "lishu",
      system: "AI 助手",
      match: ["归档至学生服务", "全部反馈记录"],
      status: "已修改待复核",
      resolution: "已归档课堂反馈会进入学生服务，并按老师本人/权限显示；草稿库保留最近 50 条。",
      action: "生成一条反馈后归档学生服务，再到学生服务对应学生下查看是否按上课顺序能看到。"
    },
    {
      seq: 19,
      teacher: "李舒",
      username: "lishu",
      system: "AI 助手",
      match: ["最近草稿", "打不开"],
      status: "已修改待复核",
      resolution: "课堂反馈草稿库已支持查看、展开、编辑、保存和带回右侧精修。",
      action: "保存一条草稿后打开草稿库，测试查看草稿内容、保存修改、带到右侧精修。"
    },
    {
      seq: 20,
      teacher: "赵萱",
      username: "zhaoxuan",
      system: "教研与课程产品系统",
      match: ["不能批量上传", "更新新的文件"],
      status: "已修改待复核",
      resolution: "教研课程资料上传已支持批量上传、版本更新和去重思路，授课大纲也按分类整理。",
      action: "一次选择多个文件上传；同名或同资料更新后检查是否显示最新版本。"
    },
    {
      seq: 21,
      teacher: "赵萱",
      username: "zhaoxuan",
      system: "教研与课程产品系统",
      match: ["选项较多重复", "上传流程"],
      status: "已修改待复核",
      resolution: "教研上传流程已简化授课大纲入口，去掉部分冗余筛选，按年级、体系、老师分类。",
      action: "赵老师按真实资料上传一套课程大纲，记录还有哪些选项多余或难懂。"
    },
    {
      seq: 22,
      teacher: "郑嘉艺",
      username: "zhengjiayi",
      system: "教学质量系统",
      match: ["客观数据", "主观评价", "师德"],
      status: "暂不修改/二期设计",
      resolution: "教学质量权重、问卷过滤、师德倒扣、加分激励、趋势图属于评价体系重构，需要单独确定规则后再开发。",
      action: "郑老师先把建议作为二期方案保留；本轮只复核按钮、入口和现有评分是否能正常使用。"
    },
    {
      seq: 23,
      teacher: "高芳燕",
      username: "gaofangyan",
      system: "学生与家长服务系统",
      match: ["不勾选", "按照成绩排序"],
      status: "已修改待复核",
      resolution: "点名名单默认未点名，不预设到课；已增加按姓名首字母、出门测成绩排序，并支持出门测反向修正到课。",
      action: "高老师生成一节课点名名单，确认初始状态为空/未点名，测试按姓名和成绩排序。"
    },
    {
      seq: 24,
      teacher: "叶源泽",
      username: "yeyuanze",
      system: "建议与任务协同系统",
      match: ["支持的点击", "一人一次"],
      status: "部分修改待复核",
      resolution: "支持已改为一人一次可取消；派任务和完成反馈已做闭环。影响程度颜色、外部文字提醒属于后续优化。",
      action: "叶老师测试支持按钮是否只能算一次；任务派出后负责人是否能看到并提交完成反馈。"
    },
    {
      seq: 25,
      teacher: "颜雨涵",
      username: "yanyuhan",
      system: "招生管理系统",
      match: ["锁定归属", "改不了"],
      status: "已修改待复核",
      resolution: "招生报名后的归属锁定已增加解锁按钮和留痕，解锁后可修改并记录原归属。",
      action: "找一条已报名线索，先确认锁定不能直接改，再点解锁归属链，检查是否留痕并可保存修改。"
    },
    {
      seq: 26,
      teacher: "颜雨涵",
      username: "yanyuhan",
      system: "招生管理系统",
      match: ["试听反馈单", "孩子名字"],
      status: "已修改待复核",
      resolution: "试听反馈对应学生字段已补可填写/选择逻辑，与试听预约流程联动。",
      action: "新增试听预约后填写反馈，确认反馈对应学生能填写并保存。"
    },
    {
      seq: 27,
      teacher: "颜雨涵",
      username: "yanyuhan",
      system: "AI 助手",
      match: ["图片上传模式", "解读图片"],
      status: "暂不修改/二期功能",
      resolution: "AI 图片识别本轮先不加，避免影响课堂反馈、招生和点名等核心流程稳定。",
      action: "暂不复核；后续需要时单独提出图片识别使用场景和样例。"
    },
    {
      seq: 28,
      teacher: "颜雨涵",
      username: "yanyuhan",
      system: "招生管理系统",
      match: ["导出excel"],
      status: "已修改待复核",
      resolution: "招生系统已增加导出当前筛选和导出全部 Excel/CSV 的入口。",
      action: "筛选一批线索后导出，打开文件确认字段完整、数量正确。"
    },
    {
      seq: 29,
      teacher: "颜雨涵",
      username: "yanyuhan",
      system: "招生管理系统",
      match: ["家长转介绍排序"],
      status: "已修改待复核",
      resolution: "转介绍排序已经和转介绍费用板块合并，推荐人/转介绍线索会集中展示。",
      action: "录入带推荐人的线索，查看转介绍排序里是否靠前显示。"
    },
    {
      seq: 30,
      teacher: "颜雨涵",
      username: "yanyuhan",
      system: "招生管理系统",
      match: ["转介绍功能", "费用"],
      status: "已修改待复核",
      resolution: "转介绍费用/奖励状态已经纳入转介绍排序与费用模块，并预留财务联动口径。",
      action: "录入或编辑转介绍奖励金额、发放状态，确认能在模块中看到。"
    },
    {
      seq: 31,
      teacher: "颜雨涵",
      username: "yanyuhan",
      system: "招生管理系统",
      match: ["招生个数", "每天", "每周"],
      status: "已修改待复核",
      resolution: "招生看板已加入日、周、月、年统计思路和招生老师数据口径。",
      action: "颜老师查看招生看板，确认能按时间范围看自己/老师招生数量；如缺字段请指出。"
    },
    {
      seq: 32,
      teacher: "叶源泽",
      username: "yeyuanze",
      system: "AI 助手",
      match: ["转化成知识点", "模版", "美化"],
      status: "已确认解决/继续观察",
      resolution: "课堂反馈已按统一模板、分段、知识点要点、学习掌握情况和课后作业整理；此前已确认解决。",
      action: "继续观察生成质量，如遇分类错误或知识点不准，直接把原始口述和生成结果一起反馈。"
    },
    {
      seq: 33,
      teacher: "刘大君",
      username: "liudajun",
      system: "财务系统",
      match: ["不懂怎么使用", "课时结算结果"],
      status: "已修改待复核",
      resolution: "财务系统已补老师结算结果、数据核对中心、逐条明细和点名结算预览。",
      action: "刘老师进入财务系统切月份，先看老师结算结果，再看数据核对中心；如看不懂，请指出具体位置。"
    },
    {
      seq: 34,
      teacher: "李舒",
      username: "lishu",
      system: "AI 助手",
      match: ["结合老师对学生情况", "自动生成完整文字反馈"],
      status: "已修改待复核",
      resolution: "AI 课堂反馈模板已升级为新的五段格式，并支持编辑、草稿、归档。",
      action: "李老师用一段真实课堂口述测试，确认生成结果是否符合统一模板。"
    },
    {
      seq: 35,
      teacher: "李舒",
      username: "lishu",
      system: "匠人程工作台",
      match: ["匹配对应模板", "完整文字反馈"],
      status: "已修改待复核",
      resolution: "与第34条属于同类模板需求，已合并处理。",
      action: "按第34条一起复核；无问题后两条都可确认解决。"
    }
  ];

  function normalizeText(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, "");
  }

  function rowMatchesPlan(row, plan) {
    const username = normalizeText(row?.username || row?.authorUsername || "");
    const name = normalizeText(row?.userName || row?.name || row?.author || "");
    if (plan.username && username && username !== normalizeText(plan.username)) return false;
    if (!username && plan.teacher && name && name !== normalizeText(plan.teacher)) return false;
    const haystack = normalizeText([
      row?.system,
      row?.pageTitle,
      row?.type,
      row?.feedbackCategory,
      row?.content,
      row?.description,
      row?.url
    ].join(" "));
    return plan.match.every((keyword) => haystack.includes(normalizeText(keyword)));
  }

  function findReviewPlan(row, usedSeqs = new Set()) {
    const direct = reviewPlan.find((plan) => !usedSeqs.has(plan.seq) && rowMatchesPlan(row, plan));
    if (direct) return direct;
    return reviewPlan.find((plan) => rowMatchesPlan(row, plan)) || null;
  }

  function groupRowsByReviewer(rows, options = {}) {
    const usedSeqs = new Set();
    const groups = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const plan = findReviewPlan(row, usedSeqs);
      if (!plan) return;
      usedSeqs.add(plan.seq);
      const username = String(row?.username || plan.username || "").trim().toLowerCase();
      const teacher = String(row?.userName || row?.name || plan.teacher || "未登录").trim();
      const key = username || teacher;
      if (!groups.has(key)) {
        groups.set(key, {
          teacher,
          username,
          rows: []
        });
      }
      groups.get(key).rows.push({ row, plan });
    });
    if (options.includeUnmatchedPlan) {
      reviewPlan.forEach((plan) => {
        if (usedSeqs.has(plan.seq)) return;
        const key = plan.username || plan.teacher;
        if (!groups.has(key)) {
          groups.set(key, { teacher: plan.teacher, username: plan.username, rows: [] });
        }
        groups.get(key).rows.push({ row: null, plan });
      });
    }
    groups.forEach((group) => {
      group.rows.sort((left, right) => left.plan.seq - right.plan.seq);
    });
    return [...groups.values()].sort((left, right) => left.teacher.localeCompare(right.teacher, "zh-Hans-CN"));
  }

  function shouldFeedbackEnterReview(status) {
    return !["已确认解决", "继续反馈"].includes(String(status || ""));
  }

  window.JRC_FEEDBACK_REVIEW_PLAN = {
    rows: reviewPlan,
    findReviewPlan,
    groupRowsByReviewer,
    shouldFeedbackEnterReview
  };
})();
