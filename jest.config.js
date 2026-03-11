module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
  testTimeout: 10000,
  moduleNameMapper: {
    "^supernote-cloud-api$": "<rootDir>/tests/__mocks__/supernote-cloud-api.js",
  },
};
