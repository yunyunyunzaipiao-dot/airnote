<p align="center">
  <a href="./README.zh-CN.md"><kbd>简体中文</kbd></a>
  <a href="./README.md"><kbd>English</kbd></a>
</p>

# AirNote / 空书

**面向生成式艺术与创意编程场景的实验性创意草稿工具。**

**状态：P0 MVP 已完成（`0.5.0-m4.1`）· P1 产品假设探索中**

## 项目速览

AirNote 在验证：**允许不精确、心理负担更低的输入，是否能帮助创作者外化尚未成形的视觉感觉。** P0 已完成摄像头手势 / 鼠标 → Stroke → Group Suggestion → 用户确认后生成 Card → Connection 的 MVP。完成后，基于个人使用观察，我更常回到自由绘制，而不是 Card / Edge 整理，因此开始探索 `Draw → Transform → Discover`。视觉变体能否帮助创作者想到下一步，尚未经过充分用户验证。

![展示笔触、卡片和连接关系的 AirNote 原型](./docs/media/readme/ink-card-selection.png)

<p align="center"><sub>P0 MVP：从自由笔触到 Card 与 Connection。</sub></p>

### 手势绘制演示

<a href="./docs/media/readme/gesture-drawing.mp4">
  <img src="./docs/media/readme/gesture-drawing.gif" alt="AirNote 手势绘制演示" width="100%">
</a>

<p align="center"><sub>手势绘制演示 · 点击 GIF 查看原始 MP4。</sub></p>

## 为什么做

AirNote 起源于我使用 TouchDesigner 和生成式艺术工具时遇到的真实问题：我经常只有一种模糊的视觉感觉，却很难仅靠脑内思考决定下一步应该尝试什么效果。

高精度绘图工具适合表达和精修，但在想法尚未成形时，不一定解决“下一步尝试什么”的问题。因此，我想尝试一种允许不精确、心理负担更低的表达方式：先用普通摄像头手势或鼠标留下 Stroke，再观察这些笔触能否帮助创意继续发展。

我接触到的部分手势绘图 Demo 更强调输入效果本身，而较少覆盖保存、撤销、整理和后续发展的完整链路。AirNote 的第一阶段因此不只做“空中画线”，而是做出一个可以继续使用的 MVP。

## 初始产品假设

第一阶段产品假设是：

> 模糊想法可以先通过自由笔触外化，再由用户决定是否把它们整理成结构。

对应路径为：

**Draw → Organize**

**Camera Gesture / Mouse → Stroke → Group Suggestion → User Confirmation → Card → Connection**

系统只提出分组建议，不自动理解或提交内容。Card 和 Edge 用来验证：笔触被保留下来之后，用户是否需要继续命名、移动和连接这些想法。

## MVP 决策与产品取舍

| 产品决策 | 为什么这样做 | 对应取舍 |
|---|---|---|
| 选择 Web + 普通摄像头 | 不要求 XR、深度相机或专用客户端，让用户能用现有设备进入体验 | 普通摄像头更容易受到光线、遮挡、设备性能和追踪精度影响 |
| 保留鼠标降级 | 摄像头可能被拒绝、占用或识别失败；长时间悬臂也容易疲劳 | 产品不是纯手势体验，部分可靠编辑仍由鼠标完成 |
| 把 Stroke 作为原始数据事实 | Card、视觉风格和后续实验都不应覆盖用户最初留下的笔触 | 派生能力必须与原始数据分离，不能直接用视觉结果代替 Stroke |
| Group 后由用户确认，再生成 Card | 停笔不等于系统已经理解用户意图，用户应决定是否进入整理阶段 | 比自动生成多一步操作，但避免过早结构化和错误提交 |
| 第一阶段加入 Card / Edge | 验证自由绘制之后，命名、移动和连接是否能帮助想法继续发展 | 整理动作会增加操作成本，也可能把注意力从绘制本身移开 |
| 暂不做 OCR、后端和云同步 | 优先完成本地 MVP，同时避免上传、密钥、费用、账号和隐私问题 | 当前没有文字识别、在线项目管理或跨设备同步 |
| 不接入 LLM 自动整理 | 尚无证据证明自动命名、移动或合并内容能帮助这个创作阶段 | 当前没有 AI 内容生成、自动分类或自动思维导图能力 |

## 当前原型

P0 MVP 已完成以下主路径：

**摄像头手势 / 鼠标**\
**→ Stroke**\
**→ Group Suggestion**\
**→ 用户确认后生成 Card**\
**→ Card / Edge 整理**\
**→ 本地保存与项目导入导出**

当前原型包括：

- 摄像头手势和鼠标双输入；摄像头不可用时仍可使用核心功能；
- 捏合落笔、松开或追踪丢失时断笔；
- Stroke 创建、撤销、重做、确认清空和整笔擦除；
- 停笔后的分组建议，以及用户确认后生成 Card；
- Card 移动、编辑、删除与 Edge 连接；
- 本地自动保存和项目导入导出；
- Ink 默认稳定风格，以及可关闭、可降级的 Glow / Particle 实验性视觉变体。

Glow / Particle 已作为渲染能力实现，但这不代表这些视觉变体已经被证明能促进创意发散。

<details>
<summary><strong>查看完整原型图集</strong></summary>

<br>

<table>
  <tr>
    <td width="50%">
      <img src="./docs/media/readme/calibration-roi.png" alt="手势书写区域校准">
      <br><sub>手势书写区域校准</sub>
    </td>
    <td width="50%">
      <img src="./docs/media/readme/gesture-test.png" alt="手势绘制测试">
      <br><sub>手势绘制测试</sub>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="./docs/media/readme/card-connection.png" alt="Card 与 Edge 连接交互">
      <br><sub>Card 与 Edge 连接交互</sub>
    </td>
    <td width="50%">
      <img src="./docs/media/readme/design-system.png" alt="AirNote 设计系统">
      <br><sub>AirNote 设计系统</sub>
    </td>
  </tr>
</table>

</details>

## MVP 之后发生了什么

完成 P0 后，我重新观察了自己的实际使用行为。

原假设是：

**Draw → Organize**

但在我自己的使用中，真正持续使用和觉得有趣的更多是**自由绘制本身**，而不是后续 Card / Edge 整理。

这带来了一个新的产品问题：

> 如果同一份原始 Stroke 产生不同的视觉变体，创作者是否会从中看到原本没有想到的下一步？

当前待验证方向是：

**Draw → Transform → Discover**

这是使用过程中的个人观察，不是用户研究结论。它尚未证明新方向成立，也不能因此否定 Card / Edge；旧 MVP 仍然是第一阶段真实的产品决策和开发结果。

这个项目本身并不以 LLM 为核心，但它让我实际经历了问题定义、MVP 取舍、验证边界和产品假设调整这几个过程。

## 下一步验证

下一阶段需要同时验证“视觉变体是否有价值”以及“这种价值是否能重复出现”。

### 测什么

- 用户能否从视觉变体中提出一个原本没有的具体创作方向；
- 用户是否愿意基于某个结果继续绘制或发展；
- 用户认为结果只是“好看”，还是确实“帮助我想到下一步”；
- Card / Edge 与 Visual Variation 分别在创作的什么阶段有价值；
- 多次使用后，这种帮助是否仍然存在。

### 怎么测

计划采用**小规模定性任务测试（small-scale qualitative task testing）**：

1. 邀请生成式艺术、创意编程或视觉创作相关用户完成一次开放式创作任务；
2. 先让用户自由绘制，保留未经变化的原始 Stroke；
3. 提供少量由同一 Stroke 派生的视觉变体（Visual Variations），让用户选择是否继续发展其中一个结果；
4. 观察用户是否形成新的具体方向、是否继续操作，以及 Card / Edge 在哪个阶段被需要；
5. 任务后进行简短访谈，区分视觉新奇感与实际创作帮助；
6. 在条件允许时进行后续回访，观察这种价值是否只在首次体验时出现。

目前尚未确定样本数量，也没有提前设定“新方向一定成立”的结论。

## 当前边界

### 已实现

- 摄像头手势与鼠标输入；
- 原始 Stroke 创建与保留；
- Group Suggestion 和用户确认后生成 Card；
- Card / Edge 整理；
- 撤销、重做与可恢复编辑；
- 本地保存与项目导入导出；
- Glow / Particle 等可关闭的实验性视觉变体。

### 尚未验证

- Card / Edge 是否是核心价值，还是可选的后续整理能力；
- Visual Variation 是否真的促进创意发散；
- 用户是否会持续使用这一过程；
- 是否提高创意效率或创意质量；
- `Draw → Transform → Discover` 是否比第一阶段路径更有价值。

### 尚未实现

- OCR 或手写文字识别；
- LLM 自动命名、分类或整理；
- 后端、账号和云同步；
- 多人协作和公开分享；
- TouchDesigner、Blender、Processing 等外部工具集成；
- 多工作区 / 多项目管理。

这些内容不是 Roadmap 承诺，也不表示相关能力已经存在。

## 本地运行

要求：Node.js 24.x、npm 11.x、桌面 Chrome 或 Edge。

```bash
git clone https://github.com/yunyunyunzaipiao-dot/airnote.git
cd airnote
npm ci
npm run dev
```

默认地址为 `http://localhost:5173/`。

页面加载时不会自动请求摄像头权限。用户可以直接使用鼠标，或主动启用摄像头，在完成或跳过校准后使用手势绘制。

## 工程实现

AirNote 当前使用 React、TypeScript、Vite 和本地 MediaPipe Hand Landmarker。工程实现服务于上述产品假设，不代表项目以展示前端技术为主要目标。

### 项目结构

- `src/camera/`、`src/handTracking/`、`src/gesture/`：摄像头、手部追踪和手势状态；
- `src/drawing/`、`src/visualEffects/`：Stroke 与实验性视觉变体渲染；
- `src/strokeGroups/`、`src/cards/`、`src/edges/`：分组、Card 和连接；
- `src/store/`、`src/history/`、`src/persistence/`：工作区状态、历史和本地保存；
- `src/export/`：图片与项目数据导入导出；
- `src/tests/`：自动化测试；
- `public/mediapipe/`：本地模型与 WASM 资源。

### 工程检查

```bash
npm run typecheck
npm test
npm run build
```

自动测试用于检查功能行为、错误处理和数据不变量，不等同于产品价值或用户需求已经得到验证。

### 隐私与数据边界

- 摄像头只能由用户主动启用；
- 视频帧和手部关键点只在浏览器运行时内存中处理；
- 默认不录制、不保存、不上传摄像头画面；
- 工作区保存在浏览器本地；
- 项目 JSON 不包含视频、关键点流、API 密钥或访问令牌；
- 实验性视觉变体不得覆盖或重排原始 `Stroke.points`。

### 产品与开发记录

- [产品背景文档](./AirNote_01_产品背景文档_v0.3.docx)
- [产品需求文档](./AirNote_02_产品需求文档_AI执行版_v0.3.docx)
- [产品边界文档](./AirNote_03_产品边界文档_v0.3.docx)
- [每日开发进度](./docs/progress/README.md)
- [版本与变更记录](./CHANGELOG.md)
- [版本管理规则](./docs/VERSIONING.md)

### 详细功能范围

完整功能 ID、失败处理、边界条件和验收要求见：

- [产品需求文档](./AirNote_02_产品需求文档_AI执行版_v0.3.docx)
- [产品边界文档](./AirNote_03_产品边界文档_v0.3.docx)
- [CHANGELOG](./CHANGELOG.md)
- [每日开发进度](./docs/progress/README.md)
