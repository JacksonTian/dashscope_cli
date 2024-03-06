#!/usr/bin/env node
import { homedir } from "os";
import path from "path";
import { access, readFile, writeFile, constants } from "fs/promises";

import { request, readAsSSE } from "httpx";
import ini from "ini";
import inquirer from 'inquirer';

async function loadConfig() {
    const rcPath = path.join(homedir(), '.dashscoperc');
    let content = '';
    try {
        await access(rcPath, constants.F_OK | constants.R_OK | constants.W_OK);
        content = await readFile(rcPath, 'utf8');
    } catch (ex) {
        // ignore when file not exits
    }
    return ini.parse(content);
}

async function saveConfig(config) {
    const rcPath = path.join(homedir(), '.dashscoperc');
    await writeFile(rcPath, ini.stringify(config));
}

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

if (!config.model) {
    const model = await question({
        type: 'list',
        message: 'Please select your model:',
        choices: [
            'qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-max-1201', 'qwen-max-longcontext'
        ]
    });
    if (model) {
        config.model = model;
        await saveConfig(config);
    }
}

const messages = [];

while (true) {
    const answer = await question({
        message: 'What is your query:(type .help to get helps)',
    });

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
        const model = await question({
            type: 'list',
            message: 'Please select your model:',
            choices: [
                'qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-max-1201', 'qwen-max-longcontext'
            ]
        });
        if (model) {
            config.model = model;
            await saveConfig(config);
        }
        continue;
    }

    if (answer === '.clean_context') {
        messages.length = 0;
        continue;
    }

    if (answer === '.exit') {
        break;
    }

    if (answer === '.help') {
        console.log(`.set_model         choose model`);
        console.log(`.set_api_key       set api key`);
        console.log(`.clean_context     clean context`);
        console.log(`.exit              exit the program`);
        continue;
    }

    if (!answer) {
        console.log(`query can not be empty! please re-type it.`);
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
}
