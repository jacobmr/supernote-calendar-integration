/**
 * Mock for supernote-cloud-api ESM module
 * Used for testing without requiring actual ESM support
 */

module.exports = {
  login: jest.fn(),
  fileList: jest.fn(),
  fileUrl: jest.fn(),
  syncFiles: jest.fn(),
};
