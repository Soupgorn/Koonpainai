import base from "../../playwright.config";
const config = { ...base, testDir: "../../tests/browser", outputDir: "./test-results", webServer: undefined };
export default config;
