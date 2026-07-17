# AirNote / 空书

AirNote 是使用 React、TypeScript 和 Vite 构建的桌面网页工具。当前成立版本为 M4 完整 P0 里程碑 `0.5.0-m4.1`；当前开发阶段已进入 P1，首先实现可关闭、可降级的 `STYLE-01` 实验视觉。

完整 P0 链路为：摄像头或鼠标输入 → 正式 Stroke → 笔画分组 → 用户确认生成卡片 → 卡片整理与连接 → 本地自动保存与刷新恢复 → PNG/项目 JSON 导出与安全导入。P1 实验视觉默认关闭，关闭时始终使用 Ink。

## 环境要求

- Node.js 24.x
- npm 11.x
- 桌面 Chrome 或 Edge

## 安装

```bash
npm install
```

## 换机恢复

```bash
git clone https://github.com/yunyunyunzaipiao-dot/airnote.git
cd airnote
npm ci
npm run typecheck
npm test
npm run build
```

使用 Node.js 24.x 和 npm 11.x；依赖版本由 `package-lock.json` 锁定。MediaPipe WASM 与手部模型已保存在 `public/mediapipe/`，核心功能不需要额外下载模型，也不需要项目级环境变量。

GitHub 只保存源码、产品文档、测试、非敏感工程配置和本地模型资产。`node_modules/`、`dist/`、日志、临时文件与 `.env*` 不进入仓库；浏览器中的工作区和校准设置也不会自动跨电脑同步，需要在旧电脑使用“导出项目”，再在新电脑使用“导入项目”。Git 用户名、邮箱和 GitHub 登录凭据属于电脑级配置，需要在新电脑单独设置或登录。

## 本地启动

```bash
npm run dev
```

Vite 默认地址为 `http://localhost:5173/`。如果端口被占用，以终端显示的实际地址为准。

页面加载不会请求摄像头权限。用户可直接使用鼠标绘图，或主动点击“启用摄像头”后完成/跳过校准并使用捏合手势绘图。

顶部栏提供“导出图片”“导出项目”和“导入项目”：PNG 只包含画布笔迹、卡片与连接；项目 JSON 可再次导入编辑。导入文件会先完成格式、版本和引用校验，只有用户确认后才替换当前画布。

## 工程检查

```bash
npm run typecheck
npm test
npm run build
```

## 项目记录

- 每日开发进度：[`docs/progress/`](docs/progress/README.md)
- 版本成立与变更记录流程：[`docs/VERSIONING.md`](docs/VERSIONING.md)

只有负责人明确批准版本成立后，才更新版本号、Changelog 和版本说明；Git 提交、标签与推送仍需明确授权。

## 当前实现范围

已实现：

- `CAM-03` 四点书写区域与三次捏合/松开校准，支持明确跳过并使用默认参数
- 校准参数、输入模式偏好和画笔属性本地保存
- `INPT-01` 鼠标降级绘图，摄像头失败、关闭或刷新后仍可使用
- `DRAW-01` 正式 Stroke 数据，少于两个有效点时丢弃
- `DRAW-02` 镜像、ROI 映射、方向自适应 EMA 与 2 CSS 像素抽样
- `DRAW-03` 颜色以及 2/4/8px 三档固定粗细，旧 Stroke 保留画笔快照
- `EDIT-01` 至少 50 步撤销/重做与键盘快捷键
- `EDIT-02` 确认清空和一次完整撤销
- 输入切换、页面失焦、摄像头关闭、追踪丢失和 Canvas 尺寸变化时结束 activeStroke
- `GROUP-01` 停笔 1.2 秒后显示分组建议，不自动生成卡片
- `CARD-01` 用户确认生成引用原始 Stroke 的想法卡片
- `CARD-02` 卡片移动、改名、删除和可撤销尺寸调整
- `EDGE-01` 上下左右四向锚点、无向/有向连接及实时端点更新
- `SAVE-01` 800ms 防抖本地保存、校验恢复和损坏副本保留
- `SAVE-02` 画布内容 PNG 导出、项目 JSON 导出、全量校验后确认导入与立即本地保存
- Stroke、Group、Card、Edge 和清空操作的完整工作区撤销/重做
- `STYLE-01` 实验视觉开关、Glow 与临时 Particle 渲染、减少动态效果偏好和低帧率分级降级；不改写原始 `Stroke.points`

未实现：

- OCR、后端、账号、云同步
- `GEST-02` 张掌暂停、手势模式 2 和键盘自由文字

## 隐私边界

视频与关键点只在浏览器运行时内存处理，不录制、不保存、不上传。MediaPipe WASM 与模型从项目本地加载，不包含 API 密钥或外部服务配置。工作区本地快照只包含项目结构和设置，不包含视频帧、关键点流、历史栈、密钥或令牌。
