const { withPodfile } = require("@expo/config-plugins");

module.exports = function withModularHeaders(config) {
  return withPodfile(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes("use_modular_headers!")) {
      return config;
    }

    const platformRegex = /platform :ios,.*\n/;
    if (platformRegex.test(contents)) {
      config.modResults.contents = contents.replace(
        platformRegex,
        (match) => `${match}use_modular_headers!\n`
      );
      return config;
    }

    config.modResults.contents = `use_modular_headers!\n${contents}`;
    return config;
  });
};
