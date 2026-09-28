// WebRTC, reduced to two calls: make an invite, answer an invite.
//
//   host:  createInvite()      -> an offer code to send; accept(answer) -> a link
//   guest: answerInvite(code)  -> an answer code to send back; connected -> a link
//
// Each call gathers every ICE candidate before it returns ("non-trickle"),
// because the code travels by hand: there is no second chance to send a
// candidate that turns up late. The STUN servers only tell a browser its
// public address; no game message ever passes through them.
//
// This file is the only one in the module that needs a browser. The tests
// cover the parts around it (signal.js, link.js, session.js); the whole
// path is exercised by connecting two real browser pages.

import { packSignal, unpackSignal } from "./signal.js";
import { wrapChannel } from "./link.js";

/** Google's public STUN servers: they answer "what is my address?", nothing more. */
export const DEFAULT_ICE_SERVERS = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

const GATHER_MS = 4000;
const CONNECT_MS = 25000;

/**
 * Starts one invitation. The host keeps the returned object until the
 * guest's answer comes back; a page may hold several at once, one per
 * empty seat, told apart by their tickets.
 *
 * @param {{ app: string, room: string, iceServers?: object[] }} options
 * @returns {Promise<{ code: string, ticket: string,
 *   accept(answerCode: string): Promise<object>, cancel(): void }>}
 */
export async function createInvite({ app, room, iceServers = DEFAULT_ICE_SERVERS }) {
  const ticket = randomToken(4);
  const pc = new RTCPeerConnection({ iceServers });
  const channel = pc.createDataChannel("online-sync", { ordered: true });
  const opened = waitForOpen(channel);

  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  const code = packSignal({ kind: "offer", app, room, ticket, sdp: pc.localDescription.sdp });

  let used = false;
  return {
    code,
    ticket,
    async accept(answerCode) {
      const answer = unpackSignal(answerCode);
      if (answer.kind !== "answer") throw new Error("That is an invite, not an answer. Send it to a friend instead.");
      if (answer.app !== app) throw new Error("That answer belongs to a different game.");
      if (answer.room !== room || answer.ticket !== ticket) {
        throw new Error("That answer belongs to another invite. Ask your friend to open the newest one.");
      }
      if (used) throw new Error("This invite has been used already.");
      used = true;
      await pc.setRemoteDescription({ type: "answer", sdp: answer.sdp });
      await withTimeout(opened, CONNECT_MS, "The two devices could not reach each other. Try again on the same Wi-Fi.");
      return linkOver(pc, channel);
    },
    cancel() {
      pc.close();
    },
  };
}

/**
 * Answers an invitation. The answer code must travel back to the host;
 * the link opens once the host has read it.
 *
 * @param {string} offerCode - The code from the invite link.
 * @param {{ app: string, iceServers?: object[] }} options
 * @returns {Promise<{ code: string, room: string, ticket: string,
 *   connected: Promise<object>, cancel(): void }>}
 */
export async function answerInvite(offerCode, { app, iceServers = DEFAULT_ICE_SERVERS }) {
  const offer = unpackSignal(offerCode);
  if (offer.kind !== "offer") throw new Error("That is an answer, not an invite. It goes back to the host.");
  if (offer.app !== app) throw new Error("That invite is for a different game.");

  const pc = new RTCPeerConnection({ iceServers });
  const channelArrived = new Promise((resolve) => {
    pc.ondatachannel = (event) => resolve(event.channel);
  });

  await pc.setRemoteDescription({ type: "offer", sdp: offer.sdp });
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);
  const code = packSignal({ kind: "answer", app, room: offer.room, ticket: offer.ticket, sdp: pc.localDescription.sdp });

  const connected = channelArrived.then(async (channel) => {
    await waitForOpen(channel);
    return linkOver(pc, channel);
  });

  return {
    code,
    room: offer.room,
    ticket: offer.ticket,
    connected,
    cancel() {
      pc.close();
    },
  };
}

function linkOver(pc, channel) {
  const link = wrapChannel(channel);
  pc.addEventListener("connectionstatechange", () => {
    // "disconnected" often heals by itself; the link's heartbeat reports it
    // as quiet. "failed" and "closed" do not.
    if (pc.connectionState === "failed" || pc.connectionState === "closed") link.close();
  });
  link.listen({
    status(status) {
      if (status === "closed") pc.close();
    },
  });
  return link;
}

function gathered(pc) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", check);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    // Some networks never report "complete"; by then the useful candidates
    // (the local one and the STUN one) are in.
    const timer = setTimeout(done, GATHER_MS);
    pc.addEventListener("icegatheringstatechange", check);
  });
}

function waitForOpen(channel) {
  if (channel.readyState === "open") return Promise.resolve();
  return new Promise((resolve, reject) => {
    channel.addEventListener("open", () => resolve(), { once: true });
    channel.addEventListener("close", () => reject(new Error("The connection closed before it opened.")), { once: true });
  });
}

function withTimeout(promise, ms, message) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))]);
}

/** A short random token from the platform's secure source, base36. */
export function randomToken(bytes = 6) {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return [...values].map((b) => b.toString(36).padStart(2, "0")).join("").toUpperCase();
}
