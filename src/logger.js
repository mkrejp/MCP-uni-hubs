import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LOG_LEVELS = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  CRITICAL: 50,
};

export class AppLogger {
  constructor({
    level = 'INFO',
    logDir = './logs',
    instanceId = 'default-instance',
    serviceName = 'app',
  } = {}) {
    this.level = String(level).toUpperCase();
    if (!(this.level in LOG_LEVELS)) {
      throw new Error(`Unsupported log level: ${level}`);
    }

    this.levelValue = LOG_LEVELS[this.level];
    this.logDir = resolve(logDir);
    this.instanceId = instanceId;
    this.serviceName = serviceName;
    this.filePath = this.buildLogFilePath();
    this.ensureLogDirectory();
  }

  buildLogFilePath() {
    const dateStamp = new Date().toISOString().slice(0, 10);
    const fileName = `${this.serviceName}-${dateStamp}-${this.instanceId}.log`;
    return resolve(this.logDir, fileName);
  }

  ensureLogDirectory() {
    mkdirSync(this.logDir, { recursive: true });
    if (!existsSync(this.filePath)) {
      appendFileSync(this.filePath, '', 'utf8');
    }
  }

  shouldLog(levelName) {
    const normalized = String(levelName).toUpperCase();
    const value = LOG_LEVELS[normalized];
    if (value === undefined) {
      return false;
    }
    return value >= this.levelValue;
  }

  write(levelName, message, metadata = {}) {
    const normalized = String(levelName).toUpperCase();
    if (!this.shouldLog(normalized)) {
      return false;
    }

    const timestamp = new Date().toISOString();
    const payload = {
      timestamp,
      level: normalized,
      service: this.serviceName,
      instance: this.instanceId,
      message,
      ...(Object.keys(metadata).length ? { metadata } : {}),
    };

    const line = `${JSON.stringify(payload)}\n`;
    appendFileSync(this.filePath, line, 'utf8');
    return true;
  }

  debug(message, metadata) {
    return this.write('DEBUG', message, metadata);
  }

  info(message, metadata) {
    return this.write('INFO', message, metadata);
  }

  warn(message, metadata) {
    return this.write('WARN', message, metadata);
  }

  error(message, metadata) {
    return this.write('ERROR', message, metadata);
  }

  critical(message, metadata) {
    return this.write('CRITICAL', message, metadata);
  }

  fileExists(filePath) {
    return existsSync(filePath);
  }

  readLog() {
    if (!existsSync(this.filePath)) {
      return '';
    }
    return readFileSync(this.filePath, 'utf8');
  }
}

export function createDefaultLogger(config = {}) {
  return new AppLogger({
    level: process.env.LOG_LEVEL || 'INFO',
    logDir: process.env.LOG_DIR || './logs',
    instanceId: process.env.INSTANCE_ID || 'default-instance',
    serviceName: process.env.SERVICE_NAME || 'app',
    ...config,
  });
}
