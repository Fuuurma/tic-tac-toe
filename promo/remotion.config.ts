import { Config } from "@remotion/cli/config";

// JPEG frames are what h264 consumes anyway; PNG only matters for alpha.
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
// Shared 16 GB machine: two render tabs, not one per core.
Config.setConcurrency(2);
