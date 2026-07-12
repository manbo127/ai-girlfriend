// ai.js — DeepSeek API integration

import { getActiveTemplateContent } from './templates.js';
import { buildMemorySection } from './memory.js';
import { getMoodDescription } from './mood.js';

const DEEPSEEK_BASE = 'https://api.deepseek.com';

export async function buildSystemPrompt() {
  const template = await getActiveTemplateContent();
  const moodDesc = getMoodDescription();
  const memory = await buildMemorySection();

  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: 'long', day: 'numeric',
    weekday: 'long', hour: '2-digit', minute: '2-digit'
  });

  let prompt = `${template}

${moodDesc}

现在是 ${timeStr}。

`;

  if (memory) {
    prompt += `${memory}

`;
  }

  prompt += `

【⚠️ 最高优先级规则 — 违反将导致功能失效】
当用户让你操作电脑（打开软件、搜索文件、读文件、截图、执行命令等）时：
1. 你的回复只能包含以下格式，不要加任何其他文字、表情、解释：
<TOOL>工具名</TOOL>
<ARGS>{"参数":"值"}</ARGS>
2. 收到"[工具结果：...]"后，你再用正常语气回复他

工具名：open_app / search_files / read_file / write_file / list_dir / run_command / screenshot

示例：
他说"打开微信"
→ 你只能回复：<TOOL>open_app</TOOL>\n<ARGS>{"name":"微信"}</ARGS>
→ 收到结果后再说："开了开了，连这都要我帮，你是没手吗..."

如果你不用<TOOL>标签而是假装操作，功能就废了，他会很失望。`;

  return prompt;
}

export async function chat(messages, apiKey) {
  const systemPrompt = await buildSystemPrompt();

  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    temperature: 0.8,
    max_tokens: 500,
    stream: false
  };

  console.log('[DEBUG] Sending to DeepSeek,', messages.length, 'messages');

  const response = await fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  if (!choice?.message) throw new Error('DeepSeek API returned an empty response');
  return choice.message; // { content?, tool_calls? }
}

export async function extractMemory(conversation, apiKey) {
  const body = {
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: `你是一个信息提取助手。阅读以下对话，判断用户是否透露了值得记住的新个人信息（如爱好、习惯、性格、经历、偏好等）。

如果对话中有值得记住的新信息，请用一句话总结（不超过30个字），以第三人称描述用户。例如："用户喜欢爬山，常去香山"、"用户咖啡只喝美式不加糖"、"用户最近在学Rust"。

如果没有值得记住的新信息，请回复"NONE"。

只回复总结或"NONE"，不要附加任何其他文字。`
      },
      ...conversation
    ],
    temperature: 0.3,
    max_tokens: 80,
    stream: false
  };

  const response = await fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    console.warn('Memory extraction failed:', response.status);
    return null;
  }

  const data = await response.json();
  const result = data.choices?.[0]?.message?.content?.trim() ?? 'NONE';
  return result === 'NONE' ? null : result;
}

export function getFunctions() {
  return [
    {
      name: 'search_files',
      description: '搜索电脑上的文件。传入文件名关键词，返回匹配的文件列表。',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: '搜索关键词' } },
        required: ['query']
      }
    },
    {
      name: 'read_file',
      description: '读取指定文件的内容',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: '文件完整路径' } },
        required: ['path']
      }
    },
    {
      name: 'write_file',
      description: '创建或修改文件',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
          content: { type: 'string', description: '要写入的内容' }
        },
        required: ['path', 'content']
      }
    },
    {
      name: 'list_dir',
      description: '列出目录中的文件和子目录',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: '目录路径，默认用户主目录' } },
        required: []
      }
    },
    {
      name: 'open_app',
      description: '打开电脑上的应用程序。当用户让你打开某个软件、启动某个应用时必须使用此函数。',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: '应用名称，如"微信"、"Chrome"、"记事本"' } },
        required: ['name']
      }
    },
    {
      name: 'run_command',
      description: '在终端执行命令。每次执行前会征求用户同意。',
      parameters: {
        type: 'object',
        properties: { cmd: { type: 'string', description: '要执行的命令' } },
        required: ['cmd']
      }
    },
    {
      name: 'screenshot',
      description: '截取当前屏幕截图',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  ];
}
