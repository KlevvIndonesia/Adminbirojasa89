import test from "node:test";
import assert from "node:assert";
import { userRepository, UserRepository, AuthResult } from "../src/data/repositories/userRepository";
import { MockUserProvider } from "./fixtures/mock/mockUserProvider";
import { ApiUserProvider } from "../src/data/api/apiUserProvider";

userRepository.setProvider(new MockUserProvider());

const EXPECTED_MESSAGES = {
  INVALID_CREDENTIALS: "Email atau password yang Anda masukkan tidak sesuai. Periksa kembali data login Anda.",
  ACCOUNT_INACTIVE: "Akun Anda belum aktif atau aksesnya telah dinonaktifkan. Hubungi administrator.",
  TOO_MANY_REQUESTS: "Terlalu banyak percobaan login. Silakan tunggu sebelum mencoba kembali.",
  NETWORK_ERROR: "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.",
  SERVER_ERROR: "Terjadi gangguan pada layanan login. Silakan coba kembali beberapa saat lagi.",
  UNEXPECTED_ERROR: "Terjadi kendala saat memproses permintaan login. Silakan coba kembali.",
};

test("Login Feedback - Successful authentication returns valid session and success flag", async () => {
  const result: AuthResult = await userRepository.authenticateDetailed("svp@birojasa.com", "admin123");
  assert.strictEqual(result.success, true);
  assert.ok(result.session);
  assert.strictEqual(result.session?.role, "administrator");
  assert.strictEqual(result.session?.name, "Admin Super (SVP)");
  assert.strictEqual(result.errorCode, undefined);
  assert.strictEqual(result.errorMessage, undefined);
});

test("Login Feedback - Wrong password returns sanitized generic credential error", async () => {
  const result: AuthResult = await userRepository.authenticateDetailed("svp@birojasa.com", "wrongpassword");
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.errorCode, "INVALID_CREDENTIALS");
  assert.strictEqual(result.errorMessage, EXPECTED_MESSAGES.INVALID_CREDENTIALS);
  assert.strictEqual(result.session, undefined);
});

test("Login Feedback - Unregistered email returns identical generic credential error without revealing existence", async () => {
  const result: AuthResult = await userRepository.authenticateDetailed("nonexistent@birojasa.com", "admin123");
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.errorCode, "INVALID_CREDENTIALS");
  assert.strictEqual(result.errorMessage, EXPECTED_MESSAGES.INVALID_CREDENTIALS);
  assert.strictEqual(result.session, undefined);
});

test("Login Feedback - Empty or whitespace credentials return validation error", async () => {
  const emptyRes: AuthResult = await userRepository.authenticateDetailed("", "");
  assert.strictEqual(emptyRes.success, false);
  assert.strictEqual(emptyRes.errorCode, "VALIDATION_ERROR");
  assert.ok(emptyRes.errorMessage);

  const spaceRes: AuthResult = await userRepository.authenticateDetailed("   ", "   ");
  assert.strictEqual(spaceRes.success, false);
  assert.strictEqual(spaceRes.errorCode, "VALIDATION_ERROR");
});

test("Login Feedback - Inactive user returns account inactive notification", async () => {
  const provider = new MockUserProvider();
  // nina.rahayu@birojasa.com is initialized with status "Nonaktif"
  const result = await provider.authenticateDetailed("nina.rahayu@birojasa.com", "anypass");
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.errorCode, "ACCOUNT_INACTIVE");
  assert.strictEqual(result.errorMessage, EXPECTED_MESSAGES.ACCOUNT_INACTIVE);
  assert.strictEqual(result.session, undefined);
});

test("Login Feedback - Backward compatibility with userRepository.authenticate() preserved", async () => {
  const valid = await userRepository.authenticate("finance@birojasa.com", "finance123");
  assert.ok(valid !== null);
  assert.strictEqual(valid?.role, "finance");

  const invalid = await userRepository.authenticate("finance@birojasa.com", "wrongpass");
  assert.strictEqual(invalid, null);
});

test("Login Feedback - ApiUserProvider maps HTTP 401 to generic credential error", async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: { code: "INVALID_CREDENTIALS", message: "Email atau password tidak valid." },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );

    const apiProvider = new ApiUserProvider("http://fake-api:9999");
    const result = await apiProvider.authenticateDetailed("admin@birojasa.com", "wrongpass");
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.statusCode, 401);
    assert.strictEqual(result.errorCode, "INVALID_CREDENTIALS");
    assert.strictEqual(result.errorMessage, EXPECTED_MESSAGES.INVALID_CREDENTIALS);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Login Feedback - ApiUserProvider maps HTTP 403 to inactive account notification", async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: { code: "ACCOUNT_INACTIVE", message: "Akun Anda tidak aktif." },
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );

    const apiProvider = new ApiUserProvider("http://fake-api:9999");
    const result = await apiProvider.authenticateDetailed("disabled@birojasa.com", "secret");
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.statusCode, 403);
    assert.strictEqual(result.errorCode, "ACCOUNT_INACTIVE");
    assert.strictEqual(result.errorMessage, EXPECTED_MESSAGES.ACCOUNT_INACTIVE);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Login Feedback - ApiUserProvider maps HTTP 429 to rate limit notice with retryAfterSeconds", async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "TOO_MANY_REQUESTS",
            message: "Terlalu banyak permintaan.",
            retryAfterSeconds: 45,
          },
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "45" },
        }
      );

    const apiProvider = new ApiUserProvider("http://fake-api:9999");
    const result = await apiProvider.authenticateDetailed("admin@birojasa.com", "test");
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.statusCode, 429);
    assert.strictEqual(result.errorCode, "TOO_MANY_REQUESTS");
    assert.strictEqual(result.retryAfterSeconds, 45);
    assert.strictEqual(result.errorMessage, EXPECTED_MESSAGES.TOO_MANY_REQUESTS);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Login Feedback - ApiUserProvider maps HTTP 500+ to server error notice and suppresses internals", async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "FATAL SQLITE3 ERROR: SELECT * FROM users table crashed",
          },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );

    const apiProvider = new ApiUserProvider("http://fake-api:9999");
    const result = await apiProvider.authenticateDetailed("admin@birojasa.com", "test");
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.statusCode, 500);
    assert.strictEqual(result.errorCode, "SERVER_ERROR");
    // Ensure raw backend message/stack trace is not shown to user
    assert.strictEqual(result.errorMessage, EXPECTED_MESSAGES.SERVER_ERROR);
    assert.ok(!result.errorMessage.includes("SQLITE3"));
  } finally {
    global.fetch = originalFetch;
  }
});

test("Login Feedback - ApiUserProvider maps network failure to connectivity notification", async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    const apiProvider = new ApiUserProvider("http://unreachable-host:9999");
    const result = await apiProvider.authenticateDetailed("admin@birojasa.com", "test");
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCode, "NETWORK_ERROR");
    assert.strictEqual(result.errorMessage, EXPECTED_MESSAGES.NETWORK_ERROR);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Login Feedback - ApiUserProvider maps abort timeout to network/timeout notification", async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => {
      const abortErr = new Error("The operation was aborted");
      abortErr.name = "AbortError";
      throw abortErr;
    };

    const apiProvider = new ApiUserProvider("http://slow-host:9999");
    const result = await apiProvider.authenticateDetailed("admin@birojasa.com", "test");
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCode, "TIMEOUT_ERROR");
    assert.strictEqual(result.errorMessage, EXPECTED_MESSAGES.NETWORK_ERROR);
  } finally {
    global.fetch = originalFetch;
  }
});
