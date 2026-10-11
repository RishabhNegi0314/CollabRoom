export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const CURRENT_LEVEL = process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG;

function formatMessage(level: string, message: string, ...args: any[]): string {
  const timestamp = new Date().toISOString();
  let argString = "";
  if (args.length > 0) {
    argString = " " + args.map(a => {
      if (a instanceof Error) {
        return a.stack || a.message;
      }
      return typeof a === "object" ? JSON.stringify(a) : String(a);
    }).join(" ");
  }
  return `[${timestamp}] [${level}] ${message}${argString}`;
}

export const logger = {
  debug(message: string, ...args: any[]) {
    if (CURRENT_LEVEL <= LogLevel.DEBUG) {
      console.log(formatMessage("DEBUG", message, ...args));
    }
  },
  info(message: string, ...args: any[]) {
    if (CURRENT_LEVEL <= LogLevel.INFO) {
      console.log(formatMessage("INFO", message, ...args));
    }
  },
  warn(message: string, ...args: any[]) {
    if (CURRENT_LEVEL <= LogLevel.WARN) {
      console.warn(formatMessage("WARN", message, ...args));
    }
  },
  error(message: string, ...args: any[]) {
    if (CURRENT_LEVEL <= LogLevel.ERROR) {
      console.error(formatMessage("ERROR", message, ...args));
    }
  }
};
