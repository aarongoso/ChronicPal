module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.test.js"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { module: "commonjs" } }]
  },
  setupFiles: ["<rootDir>/src/tests/jestSetup.js"],
};
