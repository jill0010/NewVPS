# AnonPort 前端原样复原 — 固定总进度框架 v1.0

> 本文件为固定总框架。阶段编号、顺序、验收条件不得中途改写或删除。遇到障碍只在对应阶段下增加 `BLOCKER-编号` 子项；解决后保留历史记录。原始 `newvps1.rar`、`newvps2.rar` 及 `extracted/` 永不覆盖。
>
> 状态：TODO / DOING / BLOCKED / DONE。完成仅依据证据，不按主观百分比估算。总体进度 = DONE 阶段数 / 10。单个阶段未完成不计入 DONE。

| 编号 | 固定阶段 | 验收条件 | 状态 | 问题子项 |
|---|---|---|---|---|
| 01 | 原始档案核验 | 两个 RAR 存在、两份解压目录存在、文件树完整 | DONE | — |
| 02 | 全量页面索引 | 69 个 HTML 逐一映射原 URL、语言、标题、重复关系 | DONE | — |
| 03 | 资源依赖核对 | HTML 引用的 CSS/JS/图片/字体均定位，缺失单独登记 | DONE | BLOCKER-03-01（缺失已登记） |
| 04 | 原样静态托管 | 可从工作分支启动静态预览，保留原始内容 | DONE | — |
| 05 | 页面路由复原 | 每个已收集页面可由对应路径访问，404 逐项记录 | DONE | — |
| 06 | 视觉逐页核验 | 桌面/移动布局、字体、颜色、间距、图片逐页比对 | DOING | BLOCKER-06-01、BLOCKER-06-03 |
| 07 | 交互逐项核验 | 菜单、按钮、筛选、弹窗等逐项验证，后端依赖单列 | DOING | BLOCKER-07-01、BLOCKER-07-02（已解决）、BLOCKER-07-03 |
| 08 | 多语言与响应式 | 已收集语言版本和不同视口逐一验证 | TODO | — |
| 09 | 线上预览部署 | 取得实际可访问的预览 URL，验证部署版本与提交 | DONE | BLOCKER-09-01（已解决） |
| 10 | 最终差异审计 | 差异清单、未实现原因、逐页验收记录与最终交付 | TODO | — |

## 不可变执行规则
1. `restore-original-archives` 是档案分支；`restore-frontend` 是工作分支；不擅自修改原始网页内容。
2. 仅允许必要的路径映射、静态托管配置与非侵入性加载修复；任何无法原样复现的内容必须明确记录。
3. 不凭空编写原站缺失页面或伪造交互、数据、截图及部署成功状态。
4. 遇到问题时在对应阶段追加 `BLOCKER-01` 等子条目，写明现象、证据、修复、验证；不改变总阶段。
5. 每次汇报固定使用同一 10 阶段表格，附当前阶段、阻塞子项、提交链接与预览链接（若有）。
6. 69 个 HTML 是采集快照数量，不等于 69 个不同 URL；以阶段 02 的去重索引为准。

## 基线证据
- `main`：两个原始 RAR。
- `restore-original-archives`：两个 RAR 与 `extracted/newvps1`、`extracted/newvps2`，共 69 个 `index.html`、4145 个解压文件（GitHub 文件树检查）。
- 本框架首次创建日期：2026-11-09（UTC+08:00）。

## 阶段 05 验收证据
- 2026-11-08：GitHub Actions https://github.com/jill0010/NewVPS/actions/runs/42500979248 ，66 条唯一 canonical 路由均通过线上 HTTP、标题和语言检查；核验报告保存于该运行的 `online-route-audit` artifact。此验收不代表视觉、交互及动态后端功能已经完成。

## 阶段 03 资源审计记录
- 审计报告 `restoration/asset-issues.json` schema v2：1236 条本地静态资源引用已检查，345 条未直接在捕获页面路径定位；其中绝大多数是全站共享根目录引用（favicon、touch icon、manifest、agent.json），不等于 348 个独立缺失文件。
- 已通过 `de0025b` 在部署产物中从原始哈希命名资源恢复 favicon、32px favicon、touch icon，不改动源文件。2026-11-08 已经由 GitHub Actions https://github.com/jill0010/NewVPS/actions/runs/42501389791 验证线上 3 种图标与捕获原始文件逐字节一致（工作流成功）。其他资源仍待核验。

- 资源报告已重新分类：`/AnonPort.webp` 和 `/assets/img/og-image.jpg` 属于链接目标而非页面渲染依赖。剩余未定位项只有 5 类根路径资源：三个图标已从原始哈希文件还原并逐字节验证；`/manifest.json`、`/.well-known/agent.json` 原始文件未收集到，保留为已登记差异，不伪造内容。阶段 03 按“定位或登记缺失”验收，**不代表这两项已修复**。

## 阶段 06 视觉核验记录
- 2026-11-08：GitHub Actions https://github.com/jill0010/NewVPS/actions/runs/42501742057 成功，已生成 66 条唯一线上路由在 1440×900 与 390×844 视口下的 132 张截图，并上传 64 MB 证据工件 `original-content-visual-audit`。
- 已增加截图检查统计，后续运行将明确汇总图片加载异常、水平溢出与 HTTP 失败。原始归档提供的是 HTML 与资源快照，而不是同条件参考截图；截图存在不代表完成视觉一致性比对。

## 阶段 07 交互清点证据
- GitHub Actions https://github.com/jill0010/NewVPS/actions/runs/42504004671 成功：69 份快照、66 条独立路由，原始 HTML 中出现链接 8338 次、按钮 617 次、表单 76 次、文本输入框 153 次、下拉框 8 次、多行文本框 1 次、其他输入框 79 次。以上是快照中元素出现次数，不代表独立功能数量或可用性。
- 已新增只读线上交互审计：检查导航路径是否仍指向部署站点根目录、无标签按钮、控件数量等；不提交表单、不下单、不触发账户操作。

## BLOCKER 子项登记
### BLOCKER-07-02 — 动态导航路径偏离预览子目录（已解决）
- https://github.com/jill0010/NewVPS/actions/runs/42504095441 ：66/66 路由只读检查成功，按钮无标签页面 0，唯独 `/use-cases/vpn-hosting` 有 2 个运行时链接指向站点根目录 `/`，不在 `/NewVPS/` 下。
- 原始归档包含这些根目录导航链接；静态构建已有路径替换，但原始脚本可能在页面加载后再次赋值。提交 `f1a9493` 仅在预览产物注入导航路径保护，保留原始归档。
- 复验 https://github.com/jill0010/NewVPS/actions/runs/42504353579 ：VPN 页 Home 实际点击已成功返回 `/NewVPS/`；但另一页 `/use-cases/scraping-proxy-hosting` 仍检出两个根目录链接，说明问题尚未全站解决。已改为等待页面完整加载，并对残余异常直接令工作流失败，避免把报告成功误作验收通过。
- 最终复验 https://github.com/jill0010/NewVPS/actions/runs/42504518074 成功：66/66 路由检查完成，错误站内导航路径 0，两个问题页面实际 Home 点击均成功返回 `/NewVPS/`。
 
### BLOCKER-07-03 — 原始网页快照缺少可执行交互脚本
- GitHub Actions https://github.com/jill0010/NewVPS/actions/runs/42504830517 ：三个菜单测试 0/3 通过；桌面语言按钮 aria-expanded 不变，手机语言按钮不可点击，手机菜单按钮点击后仍未展开。
- 全量审计 https://github.com/jill0010/NewVPS/actions/runs/42505114347 已通过：69 份 HTML 快照、66 个唯一路由中，包含 `<script>` 标签的快照 0 份，脚本标签总数 0，包含行内事件处理器的快照 0 份。此为原始材料的明确缺口，不是单页偶发异常。
- 已直接核对原始首页 `extracted/newvps1/cloned-page-1794124882520/index.html`：`<script>` 标签 0 个、`onclick` 等行内事件处理器 0 个。原始文件为浏览器抓取后的静态 DOM 快照，保留了菜单按钮的外观与属性，但不包含原网站对应交互逻辑。修复必须依据可核验的原站行为或其他原始文件证据；不得臆造登录、支付或其他业务交互。

### BLOCKER-07-01 — 动态交互与后端服务尚未验收
- 原始捕获包含账户、表单和支付相关控件；静态预览不能直接证明真实后端功能可用。先执行安全的只读导航与控件核验，涉及交易、登录、支付的流程单列，不凭空补造。

### BLOCKER-06-03 — 原始 HTML 与线上页面存在不稳定的高度差异
- GitHub Actions https://github.com/jill0010/NewVPS/actions/runs/42502857792 ：66 条路由 × 桌面/手机 = 132 组对照；两侧渲染失败 0、标题差异 0、宽度差异超过 2px 的视口 0。
- 高度差超过 10px 的 6 组：`/zh/gpu` 桌面 29px、`/gpu` 桌面 29px、`/crypto-gpu-hosting` 手机 276px、`/tos` 手机 159px、`/privacy` 桌面 46px、`/privacy` 手机 23px。
- 再次运行 https://github.com/jill0010/NewVPS/actions/runs/42503329995 ：超过 10px 的高度差变为 10 组，同一路由的差值也有变化；页面区块和页脚的换行高度存在差异，页面正文前 300 字符一致。这证明差异结果受渲染条件或资源加载时序影响，尚不能认定页面代码不同。已更新对照程序，等待字体与图片解码后才测量；不改写原始文案或 CSS。

### BLOCKER-06-02 — 两处视口检测到图片加载异常（已解决）
- GitHub Actions https://github.com/jill0010/NewVPS/actions/runs/42502055797 ：66 路由、132 视口，HTTP 失败 0、横向溢出 0、图片异常视口 2。
- 复查 https://github.com/jill0010/NewVPS/actions/runs/42502256035 日志：两处均是 `/account` 的桌面和手机视口；原始 HTML 中 `img` 元素有意未设置 `src`（例如动态支付图标与 2FA QR），此前误判为网络加载失败。修复 `6d1d923` 已排除无 `src` 的占位图，复验 https://github.com/jill0010/NewVPS/actions/runs/42502555290 已通过：132 视口图片加载异常 0、HTTP 失败 0、横向溢出 0。

### BLOCKER-06-01 — 尚缺同视口原始页面的基准截图
- 原始归档有 HTML、CSS、JS 和图片，尚未确认存在可直接使用的桌面/移动基准截图。必须通过原始快照的隔离渲染或已有截图建立可核验基线，不能拿现网站的即时状态冒充历史采集基线。

### BLOCKER-03-01 — 捕获快照缺少部分根目录静态资源
- 已识别 `/manifest.json`、`/.well-known/agent.json`、`/AnonPort.webp`、`/assets/img/og-image.jpg` 等引用。缺失项不得凭空生成；按原始归档搜索或保留差异记录。

### BLOCKER-09-01 — GitHub Pages deployment job fails before steps start（已解决）
- 证据：Run https://github.com/jill0010/NewVPS/actions/runs/42499917068 ，commit `4c2a732`，build 全部步骤成功，`github-pages` 工件上传成功（约 31 MB），但 deploy job 在 2026-11-08T16:27:00Z 至 16:27:01Z 之间失败，且 GitHub API 返回 `steps: []`、无 runner 名称。
- 结论：静态构建成功，故障位于部署作业启动/权限/环境配置阶段；由于日志存储返回 BlobNotFound，具体 GitHub 拒绝原因尚未证实，不能认定权限或设置是唯一原因。
- 根因：`github-pages` 环境的 Deployment branches and tags 仅允许 `main`，阻止 `restore-frontend` 的部署作业启动。用户已允许 `restore-frontend` 分支。
- 验证：Run https://github.com/jill0010/NewVPS/actions/runs/42500744010 ，commit `a2b33f7`，build 和 deploy 均成功；实际访问 `https://jill0010.github.io/NewVPS/`、`/zh/`、`/vps/` 均返回相应原始页面内容。其余页面的视觉和交互仍需逐项核验。

### BLOCKER-09-01 / 历史构建故障（已解决）
- Run https://github.com/jill0010/NewVPS/actions/runs/42499745109 构建因 Python 正则表达式转义错误失败。
- 修复：`8b4de62`，在 run `42499917068` 已验证构建成功。
