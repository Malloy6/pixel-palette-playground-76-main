import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { buildConferenceRoomName, createJaasJwt } from "../../src/lib/tusome-db.ts";

test("buildConferenceRoomName uses the lesson id", () => {
  assert.equal(buildConferenceRoomName(42), "elimusphere-lesson-42");
  assert.notEqual(buildConferenceRoomName(42), buildConferenceRoomName(43));
});

test("buildConferenceRoomName separates distinct class sessions", () => {
  assert.equal(buildConferenceRoomName(42, "session-a"), "elimusphere-lesson-42-session-a");
  assert.notEqual(
    buildConferenceRoomName(42, "session-a"),
    buildConferenceRoomName(42, "session-b"),
  );
});

test("createJaasJwt issues fresh, role-scoped 4-hour tokens", () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });

  for (const [role, moderator] of [
    ["tutor", true],
    ["admin", true],
    ["learner", false],
  ] as const) {
    const token = createJaasJwt({
      appId: "demo-app",
      keyId: "demo-key",
      privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString("utf8"),
      roomName: buildConferenceRoomName(7),
      userId: 99,
      userName: "Demo Participant",
      role,
    });
    const [headerSegment, payloadSegment, signatureSegment] = token.split(".");
    const payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));

    assert.equal(payload.room, "elimusphere-lesson-7");
    assert.equal(payload.context.user.moderator, moderator);
    assert.equal(payload.exp - payload.iat, 60 * 60 * 4);
    assert.equal(
      crypto.verify(
        "RSA-SHA256",
        Buffer.from(`${headerSegment}.${payloadSegment}`),
        publicKey,
        Buffer.from(signatureSegment, "base64url"),
      ),
      true,
    );
  }
});
