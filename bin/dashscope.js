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
            'Authorization': `Bearer ${ctx.app_key}`
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
        const text = data.output.text;
        process.stdout.write(text.substring(current.length));
        current = text;
        if (data.output.finish_reason === 'stop') {
            process.stdout.write('\n');
        }
    }

    return lastEvent;
}

const config = await loadConfig();
if (!config.app_key) {
    const answers = await inquirer.prompt([
        {
            name: 'app_key',
            message: 'Please input your dashscope app key:'
        }
    ]);
    config.app_key = answers.app_key.trim();
    await saveConfig(config);
}

if (!config.model) {
    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'model',
            message: 'Please select your model:',
            choices: [
                'qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-max-1201', 'qwen-max-longcontext'
            ]
        }
    ]);
    const model = answers.model.trim();
    if (model) {
        config.model = model;
        await saveConfig(config);
    }
}

const messages = [];
while (true) {
    const answers = await inquirer.prompt([
        {
            name: 'question',
            message: 'What is your query:',
        }
    ]);
    const question = answers.question.trim();

    if (question === '.set_app_key') {
        const answers = await inquirer.prompt([
            {
                name: 'app_key',
                message: 'Please input your new dashscope app key:'
            }
        ]);

        const appkey = answers.app_key.trim();
        if (appkey) {
            config.app_key = appkey;
            await saveConfig(config);
        }
    }

    if (question === '.set_model') {
        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'model',
                message: 'Please select your model:',
                choices: [
                    'qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-max-1201', 'qwen-max-longcontext'
                ]
            }
        ]);
        const model = answers.model.trim();
        if (model) {
            config.model = model;
            await saveConfig(config);
        }
    }

    messages.push({
        role: 'user',
        content: question
    });

    const event = await query(messages, {
        app_key: config.app_key,
        model: config.model
    });

    const data = JSON.parse(event.data);
    messages.push({
        role: 'assistant',
        content: data.output.text
    });
}
