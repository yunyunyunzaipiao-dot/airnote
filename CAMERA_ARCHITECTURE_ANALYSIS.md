# AirNote 摄像头与手势链路架构分析

> 分析范围：冻结功能版本（commit `fdaf26d`）
> 分析日期：2026-07-25
> 约束：仅分析，不修改任何代码

---

## 一、摄像头入口（用户触发点）

### 1.1 手势模式切换入口

| 入口位置 | 文件 | 行号 | 行为 |
|---------|------|------|------|
| **左侧工具栏手势按钮** | `src/components/LeftToolbar.tsx` | 100-108 | 点击切换 `mouse` ↔ `gesture`，调用 `onInputModeChange` |
| **CameraPreview 面板手势按钮** | `src/components/CameraPreview.tsx` | 77-93 | 若已校准直接切换手势；未校准则触发 `onGestureRequest` |
| **TopBar 模式显示** | `src/components/TopBar.tsx` | 102-105 | 仅展示当前模式状态（鼠标/手势），非交互入口 |

### 1.2 摄像头启用入口

| 入口位置 | 文件 | 行号 | 行为 |
|---------|------|------|------|
| **CameraPreview 启用按钮** | `src/components/CameraPreview.tsx` | 97-102 | 点击调用 `onEnable` → 弹出 `CameraConsentDialog` |
| **CameraConsentDialog 确认** | `src/pages/WorkspacePage.tsx` | 209-217 | 确认后调用 `runtime.enableCamera()` |
| **WorkspacePage 拦截逻辑** | `src/pages/WorkspacePage.tsx` | 76-83 | 若手势模式请求时摄像头未运行，自动弹出同意对话框 |

### 1.3 关键流程分支

```
用户点击手势模式（LeftToolbar/CameraPreview）
    │
    ├─► 摄像头已在运行（cameraStatus === 'running'）
    │       └─► 直接调用 setInputMode('gesture')
    │
    └─► 摄像头未运行
            └─► 弹出 CameraConsentDialog
                    └─► 用户确认 → enableCamera()
```

---

## 二、video 元素位置

### 2.1 唯一视频元素

整个应用中**仅存在一个** `<video>` 元素：

- **文件**：`src/components/CameraPreview.tsx`
- **行号**：第 52 行
- **JSX**：
  ```tsx
  <video ref={videoRef} muted playsInline aria-label="镜像摄像头预览" />
  ```

### 2.2 视频元素属性

| 属性 | 值 | 说明 |
|------|-----|------|
| `ref` | `videoRef`（来自 props） | 绑定到 useAirNoteRuntime 创建的 ref |
| `muted` | — | 静音（必需，避免某些浏览器策略阻止播放） |
| `playsInline` | — | iOS Safari 内联播放，不进入全屏 |
| `aria-label` | `"镜像摄像头预览"` | 无障碍标签 |

### 2.3 视觉包装

视频元素被包裹在：

```
<section className="camera-panel-mini">     ← 摄像头面板容器
  <div className="camera-preview-mini">      ← 预览区域（控制宽高比）
    <video ref={videoRef} ... />              ← 真实视频元素
    {!isRunning ? <div className="camera-preview-mini__empty"> ... </div> : null}
  </div>
  ...
</section>
```

---

## 三、ref 传递流程

### 3.1 完整传递链

```
useAirNoteRuntime()                          CameraPreview.tsx
├─ videoRef = useRef<HTMLVideoElement>(null) ─────┐
│                                                   │
│  return { ..., videoRef, ... }                    │
│       │                                           │
│       ▼                                           ▼
│  WorkspacePage.tsx                           <video ref={videoRef} />
│  const runtime = useAirNoteRuntime()
│       │
│       ▼
│  <CameraPreview videoRef={runtime.videoRef} ... />
│
├─ streamRef = useRef<MediaStream | null>(null)     ← 存储 getUserMedia 返回的流
├─ trackerRef = useRef<HandTracker | null>(null)    ← 存储 MediaPipe HandLandmarker 实例
└─ loopRef = useRef<VideoFrameLoop | null>(null)    ← 存储视频帧循环控制器
```

### 3.2 ref 在 Hook 中的使用位置

| ref | 定义位置 | 主要使用位置 | 用途 |
|-----|---------|------------|------|
| `videoRef` | `useAirNoteRuntime.ts:141` | `enableCamera()` (L413), `startLoop()` (L258), `stopRuntime()` (L367) | 绑定视频流、帧循环读取、清理 |
| `streamRef` | `useAirNoteRuntime.ts:142` | `enableCamera()` (L412), `stopRuntime()` (L363), visibility change (L975) | 存储/停止 MediaStream |
| `trackerRef` | `useAirNoteRuntime.ts:143` | `enableCamera()` (L441), `startLoop()` (L259), `stopRuntime()` (L361) | 存储/关闭 HandTracker |
| `loopRef` | `useAirNoteRuntime.ts:144` | `startLoop()` (L262), `stopLoop()` (L251), visibility change (L974) | 控制帧循环启停 |

---

## 四、手势启动完整流程

### 4.1 阶段一：用户触发 → 摄像头启动

```
用户操作（点击手势模式 / 点击启用摄像头）
    │
    ▼
WorkspacePage.setInputMode() / setShowCameraConsent(true)
    │
    ▼
CameraConsentDialog 确认 → runtime.enableCamera()
    │
    ▼
【useAirNoteRuntime.ts:383-478 enableCamera】
    │
    ├─ 1. stopRuntime(false)                    ← 清理之前的状态
    ├─ 2. 设置 cameraStatus = 'requesting'
    ├─ 3. requestCameraStream()                 ← 【camera.ts:12】
    │       └─ navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
    │              约束: { video: { width: 640, height: 480, frameRate: 30 }, audio: false }
    │
    ├─ 4. video.srcObject = stream
    ├─ 5. await video.play()
    ├─ 6. 设置 cameraStatus = 'loading-model'
    ├─ 7. createHandTracker()                   ← 【handTracker.ts:63】
    │       └─ FilesetResolver.forVisionTasks(wasmPath)
    │       └─ fetch hand_landmarker.task 模型文件
    │       └─ HandLandmarker.createFromOptions(...)
    │              delegate: 'CPU', runningMode: 'VIDEO', numHands: 1
    │
    ├─ 8. 设置 cameraStatus = 'running'
    └─ 9. 若有校准 → 自动 inputMode = 'gesture'
        若无校准 → calibration.phase = 'required'
```

### 4.2 阶段二：MediaPipe 开始检测（帧循环）

```
enableCamera() 成功后
    │
    ▼
startLoop()                                   ← 【useAirNoteRuntime.ts:257】
    │
    ▼
startVideoFrameLoop(video, onFrame)           ← 【videoFrameLoop.ts:5】
    │
    ├─ 优先使用 video.requestVideoFrameCallback(processFrame)
    └─ 回退使用 requestAnimationFrame(processFrame)
    │
    ▼
每帧回调 onFrame(timestamp):
    │
    ├─ tracker.detect(video, timestamp)       ← 【handTracker.ts:67】
    │       └─ handLandmarker.detectForVideo(video, timestamp)
    │       └─ 返回 21 个手部关键点 (landmarks)
    │
    ├─ calculatePinchRatio(landmarks)         ← 计算食指-拇指捏合比例
    │
    ├─ 若 inputMode === 'gesture' 且已校准:
    │       ├─ stepGestureMachine()           ← 手势状态机处理
    │       │       状态: IDLE → HOVER → DRAWING → PAUSED → TRACKING_LOST
    │       │       命令: START_STROKE / APPEND_POINT / END_STROKE
    │       │
    │       ├─ stepOpenPalmHold()             ← 张掌暂停检测
    │       │       张开手掌保持 0.8 秒 → 状态切换为 PAUSED
    │       │
    │       └─ rendererRef.handleGesture(cmd) ← 将手势命令转为笔画绘制
    │
    └─ publishDiagnostics(frame.inferenceMs)  ← 更新 FPS、推理耗时等 HUD 数据
```

### 4.3 阶段三：手势状态机 → 笔画输出

```
stepGestureMachine(machine, frame, pinchDownThreshold, pinchUpThreshold)
    │
    ├─ 检测捏合 (pinchRatio < pinchDownThreshold)
    │       └─ 触发 START_STROKE → 开始记录笔画
    │
    ├─ 持续追踪食指尖 (indexTip)
    │       └─ 触发 APPEND_POINT → 追加笔画点
    │
    ├─ 检测松开 (pinchRatio > pinchUpThreshold)
    │       └─ 触发 END_STROKE (reason: 'pinch-up') → 结束笔画
    │
    ├─ 手丢失 (landmarks === null)
    │       └─ 触发 END_STROKE (reason: 'tracking-lost')
    │
    └─ 帧间隔过大
            └─ 触发 END_STROKE (reason: 'frame-gap')
```

### 4.4 生命周期与清理

```
组件卸载 / 用户关闭摄像头 / 错误发生
    │
    ▼
stopRuntime()                                 ← 【useAirNoteRuntime.ts:359】
    ├─ stopLoop()                             ← 停止视频帧回调
    ├─ trackerRef.current?.close()            ← 释放 MediaPipe HandLandmarker
    ├─ stopCameraStream(streamRef.current)    ← 停止所有 MediaStreamTrack
    ├─ streamRef.current = null
    ├─ videoRef.current.srcObject = null      ← 断开视频源
    └─ 重置 gesture machine / open palm hold
```

### 4.5 页面可见性处理

```
document.visibilitychange
    ├─ hidden  → stopLoop()                   ← 后台时暂停检测，节省资源
    └─ visible → 若 tracker 和 stream 存在，startLoop() ← 恢复检测
```

---

## 五、关键文件职责一览

| 文件 | 职责 |
|------|------|
| `src/store/useAirNoteRuntime.ts` | **核心运行时 Hook**。管理所有 ref、状态机、摄像头启停、帧循环、手势处理、笔画提交。 |
| `src/camera/camera.ts` | **摄像头底层封装**。`getUserMedia` 调用、错误码映射、流设置读取。 |
| `src/handTracking/handTracker.ts` | **MediaPipe 封装**。加载 WASM + 模型，创建 `HandLandmarker`，提供 `detect()` API。 |
| `src/handTracking/videoFrameLoop.ts` | **视频帧调度器**。使用 `requestVideoFrameCallback` 或 RAF 驱动逐帧推理。 |
| `src/components/CameraPreview.tsx` | **视频元素 UI**。唯一 `<video>` 元素所在，提供启用/关闭/模式切换按钮。 |
| `src/components/GestureStatus.tsx` | **手势状态 HUD**。显示当前状态（IDLE/HOVER/DRAWING/PAUSED/TRACKING_LOST）。 |
| `src/components/LeftToolbar.tsx` | **工具栏**。包含手势模式切换按钮、张掌暂停开关。 |
| `src/components/CalibrationPanel.tsx` | **校准面板**。ROI 区域校准、捏合灵敏度校准 UI。 |
| `src/gesture/pinchStateMachine.ts` | **捏合状态机**。管理 HOVER/DRAWING 状态转换。 |
| `src/gesture/openPalmPause.ts` | **张掌暂停检测**。张开手掌保持计时器。 |
| `src/drawing/canvasRenderer.ts` | **笔画渲染器**。将手势命令转为 Canvas 2D 绘制。 |

---

## 六、与当前 Figma UI 版本可能的差异

> 注：以下差异基于代码中现有 UI 结构与设计规范 `docs/design/design-reference/` 的**潜在**不匹配点。设计参考图共 14 张，未逐一比对，仅标记架构层面的差异风险。

### 6.1 布局结构差异风险

| 当前代码结构 | 潜在差异 |
|-------------|---------|
| `CameraPreview` 是一个 **mini 面板**（`camera-panel-mini`、`camera-preview-mini`），嵌入在左侧浮动侧边栏中 | Figma 设计可能将摄像头预览放在**独立浮窗**、**顶部栏**或**全屏覆盖层**中 |
| `GestureStatus` 是**独立面板**，与 `CameraPreview` 并列于左侧边栏 | Figma 设计可能将状态指示器**合并到摄像头预览内部**或**顶部状态栏** |
| `CalibrationPanel` 位于**右侧浮动面板**（`floating-right`） | Figma 设计可能将校准流程做成**模态对话框**、** onboarding 步骤**或**覆盖在画布上的引导层** |
| 视频预览区域使用 **aspectRatio CSS** 动态适应摄像头分辨率 | Figma 设计可能有**固定尺寸**或**圆形/圆角裁剪**的预览样式 |

### 6.2 交互流程差异风险

| 当前代码流程 | 潜在差异 |
|-------------|---------|
| 摄像头启用需经过 **CameraConsentDialog** 弹窗确认 | Figma 设计可能采用**内联引导**、**首次使用提示气泡**而非模态对话框 |
| 手势模式切换分布在 **LeftToolbar** 和 **CameraPreview** 两个位置 | Figma 设计可能**只有一个统一入口**，或入口位置不同（如顶部栏） |
| 校准流程（ROI 4 点 + 捏合 3 次循环）在右侧面板**分步点击记录** | Figma 设计可能采用**自动检测校准**、**更少的步骤**或**可视化动画引导** |
| 错误提示通过 `StatusCenter` **底部/顶部消息条**弹出 | Figma 设计可能使用**内联错误状态**、**摄像头面板内红色提示** |

### 6.3 组件拆分差异风险

| 当前代码 | 潜在差异 |
|---------|---------|
| `CameraPreview` + `GestureStatus` + `CalibrationPanel` 是**三个独立组件** | Figma 设计可能将其**合并为一个复合组件**（如 "GestureHub"） |
| `TopBar` 中的模式显示是纯文本标签（`top-bar__mode-switch`） | Figma 设计可能使用**切换开关 (Toggle Switch)** 或**分段控制器 (Segmented Control)** |
| 视频元素是原生 `<video>`，无自定义控制条 | Figma 设计可能包含**自定义视频控制 UI**（如镜像翻转、分辨率显示） |

### 6.4 样式实现差异风险（基于 CLAUDE.md 设计规范）

根据项目指令，当前代码中的样式需严格对照 `docs/design/design-reference/`：

- **当前代码中仍存在** `camera-panel-mini`、`camera-preview-mini` 等命名，暗示早期 "mini" 设计风格
- **设计规范要求**：软阴影、大圆角、现代极简主义微悬浮设计
- **需要验证**：当前 `CameraPreview`、`GestureStatus`、`CalibrationPanel` 的 CSS class 是否已按设计图更新，还是遗留了旧版 "黑框/亮黄色线条" 风格

### 6.5 建议验证清单

若要将代码与设计图对齐，建议按以下顺序核对：

1. [ ] `CameraPreview.tsx` 中视频预览容器的尺寸、圆角、阴影是否与 Figma 一致
2. [ ] 手势模式切换按钮的**图标样式、激活状态、位置**是否与 Figma 一致
3. [ ] `GestureStatus` 的**脉冲动画、颜色状态、布局位置**是否与 Figma 一致
4. [ ] 校准面板的**步骤指示器、按钮文案、进度展示**是否与 Figma 一致
5. [ ] 摄像头启用/关闭按钮的**视觉反馈（如录制红点）**是否与 Figma 一致
6. [ ] 整体视频预览是**镜像翻转**还是**原始画面**（当前代码 `aria-label` 标明 "镜像"，但需确认 CSS `transform: scaleX(-1)` 是否已应用）

---

## 附录：状态机全貌

```
CameraStatus: idle → requesting → loading-model → running → stopped/error
                       ↑___________________________________________|

InputMode: mouse ↔ gesture
           （gesture 要求 cameraStatus === 'running' 且 calibration.phase === 'ready'）

CalibrationPhase: idle → required → roi(4步) → pinch(3循环) → review → ready

GestureMachineState: IDLE → HOVER → DRAWING → PAUSED → TRACKING_LOST → IDLE ...
```

---

*分析完成。未修改任何代码。*
