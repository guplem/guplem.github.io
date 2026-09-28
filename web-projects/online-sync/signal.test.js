import { describe, expect, it } from "bun:test";
import { linkFor, packSignal, readLink, unpackSignal } from "./signal.js";

// Real descriptions, captured from Chromium 140 (a data channel only, as
// peer.js makes them), and one shaped like Firefox's, which puts the
// fingerprint at session level, writes UDP in capitals, offers TCP
// candidates and ends with end-of-candidates.
const CHROME_OFFER = [
  "v=0",
  "o=- 7567184461499525355 2 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "a=group:BUNDLE 0",
  "a=extmap-allow-mixed",
  "a=msid-semantic: WMS",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 0.0.0.0",
  "a=candidate:460399645 1 udp 2113937151 bba508fe-65f2-4830-ad4c-5532269f2fa6.local 42547 typ host generation 0 network-cost 999",
  "a=candidate:842163049 1 udp 1677729535 203.0.113.7 42547 typ srflx raddr 0.0.0.0 rport 0 generation 0 network-cost 999",
  "a=candidate:1510613869 1 tcp 1518280447 192.168.1.20 9 typ host tcptype active generation 0 network-id 1",
  "a=ice-ufrag:Ybd/",
  "a=ice-pwd:uyqcbBTv+1ZU7+sJZa4cxyPK",
  "a=ice-options:trickle",
  "a=fingerprint:sha-256 D2:0D:1D:C2:DE:BA:31:E9:D8:E9:62:6F:37:0C:9A:D6:59:C1:0B:E7:27:43:03:AD:5D:13:B6:87:1E:07:21:29",
  "a=setup:actpass",
  "a=mid:0",
  "a=sctp-port:5000",
  "a=max-message-size:262144",
  "",
].join("\r\n");

const CHROME_ANSWER = [
  "v=0",
  "o=- 6333536870545914506 2 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "a=group:BUNDLE 0",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 0.0.0.0",
  "a=candidate:907556051 1 udp 2113937151 bba508fe-65f2-4830-ad4c-5532269f2fa6.local 38942 typ host generation 0 network-cost 999",
  "a=ice-ufrag:unRY",
  "a=ice-pwd:BdME84AD362nOvQBMfKz805D",
  "a=fingerprint:sha-256 8D:C5:C6:50:A2:FD:81:5A:09:69:DD:A6:0F:27:5D:EB:07:95:9B:CE:83:88:20:9F:24:FB:0F:9D:70:EF:5B:F0",
  "a=setup:active",
  "a=mid:0",
  "a=sctp-port:5000",
  "",
].join("\r\n");

const FIREFOX_OFFER = [
  "v=0",
  "o=mozilla...THIS_IS_SDPARTA-128.0 6013580462362958397 0 IN IP4 0.0.0.0",
  "s=-",
  "t=0 0",
  "a=fingerprint:sha-256 5B:1E:7F:0A:22:93:4C:88:10:AB:CD:EF:01:23:45:67:89:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0:11:22:33",
  "a=group:BUNDLE 0",
  "a=ice-options:trickle",
  "a=msid-semantic:WMS *",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 0.0.0.0",
  "a=candidate:0 1 UDP 2122252543 10.0.0.5 51022 typ host",
  "a=candidate:3 1 UDP 2122187007 2001:db8::1:5 51023 typ host",
  "a=candidate:2 1 TCP 2105524479 10.0.0.5 9 typ host tcptype active",
  "a=candidate:1 1 UDP 1686052863 198.51.100.9 51022 typ srflx raddr 10.0.0.5 rport 51022",
  "a=sendrecv",
  "a=end-of-candidates",
  "a=ice-pwd:0b1a5c3d2e4f60718293a4b5c6d7e8f9",
  "a=ice-ufrag:8a0c8f2e",
  "a=mid:0",
  "a=setup:actpass",
  "a=sctp-port:5000",
  "a=max-message-size:1073741823",
  "",
].join("\r\n");

const line = (sdp, prefix) =>
  sdp
    .split("\r\n")
    .filter((l) => l.startsWith(prefix))
    .map((l) => l.slice(prefix.length));

/** The parts of a candidate that decide whether two peers can reach each other. */
const endpoints = (sdp) =>
  line(sdp, "a=candidate:").map((c) => {
    const f = c.split(" ");
    return `${f[4].toLowerCase()} ${f[5]} ${f[7]}`;
  });

const base = { app: "ghana-ludo", room: "K7Q2PX", ticket: "t3" };

describe("packSignal and unpackSignal", () => {
  it("round-trips an offer: kind, app, room, ticket and every field that matters", () => {
    const code = packSignal({ kind: "offer", sdp: CHROME_OFFER, ...base });
    const back = unpackSignal(code);

    expect(back.kind).toBe("offer");
    expect(back.app).toBe("ghana-ludo");
    expect(back.room).toBe("K7Q2PX");
    expect(back.ticket).toBe("t3");
    expect(line(back.sdp, "a=ice-ufrag:")).toEqual(["Ybd/"]);
    expect(line(back.sdp, "a=ice-pwd:")).toEqual(["uyqcbBTv+1ZU7+sJZa4cxyPK"]);
    expect(line(back.sdp, "a=fingerprint:")).toEqual(line(CHROME_OFFER, "a=fingerprint:"));
    expect(line(back.sdp, "a=setup:")).toEqual(["actpass"]);
    expect(line(back.sdp, "a=mid:")).toEqual(["0"]);
  });

  it("keeps the UDP candidates and drops the TCP ones, which a data channel never needs", () => {
    const back = unpackSignal(packSignal({ kind: "offer", sdp: CHROME_OFFER, ...base }));
    expect(endpoints(back.sdp)).toEqual([
      "bba508fe-65f2-4830-ad4c-5532269f2fa6.local 42547 host",
      "203.0.113.7 42547 srflx",
    ]);
  });

  it("round-trips an answer and its setup role", () => {
    const back = unpackSignal(packSignal({ kind: "answer", sdp: CHROME_ANSWER, ...base }));
    expect(back.kind).toBe("answer");
    expect(line(back.sdp, "a=setup:")).toEqual(["active"]);
    expect(endpoints(back.sdp)).toEqual(["bba508fe-65f2-4830-ad4c-5532269f2fa6.local 38942 host"]);
  });

  it("reads Firefox's shape: session-level fingerprint, capital UDP, IPv6", () => {
    const back = unpackSignal(packSignal({ kind: "offer", sdp: FIREFOX_OFFER, ...base }));
    expect(line(back.sdp, "a=fingerprint:")).toEqual(line(FIREFOX_OFFER, "a=fingerprint:"));
    expect(line(back.sdp, "a=ice-pwd:")).toEqual(["0b1a5c3d2e4f60718293a4b5c6d7e8f9"]);
    expect(endpoints(back.sdp)).toEqual([
      "10.0.0.5 51022 host",
      "2001:db8:0:0:0:0:1:5 51023 host",
      "198.51.100.9 51022 srflx",
    ]);
  });

  it("writes a description a browser accepts: CRLF lines, one data-channel section", () => {
    const { sdp } = unpackSignal(packSignal({ kind: "offer", sdp: CHROME_OFFER, ...base }));
    expect(sdp.startsWith("v=0\r\n")).toBe(true);
    expect(sdp.endsWith("\r\n")).toBe(true);
    expect(line(sdp, "m=")).toEqual(["application 9 UDP/DTLS/SCTP webrtc-datachannel"]);
    expect(line(sdp, "a=group:")).toEqual(["BUNDLE 0"]);
    expect(line(sdp, "a=sctp-port:")).toEqual(["5000"]);
    expect(sdp).toContain("a=end-of-candidates\r\n");
  });

  it("makes a short code of URL-safe characters only", () => {
    const code = packSignal({ kind: "offer", sdp: CHROME_OFFER, ...base });
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    // The full description is about 900 characters; the code must fit a
    // QR code a phone reads at arm's length.
    expect(code.length).toBeLessThan(180);
  });

  it("refuses a description with no fingerprint or no credentials", () => {
    const broken = CHROME_OFFER.replace(/a=fingerprint:.*\r\n/, "");
    expect(() => packSignal({ kind: "offer", sdp: broken, ...base })).toThrow();
    expect(() => packSignal({ kind: "offer", sdp: CHROME_OFFER.replace(/a=ice-pwd:.*\r\n/, ""), ...base })).toThrow();
  });

  it("refuses a code that was cut short or mistyped, with a readable reason", () => {
    const code = packSignal({ kind: "offer", sdp: CHROME_OFFER, ...base });
    expect(() => unpackSignal(code.slice(0, 20))).toThrow(/incomplete/);
    expect(() => unpackSignal("not a code at all!")).toThrow(/not an invite/);
    expect(() => unpackSignal("")).toThrow(/not an invite/);
  });
});

describe("linkFor and readLink", () => {
  const page = "https://triunitystudios.com/web-projects/ghana-ludo/";

  it("puts an offer behind #join and an answer behind #answer", () => {
    expect(linkFor(page, "offer", "ABC")).toBe(`${page}#join=ABC`);
    expect(linkFor(page, "answer", "ABC")).toBe(`${page}#answer=ABC`);
    expect(linkFor(`${page}?x=1#old`, "offer", "ABC")).toBe(`${page}?x=1#join=ABC`);
  });

  it("reads a whole link, a bare hash, or a bare code with stray spaces", () => {
    expect(readLink(`${page}#join=ABC-_1`)).toEqual({ kind: "offer", code: "ABC-_1" });
    expect(readLink("#answer=XYZ")).toEqual({ kind: "answer", code: "XYZ" });
    expect(readLink("  XYZ_9-\n")).toEqual({ kind: null, code: "XYZ_9-" });
    expect(readLink("Come and play: https://x.test/#join=QQQ")).toEqual({ kind: "offer", code: "QQQ" });
  });

  it("returns null when there is nothing that looks like a code", () => {
    expect(readLink("")).toBeNull();
    expect(readLink("#nothing")).toBeNull();
    expect(readLink("hello world")).toBeNull();
  });
});
