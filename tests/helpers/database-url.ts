export function testDatabaseURL() {
  const value = process.env.TEST_DATABASE_URL;
  if (!value)
    throw new Error(
      "Set TEST_DATABASE_URL to an isolated PostgreSQL database ending in _test before running integration or browser tests.",
    );
  const url = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.pathname.endsWith("_test")
  ) {
    throw new Error(
      "TEST_DATABASE_URL must name a dedicated PostgreSQL database ending in _test; the development database will not be used.",
    );
  }
  return value;
}
