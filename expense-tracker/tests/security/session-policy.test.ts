import assert from "node:assert/strict";
import test from "node:test";
import { isRecentSignIn, isSameOriginRequest, SESSION_DURATION_MS } from "../../src/lib/auth/session-policy";

test("session exchange only accepts a recent sign-in, including clock-skew bounds", () => {
  const now = 1_800_000_000;
  assert.equal(isRecentSignIn(now, now), true);
  assert.equal(isRecentSignIn(now - 300, now), true);
  assert.equal(isRecentSignIn(now - 301, now), false);
  assert.equal(isRecentSignIn(now + 31, now), false);
  assert.equal(isRecentSignIn(Number.NaN, now), false);
  assert.equal(SESSION_DURATION_MS, 432_000_000);
});

test("CSRF protection requires exactly the configured origin", () => {
  const origin = "https://expenses.davosolutions.com";
  assert.equal(isSameOriginRequest(origin, origin), true);
  for (const candidate of [null, "null", "", "http://expenses.davosolutions.com", `${origin}.attacker.test`, `${origin}/`, `${origin}:8443`, "https://davosolutions.com"]) {
    assert.equal(isSameOriginRequest(candidate, origin), false);
  }
});
