import { homedir } from 'os';
import path from 'path';
import { access, readFile, writeFile, constants } from 'fs/promises';

import ini from 'ini';

export const DEFAULT_RC_PATH = path.join(homedir(), '.dashscoperc');

export async function loadConfig(rcPath = DEFAULT_RC_PATH) {
  let content = '';
  try {
    await access(rcPath, constants.F_OK | constants.R_OK | constants.W_OK);
    content = await readFile(rcPath, 'utf8');
  } catch (ex) {
    // ignore when file not exits
  }
  return ini.parse(content);
}

export async function saveConfig(config, rcPath = DEFAULT_RC_PATH) {
  await writeFile(rcPath, ini.stringify(config));
}
