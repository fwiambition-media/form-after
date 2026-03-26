import { createServer } from "node:http";
import { readFile, mkdir, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = join(__dirname, "data");
const DATA_FILE = join(DATA_DIR, "feedback-submissions.ndjson");
const EMAIL_TO = process.env.FEEDBACK_EMAIL_TO || "";
const EMAIL_FROM = process.env.FEEDBACK_EMAIL_FROM || "no-reply@fwi-ambition.local";
const SENDMAIL_PATH = process.env.SENDMAIL_PATH || "/usr/sbin/sendmail";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

async function ensureDataStore() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

async function readRequestBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function sanitizeSubmission(payload) {
  const fields = {
    global_rating: payload.global_rating || "",
    step_contact: payload.step_contact || "",
    contact_comment: payload.contact_comment || "",
    step_clarity: payload.step_clarity || "",
    clarity_comment: payload.clarity_comment || "",
    step_organization: payload.step_organization || "",
    organization_comment: payload.organization_comment || "",
    step_shoot: payload.step_shoot || "",
    shoot_comment: payload.shoot_comment || "",
    step_quality: payload.step_quality || "",
    quality_comment: payload.quality_comment || "",
    step_delivery: payload.step_delivery || "",
    delivery_comment: payload.delivery_comment || "",
    strengths: payload.strengths || "",
    improvements: payload.improvements || "",
    value_rating: payload.value_rating || "",
    value_comment: payload.value_comment || "",
    impact_level: payload.impact_level || "",
    impact_details: payload.impact_details || "",
    recommendation: payload.recommendation || "",
    recommend_why: payload.recommend_why || "",
    testimonial_optin: payload.testimonial_optin || "",
    testimonial_text: payload.testimonial_text || "",
    identity: payload.identity || "",
    format_type: payload.format_type || "",
    broadcast_approval: Boolean(payload.broadcast_approval)
  };

  return {
    submitted_at: new Date().toISOString(),
    ...fields
  };
}

function buildEmailContent(submission) {
  const rows = [
    ["Date", submission.submitted_at],
    ["Note globale", submission.global_rating],
    ["Premier contact", submission.step_contact],
    ["Commentaire premier contact", submission.contact_comment],
    ["Clarté des échanges", submission.step_clarity],
    ["Commentaire clarté", submission.clarity_comment],
    ["Organisation", submission.step_organization],
    ["Commentaire organisation", submission.organization_comment],
    ["Expérience tournage", submission.step_shoot],
    ["Commentaire tournage", submission.shoot_comment],
    ["Qualité du rendu final", submission.step_quality],
    ["Commentaire qualité", submission.quality_comment],
    ["Délais de livraison", submission.step_delivery],
    ["Commentaire délais", submission.delivery_comment],
    ["Points forts", submission.strengths],
    ["Axes d'amélioration", submission.improvements],
    ["Rapport qualité / prix", submission.value_rating],
    ["Commentaire valeur", submission.value_comment],
    ["Impact", submission.impact_level],
    ["Détails impact", submission.impact_details],
    ["Recommandation", submission.recommendation],
    ["Pourquoi", submission.recommend_why],
    ["Témoignage souhaité", submission.testimonial_optin],
    ["Texte témoignage", submission.testimonial_text],
    ["Identité", submission.identity],
    ["Format réalisé", submission.format_type],
    ["Autorisation de diffusion", submission.broadcast_approval ? "Oui" : "Non"]
  ];

  const text = rows
    .map(([label, value]) => `${label}: ${value || "-"}`)
    .join("\n");

  const html = `
    <h1>Nouveau retour FWI Ambition</h1>
    <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
      <tbody>
        ${rows
          .map(
            ([label, value]) =>
              `<tr><th align="left" style="background:#f5f5f5;">${escapeHtml(label)}</th><td>${escapeHtml(value || "-")}</td></tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;

  return { text, html };
}

async function sendFeedbackEmail(submission) {
  if (!EMAIL_TO) {
    return;
  }

  const { text, html } = buildEmailContent(submission);

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: "Nouveau retour client FWI Ambition",
      text,
      html
    });
    return;
  }

  const boundary = `fwi-boundary-${Date.now()}`;
  const message = [
    `To: ${EMAIL_TO}`,
    `From: ${EMAIL_FROM}`,
    "Subject: Nouveau retour client FWI Ambition",
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    "",
    text,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    "",
    html,
    "",
    `--${boundary}--`,
    ""
  ].join("\n");

  await new Promise((resolve, reject) => {
    const child = spawn(SENDMAIL_PATH, ["-t", "-oi"]);
    let stderr = "";

    child.on("error", reject);
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `sendmail exited with code ${code}`));
    });

    child.stdin.write(message);
    child.stdin.end();
  });
}

async function handleSubmission(request, response) {
  try {
    const rawBody = await readRequestBody(request);
    const parsed = JSON.parse(rawBody || "{}");
    const submission = sanitizeSubmission(parsed);

    if (!submission.global_rating) {
      sendJson(response, 400, {
        ok: false,
        message: "La note globale est requise."
      });
      return;
    }

    await ensureDataStore();
    await appendFile(DATA_FILE, `${JSON.stringify(submission)}\n`, "utf8");
    await sendFeedbackEmail(submission);

    sendJson(response, 201, {
      ok: true,
      message: "Votre réponse a bien été envoyée. Merci pour votre confiance."
    });
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      message: "Une erreur est survenue lors de l'envoi du formulaire."
    });
  }
}

async function serveFile(response, relativePath) {
  const safePath = relativePath === "/" ? "/index.html" : relativePath;
  const filePath = join(__dirname, safePath);
  const extension = extname(filePath);

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream"
    });
    response.end(file);
  } catch {
    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end("Not found");
  }
}

const server = createServer(async (request, response) => {
  if (!request.url || !request.method) {
    response.writeHead(400);
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "POST" && url.pathname === "/api/feedback") {
    await handleSubmission(request, response);
    return;
  }

  if (request.method === "GET") {
    await serveFile(response, url.pathname);
    return;
  }

  response.writeHead(405, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`FWI feedback form running on http://localhost:${PORT}`);
});
