# 匠人程排课系统

这是一套面向教育培训机构的排课系统需求基线，按你当前提供的信息整理。当前已经拆成两套独立页面：

1. `平时排课系统`
   面向常规学期，正式口径是周三到周五晚课、周六周日全天课，按老师月历和自定义起止时间维护
2. `寒暑假排课系统`
   面向假期按日排课，当前默认内置数据仍以暑假班的 6 节模板、锁房和暑期分组逻辑为主

## 快速查看

当前已经有两版可直接打开的浏览器原型：

- 双系统入口：[index.html](/Users/chengzhihao/paike-system/index.html:1)
- 平时系统：[prototype/june.html](/Users/chengzhihao/paike-system/prototype/june.html:1)
- 寒暑假系统：[prototype/index.html](/Users/chengzhihao/paike-system/prototype/index.html:1)
- 平时系统简版：`prototype/june.html?simple=1`
- 寒暑假系统简版：`prototype/index.html?simple=1`

原型当前支持：

1. 平时系统里维护老师月历型排课，支持自定义起止时间、老师月历视图、教室日视图、平时模式规则校验、按日期自动带出默认时段和独立后台保存
2. 寒暑假系统里维护老师、教室、待开班数据
3. 两套系统都支持自动保存在浏览器本机
4. 两套系统都支持导出 / 导入 JSON 快照
5. 寒暑假系统支持导入 Excel 另存为 CSV 的数据文件，包括月度利润、分红政策、老师月结算、提成规则、提成覆盖、免费时间档
6. 寒暑假系统支持导入汇总型时间档板，保留像周老师这类没有学生级明细的历史老师页
7. 寒暑假系统支持批量识别并导入 `import-ready` 标准 CSV 文件，包括真实需求草稿
8. 两套系统都支持下载模板
9. 寒暑假系统支持查看周课表和按教室视图查看课表，并把暑期大课锁房和小班建议一起看
9. 录入月度利润、导入分红政策模板，自动计算分红比例 / 分红池 / 留存利润
10. 查看月度费用明细
11. 查看老师月度结算历史样例或导入后的真实结算数据，并和当月利润分红联动核对
12. 导入桥接 / 对账 / 复核清单 JSON，在原型里直接看老师级异常和月份级复核摘要
13. 导入 / 导出 `settlement-review-resolutions-template.csv`，把人工复核结论沉淀成后续可回放的处理记录
14. 导入老师结算迁移画像报告、课时费导入就绪报告、结算导入执行波次和排课-结算动作总表，直接看每位老师每个月离“自动结算底稿”还差哪一步，也能看到工资表按月份/按老师的接入阻塞点、当前该先迁哪一批老师，以及下一步该先开哪个复核文件
15. 查看老师提成政策覆盖报告，直接核对当前月份是否有主规则、哪些未来规则只是默认 20%、哪些老师已经确认未来比例、哪些覆盖项还存在重复比例歧义
16. 基于当前自动排课结果查看“结算规则覆盖”，并按计划月份切换未来提成规则
17. 给待开班填写“预计单节收入”后，直接预估 revenue-share 老师的周课时提成、预计收入和教学毛结余
18. 按“暑假三期 × 每期 15 次”把当前周课表建议折算成暑假总课次、老师结算和教学毛结余
19. 导入 `schedule-draft-review-bulk-candidates-report.json`、`schedule-draft-review-manual-review-report.json`、`schedule-draft-review-manual-classname-batch-candidates-report.json`、`schedule-draft-review-manual-classroom-batch-candidates-report.json`、`schedule-draft-review-manual-combined-batch-candidates-report.json`、`schedule-draft-review-manual-residual-report.json` 后，在原型里直接按月份查看“高置信候选 / 班名批量 / 联合批量 / 教室批量 / 最终逐条尾项”五层排课复核动作，并看到每组建议的置信度、历史证据和最后必须人工拍板的尾项
20. 导入 `summer-schedule-settlement-report.json` 或 `prototype-import-snapshot.json` 后，在原型里直接看暑期老师、班级、建议单节收入和预估老师结算，并可直接填写 / 导出 `summer-class-revenue-template.csv`；页面会同步给出本地混合口径的老师结算预估和教学毛结余，正式结果再通过脚本重跑固化

## 后台数据库模式

如果你想让网页修改结果直接落到一份可共享的 SQLite 后台，而不是只存在浏览器缓存里，可以启动后台数据库模式：

```bash
python3 /Users/chengzhihao/paike-system/scripts/run_local_db_server.py --port 8000
```

启动后：

1. 网页入口默认变成 `http://你的电脑局域网IP:8000/index.html`
2. 页面会优先从这台电脑上的 SQLite 读取当前快照
3. 寒暑假系统继续写默认后台快照；平时系统独立写 `june_regular` 后台快照
4. 编辑后的数据会继续保存在浏览器里，同时自动同步写入对应后台数据库
5. 后台会自动保留历史版本，并把每次写入再落一份 JSON 磁盘备份
6. 页面里的“后台历史版本”可以刷新最近版本，并恢复选中的后台记录
7. 手动点击页面里的保存按钮可以强制落一次库
8. 点击页面里的读取按钮可以把当前后台版本重新载回页面

如果你后面改了本地 SQLite 后台逻辑，想快速确认“当前快照 / 历史版本 / 恢复 / 磁盘备份”这四件事都没坏，可以直接运行：

```bash
python3 /Users/chengzhihao/paike-system/scripts/verify_local_db_store.py
```

如果后面要在本机读取微信聊天记录、并把多部服务手机的聊天统一导到电脑侧处理，可以先运行：

```bash
python3 /Users/chengzhihao/paike-system/scripts/diagnose_wechat_local_extraction.py
```

相关说明文档：

- [微信本机解库可行性验证](docs/wechat-local-extraction-feasibility.md)
- [多部服务手机微信聊天记录采集流程](docs/wechat-multi-device-workflow.md)
- [微信聊天记录标准化归纳](docs/wechat-conversation-standardization.md)

默认数据库文件位置：

- `/Users/chengzhihao/paike-system/artifacts/local-db/paike-local.sqlite3`

默认后台磁盘备份目录：

- `/Users/chengzhihao/paike-system/artifacts/local-db/backups`

默认网页发布目录：

- `/Users/chengzhihao/paike-system-web-release`

服务启动时会自动把最新网页文件和 `prototype-import-snapshot.json` 刷到发布目录，再把首份快照写进 SQLite。

### 老师在自己电脑打开的两种方式

最省事的是直接让老师在她自己的电脑浏览器里打开双系统入口：

- `http://你的电脑局域网IP:8000/index.html`

这样老师可以先选“平时系统”或“寒暑假系统”；如果老师只需要直接改内容，优先打开简版入口。前端和后台同源，修改会直接写回对应 SQLite 快照。

如果老师想打开一份单独拷过去的页面副本，也可以：

1. 把 `paike-system-web-release` 整个文件夹拷到老师电脑，或把其中的网页文件放到任意静态 HTTP 目录
2. 老师按业务打开 `prototype/june.html` 或 `prototype/index.html`
3. 在页面“保存状态”卡片里填写后台地址，例如 `http://你的电脑局域网IP:8000`
4. 点击 `连接后台`

连接成功后，页面会自动比对本地缓存和后台版本，优先避免样例数据覆盖正式后台；后续修改会继续自动同步到后台数据库。

注意：

1. 后台服务必须保持运行
2. 两台电脑需要在同一局域网，或老师电脑能访问到你的 `8000` 端口
3. 如果老师打开的是 `https` 静态网页，而后台仍是 `http://...:8000`，浏览器可能会拦截混合内容；这时优先直接打开局域网地址，或在老师电脑上用本地 HTTP 方式打开页面副本

如果你不想手敲命令，可以直接双击项目根目录里的：

- `启动排课系统.command`
- `停止排课系统.command`

启动脚本会自动：

1. 后台拉起本机数据库服务
2. 自动打开浏览器到本地入口
3. 在终端里打印同一局域网可访问的地址，方便发给周老师

另外，`templates/import/dividend-policy-template.csv` 现在是分红口径的单一来源。修改这里后，真实 Excel 抽取、`import-ready` 生成和利润-结算-分红月报都会按同一套规则重算。

`templates/import/summer-teacher-reporting-policy-template.csv` 是暑期大班老师是否进入系统、老师结算区和经营利润月报的单一来源。当前已确认 `程老师 / 海老师 / 姚老师` 只保留暑期锁房事实，不进入排课导入、老师结算、课时费导入就绪、利润-结算-分红月报和老师经营报表。

当前还补了一条真实 Excel 导入准备链路：

1. `scripts/extract_real_workbooks.py`
   从真实排课 / 工资 Excel 抽出 `import-preview`
2. `scripts/build_import_ready_package.py`
   把 `import-preview` 转成标准模板字段的 `import-ready`
3. `scripts/build_import_preflight_report.py`
   对 `import-ready` 做导入前一致性检查，并校验利润分红字段
4. `scripts/build_settlement_seed_sql.py`
   把 `import-ready` 生成可重复执行的 MySQL 导入 SQL
5. `scripts/build_prototype_import_snapshot.py`
   把 `import-ready` 生成原型可直接导入的 JSON 快照，并尽量带上桥接 / 对账 / 复核清单诊断，以及暑期单节收入模板
6. `scripts/build_import_reconciliation_report.py`
   生成老师结算、利润、费用的导入对账报告
7. `compensation-slot-summaries-template.csv`
   正式承接汇总型时间档板，不再只停留在诊断文件
8. `scripts/build_schedule_settlement_bridge_report.py`
   生成课表事实、报名名册、工资结算三者之间的桥接核对报告
9. `scripts/build_settlement_review_queue.py`
   把桥接异常和结算对账异常合并成老师-月份级人工复核清单
10. `scripts/build_settlement_review_resolution_template.py`
   从人工复核清单生成可填写、可反复覆盖保留的复核处理模板
11. `scripts/build_teacher_master_template.py`
   从真实结算、规则、复核结论和暑期大班占用生成老师主数据模板，把离职老师同步成不可排课状态，也把只出现在暑期大班里的老师补进排课/结算链路；同时按当前业务规则把核心老师默认收口到 `6/36`、非核心老师默认收口到 `5/30`
12. `scripts/build_schedule_draft_import_package.py`
   从真实名册、意向排课、老师月历、暑期大班占用生成学生 / 班级 / 待排需求 / 老师课表草稿，并把课表里的历史班名回填成 `inactive` 班级实体；若 `summer-teacher-reporting-policy-template.csv` 把某些暑期老师标成不纳入系统，则这些大班只保留锁房事实，不进入导入草稿
13. `scripts/build_schedule_draft_review_package.py`
   从排课草稿里拆出“草稿班名 / 缺教室”复核模板，并保留可回放的人工修正入口
14. `scripts/build_summer_schedule_settlement_report.py`
   从暑期大课课表生成老师负载 / 规则覆盖 / 单节收入模板，并在下一次重跑时继续复用已填写的收入值；同时拆出班级经营收入、老师结算、教学毛结余三套暑期口径，并直接标出老师是否超日上限、是否未收口到当日日目标。若 `summer-teacher-reporting-policy-template.csv` 已把暑期老师排除，则只输出排除说明，不再生成收入 / 结算 / 经营口径
15. `summer-big-class-hint-resolutions-template.csv`
   若暑期大班锁房里仍有缺 `海/姚` 标注或 `奥数` 待判定项，这张模板会把逐日未决行压成分组，并附带 `resolution_requirement_summary / suggested_resolution_payload_json / candidate_resolution_payloads_json` 这类可直接照填的提示；填完后重跑流水线，会自动回放到教室占用报告
16. `scripts/build_schedule_draft_manual_review_queue.py`
   按当前老师结算画像，把排课草稿复核里“未进入高置信候选包”的残余人工项单独拆成队列，避免继续在总表里逐条翻
17. `scripts/build_schedule_draft_manual_classname_batch_candidates.py`
   把残余人工项里“同老师同月同别名”的草稿班名再收成批量候选，并给出置信度、历史样本和建议依据，方便一组确认正式班名
18. `scripts/build_schedule_draft_manual_classroom_batch_candidates.py`
   把残余人工项里“仅缺教室且建议房间一致”的课次再收成批量候选，方便一次确认多条房间
19. `scripts/build_schedule_draft_manual_class_backfill_template.py`
   把批量候选之外仍然残留的“逐条草稿班名 / 草稿班名+缺教室”课次单独生成人工回填模板，方便最后几条逐条确认
20. `scripts/build_schedule_draft_manual_room_backfill_template.py`
   把批量候选之外仍然残留的“逐条缺教室”课次单独生成人工回填模板，并保留历史房间分布作为低置信参考
21. `scripts/build_teacher_settlement_profile_report.py`
   生成老师-月份级结算画像，判断哪些月份已接近可自动结算、哪些仍卡在补源或人工口径；同时按 `summer-teacher-reporting-policy-template.csv` 过滤不进入结算区的老师
22. `scripts/build_settlement_review_followup_report.py`
   把未关闭复核项进一步拆成可执行跟进包，直接列出缺结算单老师、汇总型时间档板关联老师、跨月持续缺失学生
23. `scripts/apply_teacher_rule_backfill_template.py`
   把 `teacher-rule-backfill-template.csv` 里已确认的主规则建议自动合并回 `teacher-compensation-rules-template.csv`，这样下一轮老师画像、暑期结算准备和利润联动会直接吃到新规则
24. `scripts/build_compensation_import_readiness_report.py`
   生成课时费工作簿导入就绪报告，按月份 / 老师汇总“明细表 / 汇总板 / 缺结算 / 缺规则 / 排课阻塞”状态，方便后续替换新工资表时快速自检；同时按暑期老师报表策略过滤不进入结算区的老师
25. `scripts/build_settlement_ops_action_report.py`
   生成按“月份 × 老师”排序的统一动作总表，把排课复核、工资表缺口、可迁移状态和利润背景合在一起，直接告诉你当前应该先处理哪位老师、先开哪个文件；同时补出每个月利润/分红是否已到“当前安全 / 高置信后 / 批量后”可一起导入的状态
26. `scripts/build_settlement_import_execution_report.py`
   把老师月份进一步压成“立即迁移 / 高置信后迁移 / 批量确认后迁移 / 人工复核 / 历史保留”几层执行波次，便于按批推进真实工资表接入
27. `scripts/build_ops_open_items_report.py`
   把暑期大班老师标注、春季逐条尾项、缺结算老师月份、汇总型时间档板这些跨模块待办统一收口成一份总报告；未来提成年度涨幅已按当前口径不作为待办，默认 20% 规则继续保留在老师政策报告里
28. `scripts/build_ops_chat_answer_sheet.py`
   把仍需你拍板的暑期老师标注、春季班名、春季教室压成一页聊天答题卡，直接按模板回复即可回填
29. `scripts/apply_ops_chat_answer_sheet.py`
   读取 `ops-chat-answer-sheet-replies.txt` 里的聊天回复，把暑期大班标注、春季班名、春季教室自动回写到三张人工模板里，下一次重跑流水线时会继续自动应用
27. `scripts/build_settlement_import_wave_packages.py`
   基于执行波次直接生成分波 SQL 包，把“当前安全可导入 / 高置信确认后 / 批量确认后”的老师月份拆成独立落库包，并自动避开尚未完整的整月利润导入；同时补出利润月份 readiness 明细，直接说明每个月净利润 / 分红为什么还不能跟着一起进包
28. `scripts/build_settlement_import_deferred_action_packages.py`
   把仍然延期的老师月份拆成逐老师逐月份清零包，自动过滤出对应的高置信候选、班名/教室批量候选、尾项逐条队列、复核证据和原工资表路径，方便一包一包清
29. `scripts/run_real_import_pipeline.py`
   一次性跑完整真实导入流水线，并输出总摘要

## 分享到微信群

可以，但要先把当前目录部署成静态网页，不能直接发送本地文件路径。

当前最省事的方式：

1. 打开 [DEPLOY.md](/Users/chengzhihao/paike-system/DEPLOY.md:1)
2. 按文档里的 `Netlify Drop` 步骤，把整个 `paike-system` 文件夹上传
3. 拿到公网链接后发到微信群

当前这一版是静态试用版，需要明确两点：

1. 别人点开后可以正常查看和操作页面
2. 但每个人保存的数据都在自己的浏览器里，不会自动同步
3. 如果你想把同一份排课数据给别人看，需要先导出 JSON 快照，再让对方导入

## 当前业务目标

1. 按年级专家优先排课，减少跨年级错配。
2. 在教室紧张前提下提高教室利用率，减少空档和容量浪费。
3. 支持班课、精品小课、一对一三种授课模式。
4. 处理调课、补课、请假、换教室等日常变更。
5. 输出教师、班级、教室、课时等核心报表，并支持导出 Excel。
6. 重点服务暑假班集中排课场景，优先解决高峰时段资源冲突。
7. 对程老师这类关键教师提供特殊排课保护，确保其授课与固定教室优先保障。

## MVP 范围

第一版建议覆盖以下能力：

1. 基础资料管理
   - 校区
   - 教室
   - 教师
   - 班级
   - 学生
   - 教师擅长年级/学科
   - 教师休息日与可授课时间
2. 排课中心
   - 手工排课
   - 半自动推荐排课
   - 冲突检测
   - 教室推荐
   - 教师推荐
3. 调课与补课
   - 请假登记
   - 调课记录
   - 补课安排
   - 顺延记录
4. 课表与报表
   - 教师个人排课表
   - 整体排课总表
   - 教室使用信息表
   - 班级课程表
   - 课时统计报表
   - 学生出勤台账
   - 年级课程汇总表
   - 教师课时费结算报表
   - 教师工资结算表
5. 通知能力
   - 第一版先保留人工通知入口和通知状态记录
   - 自动微信提醒、班级群通知建议放第二版

## 关键规则

1. 当前阶段只支持老江东单校区排课，不纳入江北外滩校区。
2. 同一时间同一位老师不能带多个班级。
3. 同一时间同一间教室不能安排多节课。
4. 本次暑假班按固定节次模板运行，单节授课 90 分钟，常规节间缓冲 10 分钟。
5. 优先按年级专家分配老师，再考虑相邻年级兼容老师。
6. 一对一、一对二优先安排二楼小教室；大班优先安排大容量教室。
7. 一年级、二年级、四年级、六年级、初二优先晚间排课。
8. 除一年级、二年级、四年级、六年级、初二外，其余年级默认进入周末优先排课池。
9. 教师执行上六休一；核心老师单日优先按 6 节收口、非核心老师单日优先按 5 节收口；周上限先按对应日上限折算，轮休日可按教室高效利用优先动态安排。
10. 暑假班高峰期排课时，系统优先压缩教室空档并提高连续利用率。
11. 暑假阶段按固定 6 节课运行：08:30-10:00、10:10-11:40、13:00-14:30、14:40-16:10、16:20-17:50、18:30-20:00。
12. 程老师暑假执行“三天上课、一天休息”，且不排第 6 节晚课。
13. 程老师固定教室为“三楼5号教室”；当其本人未使用时，该教室可释放给其他班级排课。
14. 整个暑假按三期推进，每期 15 次课；正式系统后续需要把“计划期”从周视图扩成按日期的期次排程。
15. 核心老师默认尽量不排一对一；系统先尝试非核心老师承接，只有无可行方案时才允许核心老师兜底。初三是一条例外，按年级规则允许由该年级核心老师承接一对一。
16. 常规学期若仍存在 110 分钟课程，后续需要与暑假 90 分钟模板分开建模。

## 当前已识别的风险与矛盾项

1. 当前第一版按 12 位老师设计，后续新增老师再补录入与规则。
2. 这次先不纳入江北外滩校区，后续如果开张再扩展成双校区版本。
3. 暑假班班级数量目前未定，系统需要支持按招生和教室资源动态增减班级。
4. 角色权限目前写的是“排课老师和授课老师都能看、都能改”，试用期可以这样做，但正式上线风险很高。
5. 家长经常临近上课才回复，系统必须支持“待确认”“已确认”“待补课”状态，否则排课表会反复被覆盖。
6. 暑假节次已明确，但“是否所有日期都启用 6 节模板”以及“动态轮休在排课引擎中的优先级”还需补齐。

## 文档目录

- [MVP需求](/Users/chengzhihao/paike-system/docs/mvp-requirements.md)
- [数据模型](/Users/chengzhihao/paike-system/docs/data-model.md)
- [排课规则](/Users/chengzhihao/paike-system/docs/scheduling-rules.md)
- [系统架构设计](/Users/chengzhihao/paike-system/docs/system-architecture.md)
- [排课引擎设计](/Users/chengzhihao/paike-system/docs/scheduling-engine-design.md)
- [排课运营流程](/Users/chengzhihao/paike-system/docs/operation-workflows.md)
- [现用排课表结构分析](/Users/chengzhihao/paike-system/docs/current-spreadsheet-analysis.md)
- [现有 Excel 导入映射](/Users/chengzhihao/paike-system/docs/excel-import-mapping.md)
- [课时费与结算设计](/Users/chengzhihao/paike-system/docs/compensation-settlement-design.md)
- [现用课时费结算表分析](/Users/chengzhihao/paike-system/docs/current-settlement-sheet-analysis.md)
- [课时费结算表导入映射](/Users/chengzhihao/paike-system/docs/compensation-import-mapping.md)
- [抽取脚本运行手册](/Users/chengzhihao/paike-system/docs/extractor-runbook.md)
- [待补充信息](/Users/chengzhihao/paike-system/docs/open-items.md)
- [Excel导入模板](/Users/chengzhihao/paike-system/docs/excel-import-templates.md)
- [规则样例数据](/Users/chengzhihao/paike-system/docs/rule-sample-data.md)
- [页面原型清单](/Users/chengzhihao/paike-system/docs/prototype-pages.md)

## 下一步建议

当前已经可以开始：

1. 整理 Excel 基础数据
2. 锁定正式版系统架构
3. 初始化数据库
4. 按“推荐排课 + 人工确认”实现第一版排课引擎
5. 先兼容现有 Excel 表结构，再把当前原型接到共享后端

如果你现在要继续走真实历史数据导入，建议直接按这个顺序：

1. 最省事的方式是直接跑 `run_real_import_pipeline.py`，一次性生成 `import-preview`、`import-ready`、排课草稿导入包、排课草稿复核包、暑期排课-结算准备报表、对账、桥接、复核清单、复核处理模板、老师结算画像、老师提成政策覆盖报告、统一收口待办、聊天答题卡、聊天回复自动回填结果、老师覆盖项冲突清理模板、课时费导入就绪报告、结算导入执行波次、分波 SQL 包、排课-结算动作总表、利润-结算-分红统一月报、预检、SQL、原型快照和总摘要
2. 如果你要拆开跑，再按 `extract_real_workbooks.py` → `build_import_ready_package.py` → `apply_teacher_rule_backfill_template.py` → `apply_teacher_rule_item_resolution_template.py` → `apply_ops_chat_answer_sheet.py` → `build_import_reconciliation_report.py` → `build_schedule_settlement_bridge_report.py` → `build_settlement_review_queue.py` → `build_settlement_review_resolution_template.py` → `build_teacher_master_template.py` → `apply_schedule_draft_review_bulk_candidates.py` → `apply_schedule_draft_manual_classname_batch_candidates.py` → `apply_schedule_draft_manual_classroom_batch_candidates.py` → `apply_schedule_draft_manual_combined_batch_candidates.py` → `apply_schedule_draft_manual_class_backfill_template.py` → `apply_schedule_draft_manual_room_backfill_template.py` → `build_schedule_draft_import_package.py` → `build_schedule_draft_review_package.py` → `build_summer_schedule_settlement_report.py` → `build_teacher_settlement_profile_report.py` → `build_teacher_compensation_policy_report.py` → `build_teacher_rule_item_resolution_template.py` → `build_schedule_draft_manual_review_queue.py` → `build_schedule_draft_manual_classname_batch_candidates.py` → `build_schedule_draft_manual_classroom_batch_candidates.py` → `build_schedule_draft_manual_combined_batch_candidates.py` → `build_schedule_draft_manual_residual_report.py` → `build_schedule_draft_manual_class_backfill_template.py` → `build_schedule_draft_manual_room_backfill_template.py` → `build_settlement_review_followup_report.py` → `build_compensation_import_readiness_report.py` → `build_teacher_rule_backfill_template.py` → `build_import_preflight_report.py` → `build_profit_settlement_dividend_report.py` → `build_settlement_ops_action_report.py` → `build_settlement_import_execution_report.py` → `build_settlement_import_wave_packages.py` → `build_settlement_import_deferred_action_packages.py` → `build_ops_open_items_report.py` → `build_ops_chat_answer_sheet.py` → `build_settlement_seed_sql.py` → `build_prototype_import_snapshot.py` 的顺序执行
   如果这次暑期大班里有老师只需要锁房、不进系统录入/结算/经营报表，先改 `templates/import/summer-teacher-reporting-policy-template.csv` 或 `artifacts/import-ready/summer-teacher-reporting-policy-template.csv`
   如果暑期大班锁房还存在缺 `海/姚` 标注或 `奥数` 待判定项，再改 `artifacts/import-ready/summer-big-class-hint-resolutions-template.csv`；模板里已经带了 `resolution_requirement_summary` 和可直接复制的 payload 提示，填完后重跑流水线
3. 打开原型页后，批量选择 `teachers-template.csv`、`demands-template.csv`、`profit-statements-template.csv`、`dividend-policy-template.csv`、`profit-expense-lines-template.csv`、`settlement-statements-template.csv`、`settlement-lines-template.csv`、`teacher-compensation-rules-template.csv`、`teacher-compensation-rule-items-template.csv`、`non-billable-slots-template.csv`、`compensation-slot-summaries-template.csv`、`settlement-review-resolutions-template.csv`，直接导入页面核对
4. 如果你还要在原型里看“缺主规则时该参照哪个月份补录”，优先直接导入 `prototype-import-snapshot.json`，或者单独导入 `teacher-rule-backfill-template.json`
5. 或者直接导入 `prototype-import-snapshot.json`；如果排课输入画像 / 排课草稿导入包 / 排课草稿复核包 / 暑期排课-结算准备报表 / 桥接 / 对账 / 复核清单 / 复核跟进包 / 课时费导入就绪报告 / 结算导入分波包 / 结算导入执行波次 / 排课-结算动作总表 / 利润-结算-分红统一月报 / 老师结算画像 / 老师提成政策覆盖报告 / 主规则回填建议这些 JSON 已经在 `import-ready` 目录下，快照会一并带上
6. 如果某位老师始终缺学生级明细，先看 `import-preview/compensation_sheet_diagnostics.csv`，确认原工作表是不是汇总型时间档板
   如果你要先看“这次新工资表到底识别到了哪些月份 / 哪些老师是学生级明细表 / 哪些还是汇总板 / 哪些月份缺结算或缺规则”，直接看 `compensation-import-readiness-report.md`、`compensation-import-readiness-periods.csv` 和 `compensation-import-readiness-teacher-periods.csv`
   如果你要先看“现在按执行顺序，哪些老师可以立刻迁、哪些做完高置信/批量确认后就能迁、哪些该先挂起”，直接看 `settlement-import-execution-report.md`、`settlement-import-execution-periods.csv` 和 `settlement-import-execution-teacher-periods.csv`
   如果你要先看“哪些老师现在只是默认 20% 续推、哪些未来比例已经确认、哪些历史覆盖项比例还需要去重”，直接看 `teacher-compensation-policy-report.md`、`teacher-compensation-policy-teachers.csv` 和 `teacher-compensation-policy-periods.csv`；默认 20% 的年度涨幅不再作为当前待办
   如果你要直接处理“同范围重复覆盖项到底保留哪个比例 / 单价”，优先看 `teacher-rule-item-resolution-template.csv`、`teacher-rule-item-resolution-template.json` 和 `teacher-rule-item-resolution-template.md`
   如果你要直接拿可落库的分波包，优先看 `settlement-import-wave-package-report.md`、`settlement-import-wave-profit-periods.csv` 和 `settlement-import-wave-packages/`；里面会直接给出“当前安全可导入 / 高置信确认后 / 批量确认后”三套独立 SQL，也会说明每个月利润 / 分红还差哪几位老师、卡在哪个波次
   如果你要直接清“还没进 SQL 包的那几位老师”，优先看 `settlement-import-deferred-action-report.md`、`settlement-import-deferred-action-teacher-periods.csv` 和 `settlement-import-deferred-action-packages/`；每个老师月份目录里已经拆好高置信候选、批量候选、尾项和工资表线索
   如果你要先看“本月到底先处理哪位老师、先开哪个排课复核文件、哪几位高置信确认后就能直达自动结算底稿”，直接看 `settlement-ops-action-report.md`、`settlement-ops-action-periods.csv` 和 `settlement-ops-action-teacher-periods.csv`
   如果你想直接在聊天里回我答案而不是打开 CSV，优先看 `ops-chat-answer-sheet.md` 和 `ops-chat-answer-sheet.json`
   如果你已经拿到了聊天答题卡答案，把原文保存到 `artifacts/import-ready/ops-chat-answer-sheet-replies.txt`，下次重跑流水线会自动执行 `apply_ops_chat_answer_sheet.py`，并把结果写到 `ops-chat-answer-sheet-apply-report.md`
7. 如果你要先批量消化高置信排课复核项，优先看 `schedule-draft-review-bulk-candidates.csv` 和 `schedule-draft-review-bulk-candidates-report.md`；把 `confirm_status` 改成 `confirmed / approved / apply` 后，再跑一遍流水线或单独执行 `apply_schedule_draft_review_bulk_candidates.py`
8. 如果你要直接处理“当前结算迁移里，高置信之外的残余人工项”，优先看 `schedule-draft-review-manual-review-queue.csv` 和 `schedule-draft-review-manual-review-report.md`；最终结论仍需回写到 `schedule-draft-review-resolutions-template.csv`
9. 如果你要优先处理“同老师同月同别名”的残余草稿班名，优先看 `schedule-draft-review-manual-classname-batch-candidates.csv` 和 `schedule-draft-review-manual-classname-batch-candidates-report.md`；先按置信度和历史样本确认，再把 `confirm_status` 改成 `confirmed / approved / apply`，然后重跑流水线或单独执行 `apply_schedule_draft_manual_classname_batch_candidates.py`
10. 如果你要优先处理“仅缺教室且同老师同月建议房间一致，或精确班名历史只出现过一个教室”的残余人工项，优先看 `schedule-draft-review-manual-classroom-batch-candidates.csv` 和 `schedule-draft-review-manual-classroom-batch-candidates-report.md`；把 `confirm_status` 改成 `confirmed / approved / apply` 后，再跑一遍流水线或单独执行 `apply_schedule_draft_manual_classroom_batch_candidates.py`
11. 如果你要优先处理“同时缺班名和教室、但两边都有建议”的残余人工项，优先看 `schedule-draft-review-manual-combined-batch-candidates.csv` 和 `schedule-draft-review-manual-combined-batch-candidates-report.md`；把 `confirm_status` 改成 `confirmed / approved / apply` 后，再跑一遍流水线或单独执行 `apply_schedule_draft_manual_combined_batch_candidates.py`
12. 如果只剩最后几条“逐条班名 / 班名+教室”残余，优先看 `schedule-draft-review-manual-class-backfill-template.csv` 和 `schedule-draft-review-manual-class-backfill-template.md`；填 `resolved_class_name`，如该行同时缺教室再补 `resolved_classroom_name`，把 `confirm_status` 改成 `confirmed / approved / apply`，下次跑流水线或单独执行 `apply_schedule_draft_manual_class_backfill_template.py` 时会自动并回 `schedule-draft-review-resolutions-template.csv`
13. 如果只剩最后几条“逐条缺教室”残余，优先看 `schedule-draft-review-manual-room-backfill-template.csv` 和 `schedule-draft-review-manual-room-backfill-template.md`；填 `resolved_classroom_name`，把 `confirm_status` 改成 `confirmed / approved / apply`，下次跑流水线或单独执行 `apply_schedule_draft_manual_room_backfill_template.py` 时会自动并回 `schedule-draft-review-resolutions-template.csv`
14. 如果你要只盯最后还无法批量化的尾项，直接看 `schedule-draft-review-manual-residual-queue.csv` 和 `schedule-draft-review-manual-residual-report.md`；这里已经把“缺教室历史不足 / 脏班名文本 / 还差一半信息”的最后残余单独拎出来了
13. 如果你已经在原型里补完暑期单节收入，先导出新的 `summer-class-revenue-template.csv` 覆盖 `artifacts/import-ready/` 里的同名文件，再重跑 `run_real_import_pipeline.py` 或至少重跑 `build_summer_schedule_settlement_report.py` 和 `build_prototype_import_snapshot.py`，把老师结算预估、暑期报表和原型快照一起刷新
    如果当前暑期老师已在 `summer-teacher-reporting-policy-template.csv` 里被整体排除，那么这里不会再生成收入模板，这是预期行为
14. 如果暑期锁房还剩 `needs_teacher_hint / manual_review`，先看 `summer-big-class-room-occupancy-report.md`，再按 `summer-big-class-hint-resolutions-template.csv` 里的 `resolution_requirement_summary` 和 payload 提示填写 `resolved_subject_name / resolved_teacher_names_json / resolution_status`，重跑后会自动消化
15. 如果你已经在 `teacher-rule-backfill-template.csv` 里把 `confirm_status` 改成 `confirmed / approved / apply`，下一次重跑 `run_real_import_pipeline.py` 会先自动执行 `apply_teacher_rule_backfill_template.py`，把这些规则合并进 `teacher-compensation-rules-template.csv`，并同步沉淀到 `teacher-compensation-manual-rules-template.csv`；后续结算画像、课时费导入就绪报告、暑期结算准备和利润联动都会立刻按新规则重算，而且后面再次重跑也不会丢
16. 如果你已经在 `teacher-rule-item-resolution-template.csv` 里确认了 `selected_ratio_override / selected_unit_amount`，并把 `confirm_status` 改成 `confirmed / approved / apply`，下一次重跑 `run_real_import_pipeline.py` 会先自动执行 `apply_teacher_rule_item_resolution_template.py`，把同范围重复覆盖项折叠成 1 条，并同步沉淀到 `teacher-compensation-manual-rule-items-template.csv`；后续老师提成政策覆盖报告、预检、结算画像和利润联动都会立刻按新覆盖项重算，而且后面再次重跑也不会丢
