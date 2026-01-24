import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const currentDir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(currentDir, "../public");
const faviconDir = join(publicDir, "favicon");
const ogDir = join(publicDir, "og");

const BRAND_COLOR = "#22D3EE";
const BG_COLOR = "#0F1419";

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="6" fill="${BG_COLOR}"/>
  <path d="M8 8h8c3.3 0 6 2.7 6 6 0 2.5-1.5 4.6-3.7 5.5L22 24h-4l-3.5-4H12v4H8V8zm4 8h4c1.1 0 2-.9 2-2s-.9-2-2-2h-4v4z" fill="${BRAND_COLOR}"/>
</svg>`;

const ogImageSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" fill="none">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0e13;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#131920;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#22D3EE;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#06B6D4;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bgGrad)"/>
  <rect x="0" y="0" width="8" height="630" fill="url(#accentGrad)"/>
  <g transform="translate(100, 180)">
    <svg viewBox="0 0 32 32" width="100" height="100">
      <rect width="32" height="32" rx="6" fill="${BG_COLOR}"/>
      <path d="M8 8h8c3.3 0 6 2.7 6 6 0 2.5-1.5 4.6-3.7 5.5L22 24h-4l-3.5-4H12v4H8V8zm4 8h4c1.1 0 2-.9 2-2s-.9-2-2-2h-4v4z" fill="${BRAND_COLOR}"/>
    </svg>
  </g>
  <text x="230" y="245" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="72" font-weight="700" fill="#FFFFFF">Ralph</text>
  <text x="100" y="360" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="32" fill="#9CA3AF">Long-running PRD-driven development</text>
  <text x="100" y="410" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="32" fill="#9CA3AF">with AI coding agents</text>
  <text x="100" y="540" font-family="monospace" font-size="20" fill="${BRAND_COLOR}">github.com/nitodeco/ralph</text>
</svg>`;

async function generateAssets() {
	await mkdir(faviconDir, { recursive: true });
	await mkdir(ogDir, { recursive: true });

	console.log("Generating favicons...");

	await writeFile(join(faviconDir, "favicon.svg"), faviconSvg);
	console.log("  ✓ favicon.svg");

	const faviconBuffer = Buffer.from(faviconSvg);

	await sharp(faviconBuffer)
		.resize(180, 180)
		.png()
		.toFile(join(faviconDir, "apple-touch-icon.png"));
	console.log("  ✓ apple-touch-icon.png (180x180)");

	await sharp(faviconBuffer).resize(32, 32).png().toFile(join(faviconDir, "favicon-32x32.png"));
	console.log("  ✓ favicon-32x32.png");

	await sharp(faviconBuffer).resize(16, 16).png().toFile(join(faviconDir, "favicon-16x16.png"));
	console.log("  ✓ favicon-16x16.png");

	await sharp(faviconBuffer)
		.resize(192, 192)
		.png()
		.toFile(join(faviconDir, "android-chrome-192x192.png"));
	console.log("  ✓ android-chrome-192x192.png");

	await sharp(faviconBuffer)
		.resize(512, 512)
		.png()
		.toFile(join(faviconDir, "android-chrome-512x512.png"));
	console.log("  ✓ android-chrome-512x512.png");

	console.log("\nGenerating OG image...");
	const ogBuffer = Buffer.from(ogImageSvg);

	await sharp(ogBuffer).resize(1200, 630).png({ quality: 90 }).toFile(join(ogDir, "og-image.png"));
	console.log("  ✓ og-image.png (1200x630)");

	await sharp(ogBuffer)
		.resize(1200, 630)
		.webp({ quality: 85 })
		.toFile(join(ogDir, "og-image.webp"));
	console.log("  ✓ og-image.webp (1200x630)");

	const webManifest = {
		name: "Ralph",
		short_name: "Ralph",
		icons: [
			{ src: "/ralph/favicon/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
			{ src: "/ralph/favicon/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
		],
		theme_color: BRAND_COLOR,
		background_color: BG_COLOR,
		display: "standalone",
	};

	await writeFile(join(faviconDir, "site.webmanifest"), JSON.stringify(webManifest, null, 2));
	console.log("  ✓ site.webmanifest");

	console.log("\nAsset generation complete!");
}

generateAssets().catch(console.error);
