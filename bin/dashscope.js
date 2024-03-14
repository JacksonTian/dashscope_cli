#!/usr/bin/env node
import { homedir } from "os";
import path from "path";
import { access, readFile, writeFile, constants } from "fs/promises";
import readline from "readline/promises";

import chalk from 'chalk';
import { request, readAsSSE } from "httpx";
import ini from "ini";
import inquirer from 'inquirer';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: (line) => {
        const completions = '.set_model .set_api_key .clean_context .exit .set_verbose .help'.split(' ');
        const hits = completions.filter((c) => c.startsWith(line));
        // Show all completions if none found
        return [hits.length ? hits : completions, line];
    }
});

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

console.log(`Current model: ${config.model}. type \`.set_model\` to change it.`);

const messages = [];

while (true) {
    const answer = await rl.question(chalk.bold('What is your query: ') + '(type .help to get helps) \n> ');
    // 因为inquery 也在使用 readline，而 stdout 是全局的，所以为了不互相影响，使用后，先暂停。
    rl.pause();
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
            ],
            default: config.model
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
        console.log(`Quiting dashcope.`)
        process.exit(0);
    }

    if (answer === '.help') {
        console.log(`.set_model         choose model`);
        console.log(`.set_api_key       set api key`);
        console.log(`.clean_context     clean context`);
        console.log(`.exit              exit the program`);
        console.log(`.set_verbose       turn on/off verbose mode`);
        console.log(`.help              show this help`);
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

    if (config.verbose === true) {
        const usage = data.usage;
        console.log(`[Verbose] Used tokens: ${usage.total_tokens}, input: ${usage.input_tokens}, output: ${usage.output_tokens}. ${data.request_id}`);
        console.log(`[Verbose] current context message count: ${messages.length}`);
    }
}
