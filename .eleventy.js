const yaml = require("js-yaml");
const svgContents = require("eleventy-plugin-svg-contents");

module.exports = function (eleventyConfig) {
  // Don't try to build pages from these files
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("README.md");

  // Keep highlight data files working after conversion from Jekyll
  eleventyConfig.addDataExtension("yaml", (contents) => yaml.load(contents));

  eleventyConfig.addShortcode("newline", function (highlight) {
    return highlight.replaceAll("+n", `<p class="highlight__text">`);
  });

  // Insert SVG contents
  eleventyConfig.addPlugin(svgContents);

  return {
    /* Change value if you'd like to deploy to subdirectory, e.g. "/highlights/"
     * Learn more: https://www.11ty.dev/docs/config/#deploy-to-a-subdirectory-with-a-path-prefix
     */
    pathPrefix: "/",
  };
};
