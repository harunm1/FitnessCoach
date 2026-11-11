// Test-only SMTP inbox. It is a separate loopback process, never an application route.
import { createServer } from "node:http";
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";

type Message = { to: string[]; subject: string; text: string };
const messages: Message[] = [];
const smtpPort = Number(process.env.TEST_SMTP_PORT || 11026);
const inboxPort = Number(process.env.TEST_INBOX_PORT || 18027);
const smtp = new SMTPServer({
  disabledCommands: ["AUTH", "STARTTLS"],
  logger: false,
  size: 1_000_000,
  onData(stream, session, callback) {
    simpleParser(stream).then((mail) => {
      messages.push({
        to: session.envelope.rcptTo.map((recipient) => recipient.address),
        subject: mail.subject || "",
        text: mail.text || "",
      });
      if (messages.length > 200) messages.shift();
      callback();
    }, callback);
  },
});
smtp.listen(smtpPort, "127.0.0.1");
const http = createServer((request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  response.setHeader("Content-Type", "application/json");
  if (url.pathname === "/health") {
    response.end('{"ok":true}');
    return;
  }
  if (url.pathname === "/messages" && request.method === "GET") {
    response.end(
      JSON.stringify(
        messages.filter((mail) =>
          mail.to.includes(url.searchParams.get("to") || ""),
        ),
      ),
    );
    return;
  }
  response.writeHead(404);
  response.end("{}");
});
http.listen(inboxPort, "127.0.0.1");
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    smtp.close();
    http.close();
  });
