import { createLogger, format, transports, Logger as WinstonLogger } from "winston";
import * as path from "path";
import * as fs from "fs";

class Logger {
  private static generalLogger: WinstonLogger;
  private static specificLogger: WinstonLogger;

  private constructor() {}

  // Logger General
  public static getInstance(): WinstonLogger {
    if (!Logger.generalLogger) {
      const currentDate = new Date().toISOString().split("T")[0]; // Fecha en formato YYYY-MM-DD
      const logDir = path.join(process.cwd(), "files/logs"); // Directorio raíz donde se ejecuta la app
      const logFileName = path.join(logDir, `general-log-${currentDate}.log`); // Archivo para logs generales

      // Crear el directorio de logs si no existe
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      Logger.generalLogger = createLogger({
        level: "info",
        transports: [
          new transports.Console({
            format: format.combine(
              format.colorize(),
              format.timestamp({ format: "YY-MM-DD HH:mm:ss" }),
              format.printf(({ timestamp, level, message, ...extra }) => {
                return `[${timestamp}] ${level}: ${message} ${Object.keys(extra).length ? JSON.stringify(extra) : ""}`;
              })
            ),
          }),
          new transports.File({
            filename: logFileName,
            format: format.combine(
              format.timestamp({ format: "YY-MM-DD HH:mm:ss" }),
              format.printf(({ timestamp, level, message, ...extra }) => {
                return `[${timestamp}] ${level}: ${message} ${Object.keys(extra).length ? JSON.stringify(extra) : ""}`;
              })
            ),
          }),
        ],
      });
    }

    return Logger.generalLogger;
  }

  public static getBuyInstance(): WinstonLogger {
    if (!Logger.specificLogger) {
      const currentDate = new Date().toISOString().split("T")[0];
      const logDir = path.join(process.cwd(), "files/logs");
      const logFileName = path.join(logDir, `buyOrders-log-${currentDate}.log`);

      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      Logger.specificLogger = createLogger({
        level: "info",
        transports: [
          new transports.File({
            filename: logFileName,
            format: format.combine(
              format.timestamp({ format: "YY-MM-DD HH:mm:ss" }),
              format.printf(({ timestamp, level, message, ...extra }) => {
                return `[${timestamp}] ${level}: ${message} ${Object.keys(extra).length ? JSON.stringify(extra) : ""}`;
              })
            ),
          }),
        ],
      });
    }

    return Logger.specificLogger;
  }
}

export default Logger;
