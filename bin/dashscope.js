#!/usr/bin/env node

import readline from 'readline/promises';

import chalk from 'chalk';
import { request, readAsSSE } from 'httpx';
import inquirer from 'inquirer';

import { loadConfig, saveConfig } from '../lib/config.js';

const completions = '.set_model .set_api_key .clean_context .exit .set_verbose .help'.split(' ');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: (line) => {
    const hits = completions.filter((c) => c.startsWith(line));
    // Show all completions if none found
    return [hits.length ? hits : completions, line];
  }
});

async function query(messages, ctx) {
  const response = await request('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'Authorization': `Bearer ${ctx.api_key}`
    },
    readTimeout: 100000,
    data: JSON.stringify({
      model: ctx.model,
      input: {
        messages: messages
      }
    })
  });

  let current = '';
  let lastEvent;
  for await (const event of readAsSSE(response)) {
    lastEvent = event;
    const data = JSON.parse(event.data);
    if (event.event === 'error') {
      throw new Error(`Gets error from dashscope. ${event.data}`);
    }
    const text = data.output.text;
    process.stdout.write(text.substring(current.length));
    current = text;
    if (data.output.finish_reason === 'stop') {
      process.stdout.write('\n');
    }
  }

  return lastEvent;
}

async function question(prompt) {
  const answers = await inquirer.prompt([
    {
      name: 'question',
      ...prompt
    }
  ]);
  return answers.question.trim();
}

const config = await loadConfig();
if (!config.api_key) {
  const apikey = await question({
    message: 'Please input your dashscope api key(you can visit https://help.aliyun.com/zh/dashscope/developer-reference/activate-dashscope-and-create-an-api-key to get api key):'
  });
  config.api_key = apikey.trim();
  await saveConfig(config);
}

async function chooseModel() {
  console.log('The billing information for the model can be found at: <https://dashscope.console.aliyun.com/billing>.');
  const model = await question({
    type: 'list',
    message: 'Please select your model:',
    choices: [
      'qwen-turbo',
      'qwen-plus',
      'qwen-max',
      'qwen-max-1201',
      'qwen-max-longcontext',
      new inquirer.Separator(),
      'llama2-7b-chat-v2',
      'llama2-13b-chat-v2',
      new inquirer.Separator(),
      'qwen1.5-72b-chat',
      'qwen1.5-14b-chat',
      'qwen1.5-7b-chat',
      'qwen-72b-chat',
      'qwen-14b-chat',
      'qwen-7b-chat',
      'qwen-1.8b-longcontext-chat',
      'qwen-1.8b-chat',
      new inquirer.Separator(),
      'baichuan2-7b-chat-v1',
      'baichuan2-13b-chat-v1',
      new inquirer.Separator(),
      'chatglm3-6b',
      'sanle-v1',
      'ziya-llama-13b-v1',
      'dolly-12b-v2',
      'belle-llama-13b-2m-v1',
      'moss-moon-003-sft-v1',
      'chatyuan-large-v2',
      'billa-7b-sft-v1'
    ],
    default: config.model || 'qwen-turbo'
  });

  if (model) {
    config.model = model;
    await saveConfig(config);
  }
}

if (!config.model) {
  await chooseModel();
}

console.log(`Current model: ${config.model}. type \`.set_model\` to change it.`);
console.log('The billing information for the model can be found at: <https://dashscope.console.aliyun.com/billing>.');

const messages = [];

while (true) {
  const answer = await rl.question(chalk.bold('What is your query: ') + '(type .help to get helps) \n> ');
  // 因为inquery 也在使用 readline，而 stdout 是全局的，所以为了不互相影响，使用后，先暂停。
  rl.pause();
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  if (answer === '.set_api_key') {
    const apikey = await question({
      message: 'Please input your new dashscope api key:'
    });

    if (apikey) {
      config.api_key = apikey.trim();
      await saveConfig(config);
    }
    continue;
  }

  if (answer === '.set_model') {
    await chooseModel();
    console.log(`The model is be switched to ${config.model} now.`);

    continue;
  }

  if (answer === '.clean_context') {
    messages.length = 0;
    console.log(`The context is cleaned now. Current messages length: ${messages.length}`);
    continue;
  }

  if (answer === '.exit') {
    console.log('Quiting dashcope.');
    process.exit(0);
  }

  if (answer === '.help') {
    console.log('.set_model         choose model');
    console.log('.set_api_key       set api key');
    console.log('.clean_context     clean context');
    console.log('.exit              exit the program');
    console.log('.set_verbose       turn on/off verbose mode');
    console.log('.help              show this help');
    continue;
  }

  if (answer === '.set_verbose') {
    const verbose = await question({
      type: 'list',
      message: 'Turn on/off verbose:',
      choices: [
        'true',
        'false'
      ],
      default: config.verbose || false
    });

    config.verbose = verbose === 'true';
    await saveConfig(config);
    console.log(`The verbose mode is turned ${config.verbose ? 'on' : 'off'} now.`);
    continue;
  }

  if (!answer) {
    console.log('query can not be empty! please re-type it.');
    continue;
  }

  messages.push({
    role: 'user',
    content: answer
  });

  const event = await query(messages, {
    api_key: config.api_key,
    model: config.model
  });

  const data = JSON.parse(event.data);

  messages.push({
    role: 'assistant',
    content: data.output.text
  });

  if (config.verbose === true) {
    const usage = data.usage;
    // 部分模型未返回 total_tokens 属性
    const total_tokens = usage.total_tokens || (usage.input_tokens + usage.output_tokens);
    console.log(`[Verbose] Used tokens: ${total_tokens}, input: ${usage.input_tokens}, output: ${usage.output_tokens}. ${data.request_id}`);
    console.log(`[Verbose] current context message count: ${messages.length}`);
  }
}
