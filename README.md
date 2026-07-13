# AirNote / 空书

AirNote 是使用 React、TypeScript 和 Vite 构建的桌面网页工具。当前成立版本为 M1 P0 基础绘图闭环 `0.2.0-m1.1`。

M1 当前链路为：摄像头或鼠标输入 → 校准/坐标映射 → 手势状态机 → 轨迹处理 → 正式 Stroke → Canvas Ink → 撤销历史。

## 环境要求

- Node.js 24.x
- npm 11.x
- 桌面 Chrome 或 Edge

## 安装

```bash
npm install
```

## 本地启动

```bash
npm run dev
```

Vite 默认地址为 `http://localhost:5173/`。如果端口被占用，以终端显示的实际地址为准。

页面加载不会请求摄像头权限。用户可直接使用鼠标绘图，或主动点击“启用摄像头”后完成/跳过校准并使用捏合手势绘图。

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

## M1 成立范围

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

未实现：

- 笔画分组、想法卡片和连接线
- 完整工作区自动保存、刷新恢复、PNG 和项目 JSON 导入导出
- OCR、后端、账号、云同步
- Glow、Particle、手势模式 2 和键盘自由文字

## 隐私边界

视频与关键点只在浏览器运行时内存处理，不录制、不保存、不上传。MediaPipe WASM 与模型从项目本地加载，不包含 API 密钥或外部服务配置。当前本地存储只包含校准、输入模式和画笔设置，不包含视频帧或关键点流。
