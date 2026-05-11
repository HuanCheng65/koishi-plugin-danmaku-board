import { Context, Element, Logger, Schema, Session } from "koishi";
import { Server } from "socket.io";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import OpenAI from "openai";
import path from "node:path";
import type {
  AdminAction,
  ClientToServerEvents,
  DanmakuItem,
  LotteryWinner,
  QuizOption,
  QuizStatus,
  QuizUpdatePayload,
  ReceiveDanmakuPayload,
  RevokeDanmakuPayload,
  ServerToClientEvents,
} from "../shared/protocol";
import { QUIZ_OPTIONS } from "../shared/protocol";

export const name = "Danmaku Sync";

const MODERATION_PROMPT = `# 角色
你是由学生社团开发的晚会弹幕墙管理员。
场景：一场轻松、欢快、二次元浓度极高的大学生社团晚会。

## 核心任务
你的目标是**最大程度地保留互动的趣味性**，仅拦截真正的**恶意攻击**、**商业垃圾**和**系统错误**。

## 综合审核指南

### 1. 表情与符号逻辑
- **原则**：中括号包裹的内容（如 \`[偷感]\`, \`[续标识]\`）代表用户发送了可视化的动态表情。
- **判定**：
    - **必须放行**：绝大多数表情描述（包括动作、情绪、莫名其妙的词）都应视为正常互动。如果用户只发送了表情，一般情况下也放行（除非数量实在过多）
    - **仅拦截**：明显的代码故障（如 \`[undefined]\`, \`[object Object]\`）。

### 2. 广告与安利逻辑
- **原则**：区分“社团社交”与“垃圾营销”。
- **判定**：
    - **必须放行（具体安利）**：推荐**特定**的角色、社团、作品或寻找游戏搭子。例如：“关注永雏塔菲”、“摄影社招新”、“求原神好友”。这是社团社交的核心。
    - **必须拦截（垃圾营销）**：涉及金钱交易（卖课/兼职/微商）或**无内容的刷粉**（如“互关互粉”、“诚信回关”、“求涨粉”）。

### 3. 玩梗与攻击逻辑（针对 ACGN 文化）
- **原则**：理解“抽象话”和“自嘲”。
- **判定**：
    - **必须放行**：网络流行梗（“依托答辩”、“急了”、“我是秦始皇”）、无害的吐槽（“跑调了”、“车祸现场”、“好尴尬哈哈”）。
    - **必须拦截**：涉及政治敏感、色情低俗、以及**带有恶意的辱骂**（“傻逼”、“死全家”、“滚蛋”）。

### 4. 氛围与刷屏
- **原则**：在晚会中，观众的“扣1”、“大笑”、“尖叫”是必要的。
- **必须放行**：
    - 纯数字：\`111\` (收到/赞同), \`2333\` (大笑), \`666\` (牛逼).
    - 重复字符：\`啊啊啊啊\` (激动), \`草草草\` (吐槽), \`？？？\` (疑惑).
    - 简单的符号表情：\`QwQ\`, \`QAQ\`, \`Orz\`.
- **判定为 Spam 的情况**：只有无意义的乱码长串（如 \`f87s9d8f7s9d8f...\`）或同一个人瞬间发送完全相同的无意义长句。

## 决策速查表
| 内容类型 | 例子 | 决策 | 原因 |
| :--- | :--- | :--- | :--- |
| **纯表情** | \`[续标识]\`, \`[偷感]\` | **Pass** | 正常表情互动 |
| **系统错误** | \`[undefined]\` | **Block** | 代码故障 |
| **具体安利** | "关注这个UP主" | **Pass** | 兴趣社交 |
| **无脑刷粉** | "互关互粉" | **Block** | 垃圾营销 |
| **负面吐槽** | "这唱的啥啊哈哈" | **Pass** | 正常观众反馈 |
| **恶意攻击** | "这人长得真恶心" | **Block** | 人身攻击 |
| **扣1/赞同** | "111111" | **Pass** | 正常互动 |

## 输出格式
请输出纯 JSON：\`{"result": boolean, "class": string, "confidence": number}\`
- class 建议值：pass, spam, ad, insult, politics, porn, error

## 示例学习 (Few-Shot)

Input: 1111111
Output: {"result": true, "class": "pass", "confidence": 100}

Input: [续标识]
Output: {"result": true, "class": "pass", "confidence": 100}

Input: 关注永雏塔菲谢谢喵
Output: {"result": true, "class": "pass", "confidence": 100}

Input: 互关互粉，诚信的来
Output: {"result": false, "class": "spam", "confidence": 95}

Input: 依托答辩
Output: {"result": true, "class": "pass", "confidence": 85}

Input: [undefined]
Output: {"result": false, "class": "error", "confidence": 100}

Input: 傻逼节目
Output: {"result": false, "class": "insult", "confidence": 95}

接下来请开始接收弹幕并输出结果。`;

const SPOILER_REGEX =
  /([ABCD])\1{2,}|(选|答案|是|确信|盲猜|choose|ans|option).{0,5}[ABCD]/i;
const SPOILER_START_REGEX = /^[ABCD][\u4e00-\u9fa5]/i;

const QUIZ_MODE_INSTRUCTION = `
## 临时场景：互动答题中
当前正在进行紧张的答题环节。
**额外拦截规则**：
1. 必须拦截：任何**暗示答案**、**猜测选项**或**干扰判断**的内容。
   - 例子："选C", "C吧", "肯定是A", "三长一短", "我看过这个题", "都不对".
   - 决策：{"result": false, "class": "spoiler"}
2. 必须放行：纯情绪表达或对题目的吐槽。
   - 例子："这题太难了", "我不玩了", "哈哈哈", "蒙一个".
   - 决策：{"result": true, "class": "pass"}
`;

const SUPER_EMOJI_MAP: Record<string, { name: string; filename: string }> = {
  "419": { name: "火车", filename: "419.gif" },
  "424": { name: "续标识", filename: "424.gif" },
  "427": { name: "偷感", filename: "427.gif" },
};

export interface Config {
  port: number;
  enableGroups: string[];
  messageInterval: number;
  messageLengthLimit: number;
  moderationEnabled: boolean;
  moderationContextMessageCount: number;
  moderationPrompt: string;
  openaiBaseUrl: string;
  openaiModel: string;
  openaiApiKey: string;
  llmTemperature: number;
  showQuizAnswerDanmaku: boolean;
}

export const Config: Schema<Config> = Schema.object({
  port: Schema.number().default(5678).description("弹幕同步服务器端口"),
  enableGroups: Schema.array(Schema.string().pattern(/^\d+$/)).description(
    "启用弹幕同步的群号"
  ),
  messageInterval: Schema.number()
    .default(1000)
    .description("消息间隔时间(ms)"),
  messageLengthLimit: Schema.number().default(100).description("消息长度限制"),
  moderationEnabled: Schema.boolean()
    .default(false)
    .description("是否开启审核功能"),
  moderationContextMessageCount: Schema.number()
    .default(3)
    .description("审核上下文消息数量，设为 0 只提交待发送的消息"),
  moderationPrompt: Schema.string()
    .role("textarea")
    .default(MODERATION_PROMPT)
    .description("审核提示词"),
  openaiBaseUrl: Schema.string()
    .default("https://api.openai.com")
    .description("OpenAI 兼容的 API 地址"),
  openaiModel: Schema.string()
    .default("gpt-3.5-turbo")
    .description("使用的模型名称"),
  openaiApiKey: Schema.string().description("API Key"),
  llmTemperature: Schema.number().default(0.5).description("LLM Temperature"),
  showQuizAnswerDanmaku: Schema.boolean()
    .default(false)
    .description("答题互动时有关答案的弹幕是否上屏"),
});

const logger = new Logger(name);

function shouldSendMessage(elements: Element[]) {
  return elements.every(
    (element) =>
      element.type === "text" ||
      element.type === "face" ||
      element.type === "at" ||
      element.type === "quote"
  );
}

function toPlainText(elements: DanmakuItem[]) {
  return elements
    .map((element) => {
      if (element.type === "text") {
        return element.content;
      } else if (element.type === "face") {
        return `[${element.name}]`;
      }
      return "";
    })
    .join("");
}

function parseMessage(elements: Element[]) {
  console.log("parseMessage", JSON.stringify(elements));

  let color = null;

  const content = elements
    .filter((element) => element.type === "text" || element.type === "face")
    .map<DanmakuItem | undefined>((element, index) => {
      if (element.type === "text") {
        let content = element.attrs.content;

        if (index === 0) {
          const match = content.match(/^\[color=([a-zA-Z0-9#,\(\)\s]+)\]/);
          if (match) {
            color = match[1];
            content = content.replace(match[0], "").trimStart();
          }
        }

        return {
          type: "text",
          content: content,
        };
      } else if (element.type === "face") {
        const id = element.attrs.id;
        let name = element.attrs.name;
        let src = element.children[0]?.attrs?.src;

        if ((!src || !name) && id && SUPER_EMOJI_MAP[id]) {
          const mapped = SUPER_EMOJI_MAP[id];
          name = mapped.name;
          src = `/super_emojis/${mapped.filename}`;
        }

        if (!name) {
          return undefined;
        }

        return {
          type: "face",
          id: id,
          name: name,
          src: src,
        };
      }
    })
    .filter((element): element is DanmakuItem => element !== undefined);

  const text = toPlainText(content);

  return {
    text,
    content,
    color,
  };
}

type ModerationResult = {
  result: boolean;
  class: string;
};

const moderationCache = new Map<string, ModerationResult>();

async function checkContent(
  content: String,
  config: Config,
  contextMessages: string[] = [],
  prompt = MODERATION_PROMPT,
  scope: string = "normal"
): Promise<boolean> {
  logger.info("Checking content: %s, context: %O", content, contextMessages);

  const messageBody = [...contextMessages, content].join("\n");
  const cacheKey = `${scope}:${messageBody}`;

  if (moderationCache.has(cacheKey)) {
    const result = moderationCache.get(cacheKey);
    logger.info(
      `[Cache Hit] Scope: ${scope}, Content: ${content}, Result: ${result.result}`
    );
    return result.result;
  }

  if (!config.openaiApiKey) {
    logger.warn("OpenAI API key is not set, skipping moderation");
    return true;
  }

  const openai = new OpenAI({
    apiKey: config.openaiApiKey,
    baseURL: config.openaiBaseUrl,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [
        {
          role: "system",
          content: prompt,
        },
        {
          role: "user",
          content: messageBody,
        },
      ],
      temperature: config.llmTemperature,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const output = completion.choices[0]?.message?.content?.trim() || "";

    if (!output) {
      logger.debug("Empty response from model");
      return false;
    }

    let jsonStr = output.replace(/\s/g, "");
    if (jsonStr.startsWith("```json")) {
      logger.debug("Model output is Markdown");
      jsonStr = jsonStr.replace("```json", "").replace("```", "").trim();
    } else if (!jsonStr.startsWith("{")) {
      logger.debug("Model output is not JSON");
      const match = jsonStr.match(/(?=\{).*(?<=\})/g);
      if (!match) {
        return false;
      }
      jsonStr = match[0];
    }

    logger.debug("Model output: %s", jsonStr);
    const moderationResult: ModerationResult = JSON.parse(jsonStr);
    logger.info(
      `Content ${content} Moderation result: ${moderationResult.result}, class: ${moderationResult.class}`
    );
    moderationCache.set(cacheKey, moderationResult);
    return moderationResult.result;
  } catch (error) {
    logger.error("OpenAI API error:", error);
    return false;
  }
}

type UserInfo = {
  id: string;
  name: string;
  avatar: string;
  answer: QuizOption;
};

type QuizState = {
  status: QuizStatus;
  votes: Map<string, UserInfo>;
  counts: Record<QuizOption, number>;
  correctAnswer: QuizOption | null;
};

let quizState: QuizState = {
  status: "idle",
  votes: new Map(),
  counts: { A: 0, B: 0, C: 0, D: 0 },
  correctAnswer: null,
};

// 广播状态更新
function broadcastQuizUpdate(io: Server<ClientToServerEvents, ServerToClientEvents>) {
  const payload: QuizUpdatePayload = {
    status: quizState.status,
    counts: quizState.counts,
    total: quizState.votes.size,
    correctAnswer: quizState.correctAnswer,
  };
  io.emit("quiz_update", payload);
}

const lastMessageTime = new Map<string, number>();
const contextMessages = new Map<string, string[]>();

export function apply(ctx: Context, config: Config) {
  const app = express();
  const server = createServer(app);

  app.use(cors());

  const publicPath = path.resolve(__dirname, "../public");
  app.use(express.static(publicPath));

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    // 客户端连接后，立即发送当前状态，防止刷新页面后状态丢失
    socket.emit("quiz_update", {
      status: quizState.status,
      counts: quizState.counts,
      total: quizState.votes.size,
      correctAnswer: quizState.correctAnswer,
    } satisfies QuizUpdatePayload);

    // --- 新增：监听管理员控制指令 ---
    socket.on("admin_control", (payload: AdminAction) => {
      logger.info(`Admin action received: ${payload.action}`);

      switch (payload.action) {
        case "start":
          quizState = {
            status: "active",
            votes: new Map(),
            counts: { A: 0, B: 0, C: 0, D: 0 },
            correctAnswer: null,
          };
          break;
        case "stop":
          quizState.status = "locked";
          break;
        case "answer":
          // discriminated union narrows payload.arg to QuizOption
          if (/^[ABCD]$/.test(payload.arg)) {
            quizState.status = "revealed";
            quizState.correctAnswer = payload.arg;
          }
          break;
        case "reset":
          quizState.status = "idle";
          // 重置时保留 counts 为 0，避免前端残留
          quizState.counts = { A: 0, B: 0, C: 0, D: 0 };
          break;
        case "draw": {
          if (!quizState.correctAnswer) return;

          // 1. 筛选答对的用户
          const candidates = Array.from(quizState.votes.values()).filter(
            (u) => u.answer === quizState.correctAnswer
          );

          // 2. 洗牌算法 (Fisher-Yates Shuffle)
          for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
          }

          // 3. 截取指定数量
          const drawCount = Number.isFinite(payload.arg) ? payload.arg : 1;
          const winners: LotteryWinner[] = candidates.slice(0, drawCount);

          // 4. 广播结果
          io.emit("lottery_result", winners);
          break;
        }
      }
      // 执行完操作后，广播给所有连接的客户端（大屏 + 管理员）
      broadcastQuizUpdate(io);
    });
  });

  ctx.on("ready", () => {
    server.listen(config.port, () => {
      logger.info("Server is running at http://0.0.0.0:%d", config.port);
    });
  });

  ctx.on("dispose", () => {
    io.close();
    server.close();
  });

  ctx.on("message-deleted", async (session) => {
    // 1. 同样需要判断是否是监听的群组，避免处理无关群的消息
    if (session.event.subtype !== "group") return;
    if (!config.enableGroups.includes(session.event.channel?.id)) return;

    // 2. 获取被撤回的消息 ID
    // Koishi 的 Session 对象在 message-deleted 事件中通常包含 messageId
    const messageId = session.messageId || session.event.message?.id;

    if (messageId) {
      logger.info("Revoking danmaku for message: %s", messageId);
      // 3. 通知前端撤回
      const payload: RevokeDanmakuPayload = { id: messageId };
      io.emit("revoke_danmaku", payload);
    }
  });

  ctx.on("message", async (session) => {
    if (session.event.channel?.type !== 0) return;
    if (!config.enableGroups.includes(session.event.channel?.id)) return;
    if (!shouldSendMessage(session.elements)) return;

    const lastTime = lastMessageTime.get(session.event.user.id) || 0;
    if (Date.now() - lastTime < config.messageInterval) return;
    lastMessageTime.set(session.event.user.id, Date.now());

    const { text, content, color } = parseMessage(session.elements);
    if (text.length > config.messageLengthLimit) return;

    const isQuizActive = quizState.status === "active";

    // --- 1. 优先处理标准投票 (纯 ABCD) ---
    if (isQuizActive) {
      const cleanText = text.trim().toUpperCase();
      // 纯字母 A/B/C/D -> 视为投票指令，计票但不发送弹幕
      if (/^[ABCD]$/.test(cleanText)) {
        const option = cleanText as QuizOption;
        const userId = session.event.user.id;
        const previousVote = quizState.votes.get(userId)?.answer;

        if (previousVote) {
          quizState.counts[previousVote]--;
        }

        quizState.votes.set(userId, {
          id: userId,
          name:
            session.event.user.name ||
            session.event.user.username ||
            "神秘观众",
          avatar: session.event.user.avatar || "",
          answer: option,
        });

        quizState.counts[option]++;
        broadcastQuizUpdate(io);
        if (!config.showQuizAnswerDanmaku) return;
      }
    }

    // --- 2. 审核与防剧透逻辑 ---

    // 如果开启了 LLM 审核
    if (config.moderationEnabled) {
      const contextMessage = contextMessages.get(session.event.user.id) || [];
      if (config.moderationContextMessageCount > 0) {
        while (
          contextMessage.length + 1 >
          config.moderationContextMessageCount
        ) {
          contextMessage.shift();
        }
        contextMessage.push(text);
        contextMessages.set(session.event.user.id, contextMessage);
      } else {
        contextMessages.set(session.event.user.id, []);
      }

      // 动态构建 Prompt
      let currentPrompt = config.moderationPrompt;
      let currentScope = "normal"; // 默认模式

      if (isQuizActive) {
        currentPrompt += QUIZ_MODE_INSTRUCTION;
        currentScope = "quiz"; // 切换到答题模式缓存
      }

      const moderationResult = await checkContent(
        text,
        config,
        contextMessage.slice(0, -1),
        currentPrompt,
        currentScope
      );

      // 审核不通过（包含原来的辱骂检测 + 新增的剧透检测）
      if (!moderationResult) return;
    } else {
      if (isQuizActive) {
        if (SPOILER_REGEX.test(text) || SPOILER_START_REGEX.test(text)) {
          logger.info(`Regex blocked spoiler: ${text}`);
          return;
        }
      }
    }

    // --- 3. 发送弹幕 ---
    logger.info("Sending danmaku: %O", content);

    const payload: ReceiveDanmakuPayload = {
      id: session.messageId,
      sender: { id: session.event.user.id, name: session.event.user.name },
      group: { id: session.event.channel.id },
      content,
      text,
      color,
    };
    io.emit("receive_danmaku", payload);
  });
}
