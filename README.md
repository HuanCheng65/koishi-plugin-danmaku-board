# koishi-plugin-danmaku-sync-qq-group

[![npm](https://img.shields.io/npm/v/koishi-plugin-danmaku-sync-qq-group?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-danmaku-sync-qq-group)

实时同步 QQ 群消息的弹幕板，适用于晚会、活动等场景。

## 功能特点

- 🚀 实时同步：QQ 群消息实时同步，支持多群
- 🛡️ 智能审核：支持接入任意 OpenAI 兼容的大模型进行弹幕审核，确保展示内容的安全性
- 🎨 支持彩色弹幕：可以发送带颜色的弹幕
- 😊 支持表情：支持 QQ 表情的同步显示
- ⚡ 高性能：基于 Socket.IO 的实时通信

## 安装

```bash
npm install koishi-plugin-danmaku-sync-qq-group
```

## 配置项

```yaml
port: 5678 # 弹幕同步服务器端口
enableGroups: # 启用弹幕同步的群号列表
  - "123456789"
  - "987654321"
messageInterval: 1000 # 消息间隔时间(ms)
messageLengthLimit: 100 # 消息长度限制
# 以下为可选的内容审核配置
moderationEnabled: true # 是否开启审核功能
moderationContextMessageCount: 3 # 滑动窗口大小，即每次审核时提交给 LLM 的历史消息数量，设为 0 则只提交当前消息
moderationPrompt: ... # 审核提示词（可选，有默认值）
openaiBaseUrl: https://api.openai.com # OpenAI API 地址，可配置为任意兼容的大模型接口
openaiModel: gpt-3.5-turbo # 使用的模型名称
openaiApiKey: your-api-key # API Key（仅在开启审核功能时需要）
```

## 使用方法

1. 安装插件后，配置必要的参数：
   - 必选：`enableGroups`（启用的群号）
   - 可选：如需开启内容审核，则配置 `moderationEnabled` 为 true，并配置 `openaiApiKey` 等审核相关参数
2. 启动 Koishi 后，插件会自动在配置的端口启动弹幕服务器
3. 访问 `http://your-server:port` 即可看到弹幕板
4. 在已启用的 QQ 群中发送消息，消息会自动同步到弹幕板中

你可以使用 OBS Studio 之类的软件将弹幕板叠加到画面中。

### 发送彩色弹幕

在消息开头使用 `[color=颜色值]` 来发送彩色弹幕，例如：

- `[color=red]这是红色弹幕`
- `[color=#FF5733]这是自定义颜色的弹幕`

## 内容审核

插件支持使用任意 OpenAI 兼容的大模型进行内容审核。通过配置 `moderationEnabled` 为 true 即可开启审核功能。

当开启审核功能时，可以通过自定义 `moderationPrompt` 来调整审核规则。默认的审核规则可以过滤以下类型的内容：

- 色情内容或性骚扰
- 政治或社会敏感内容
- 广告内容
- 违法内容
- 赌博、诈骗内容
- 人身攻击、地域歧视等
- 对活动或表演的负面评价
- 其他不适宜的内容

`moderationContextMessageCount` 参数用于控制审核时的上下文窗口大小。例如，当设置为 3 时，每次审核都会将当前消息及其前 2 条历史消息一起提交给 LLM 进行审核，这有助于 LLM 更好地理解消息的语境。设置为 0 则表示仅提交当前消息进行审核。

## 注意事项

1. 确保配置的端口号未被其他程序占用
2. 如需开启内容审核功能，需要配置可用的 API 和 API Key
3. 消息发送频率受 `messageInterval` 限制
4. 消息长度受 `messageLengthLimit` 限制
5. 只有在 `enableGroups` 中配置的群聊消息才会被同步

## 许可证

MIT License
