// The two cards a person sees while two devices pair up.
//
//   invite card   on the host: a QR code and a link for the guest, and a
//                 box to paste the guest's answer into
//   answer card   on the guest: a QR code and a link to send back
//
// Any project can mount them; the words come in through `labels`, so a
// page in another language passes its own. Styles: pairingPanel.css, with
// custom properties (--os-*) a project can set to match its colours.

import { encodeQr, qrToSvg } from "./qr.js";

export const DEFAULT_LABELS = {
  inviteHeading: "Invite a friend",
  inviteHint: "They scan this with their phone camera, or you send them the link.",
  answerHeading: "Almost there: send this back",
  answerHint:
    "Show this code to the host so they can scan it, or send them the link. The game starts the moment they open it.",
  copy: "Copy link",
  copied: "Copied",
  share: "Share",
  whatsapp: "WhatsApp",
  pasteLabel: "Got their answer as text? Paste it here",
  pastePlaceholder: "Paste the answer link or code",
  connect: "Connect",
  cancel: "Cancel",
  shareText: "Join my table:",
};

/**
 * Shows an invitation on the host's page.
 *
 * @param {HTMLElement} container - Emptied and filled with the card.
 * @param {{ link: string, heading?: string, labels?: object,
 *           onAnswer: (text: string) => void, onCancel?: () => void }} options
 * @returns {{ setStatus(text: string, tone?: "info" | "error" | "ok"): void, destroy(): void }}
 */
export function renderInviteCard(container, { link, heading, labels = {}, onAnswer, onCancel }) {
  const words = { ...DEFAULT_LABELS, ...labels };
  const card = el("div", "os-card");
  card.append(
    el("p", "os-card__heading", heading ?? words.inviteHeading),
    qrBlock(link),
    el("p", "os-card__hint", words.inviteHint),
    shareRow(link, words),
  );

  const form = el("form", "os-card__paste");
  const label = el("label", "os-card__label", words.pasteLabel);
  const input = el("textarea", "os-card__input");
  input.rows = 2;
  input.placeholder = words.pastePlaceholder;
  input.spellcheck = false;
  input.autocapitalize = "off";
  const id = `os-paste-${Math.random().toString(36).slice(2, 8)}`;
  input.id = id;
  label.htmlFor = id;
  const connect = el("button", "os-button os-button--primary", words.connect);
  connect.type = "submit";
  form.append(label, input, connect);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (input.value.trim()) onAnswer(input.value.trim());
  });
  card.append(form);

  const status = el("p", "os-card__status");
  status.setAttribute("role", "status");
  card.append(status);

  if (onCancel) {
    const cancel = el("button", "os-button os-button--quiet", words.cancel);
    cancel.type = "button";
    cancel.addEventListener("click", onCancel);
    card.append(cancel);
  }

  container.replaceChildren(card);
  return {
    setStatus(text, tone = "info") {
      status.textContent = text;
      status.dataset.tone = tone;
    },
    destroy() {
      card.remove();
    },
  };
}

/**
 * Shows the answer on the guest's page.
 *
 * @param {HTMLElement} container
 * @param {{ link: string, labels?: object }} options
 * @returns {{ setStatus(text: string, tone?: string): void, destroy(): void }}
 */
export function renderAnswerCard(container, { link, labels = {} }) {
  const words = { ...DEFAULT_LABELS, ...labels };
  const card = el("div", "os-card");
  const status = el("p", "os-card__status");
  status.setAttribute("role", "status");
  card.append(
    el("p", "os-card__heading", words.answerHeading),
    qrBlock(link),
    el("p", "os-card__hint", words.answerHint),
    shareRow(link, { ...words, shareText: "" }),
    status,
  );
  container.replaceChildren(card);
  return {
    setStatus(text, tone = "info") {
      status.textContent = text;
      status.dataset.tone = tone;
    },
    destroy() {
      card.remove();
    },
  };
}

function qrBlock(link) {
  const box = el("div", "os-card__qr");
  // Level L: the code is shown on a screen, not printed on a dirty wall,
  // and the lower level keeps the modules big enough for an old camera.
  box.innerHTML = qrToSvg(encodeQr(link, { ecc: "L" }));
  box.firstElementChild.setAttribute("role", "img");
  box.firstElementChild.setAttribute("aria-label", "QR code of the link");
  return box;
}

function shareRow(link, words) {
  const row = el("div", "os-card__actions");

  const copy = el("button", "os-button", words.copy);
  copy.type = "button";
  copy.addEventListener("click", async () => {
    const ok = await copyText(link);
    copy.textContent = ok ? words.copied : words.copy;
    setTimeout(() => {
      copy.textContent = words.copy;
    }, 1600);
  });
  row.append(copy);

  const text = words.shareText ? `${words.shareText} ${link}` : link;
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    const share = el("button", "os-button", words.share);
    share.type = "button";
    share.addEventListener("click", () => {
      navigator.share({ text }).catch(() => {});
    });
    row.append(share);
  }

  const whatsapp = el("a", "os-button", words.whatsapp);
  whatsapp.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
  whatsapp.target = "_blank";
  whatsapp.rel = "noopener";
  row.append(whatsapp);

  const field = el("input", "os-card__link");
  field.readOnly = true;
  field.value = link;
  field.setAttribute("aria-label", "The link");
  field.addEventListener("focus", () => field.select());
  row.append(field);
  return row;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers, or a page without clipboard permission.
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
