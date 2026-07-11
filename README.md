# AirNote / 空书

AirNote 的 React + TypeScript + Vite 项目初始化骨架。

当前版本只包含工程配置、模块目录和静态页面占位，不包含任何正式产品功能。所有未实现入口均为禁用状态或明确标记“暂未实现”。

## 环境要求

- Node.js 24.x
- npm 11.x

## 安装

```bash
npm install
```

## 本地启动

```bash
npm run dev
```

Vite 默认启动地址为 `http://localhost:5173/`。如果端口被占用，终端会显示实际地址。

## 工程检查

```bash
npm run typecheck
npm test
npm run build
```

## 当前范围

已完成：

- React、TypeScript、Vite 工程配置
- 按产品模块划分的目录结构
- 顶部栏、左侧工具栏、主画布、摄像头预览、手势状态和属性面板占位
- 未实现操作的禁用状态
- 基础渲染测试

未实现：

- 摄像头权限与视频流
- MediaPipe 与手部关键点追踪
- 捏合手势状态机与绘图
- Stroke、分组、卡片、连接和历史
- 本地保存、导入导出
- OCR、后端、账号、云同步
- Glow、Particle 等视觉效果

## 隐私边界

当前版本不会请求摄像头权限，不采集、保存或上传摄像头画面，也不包含任何 API 密钥或外部服务配置。
