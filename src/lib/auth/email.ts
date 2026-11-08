import "server-only";
import nodemailer from "nodemailer";
import { readMailConfig } from "./config";
import type { SendAuthEmail } from "./core";

export function createEmailSender(): SendAuthEmail {
  let transport: ReturnType<typeof nodemailer.createTransport> | undefined;
  let from: string;
  return async (message) => {
    if (!transport) {
      const config = readMailConfig();
      from = config.from;
      transport = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth,
        requireTLS:
          !config.secure &&
          !["localhost", "127.0.0.1", "::1"].includes(config.host),
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });
    }
    await transport.sendMail({ ...message, from });
  };
}
