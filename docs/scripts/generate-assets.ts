import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const currentDir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(currentDir, "../public");
const faviconDir = join(publicDir, "favicon");
const ogDir = join(publicDir, "og");
const wordmarkPath = join(publicDir, "ralph.webp");
const rLetterPath = join(publicDir, "r.png");

const BRAND_COLOR = "#576ddc";
const BG_COLOR = "#0F1419";

const WORDMARK_WIDTH = 530;
const WORDMARK_HEIGHT = 157;

async function extractRLetterSquare(sizeInPx: number): Promise<Uint8Array> {
	return sharp(rLetterPath)
		.resize(sizeInPx, sizeInPx)
		.png()
		.toBuffer()
		.then((buffer) => new Uint8Array(buffer));
}

async function generateOgImage(): Promise<{ png: Uint8Array; webp: Uint8Array }> {
	const ogWidthInPx = 1_200;
	const ogHeightInPx = 630;

	const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ogWidthInPx} ${ogHeightInPx}">
		<defs>
			<linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
				<stop offset="0%" style="stop-color:#0a0e13" />
				<stop offset="100%" style="stop-color:#131920" />
			</linearGradient>
			<linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
				<stop offset="0%" style="stop-color:#576ddc" />
				<stop offset="100%" style="stop-color:#4a5fc7" />
			</linearGradient>
		</defs>
		<rect width="${ogWidthInPx}" height="${ogHeightInPx}" fill="url(#bgGrad)"/>
		<rect x="0" y="0" width="8" height="${ogHeightInPx}" fill="url(#accentGrad)"/>
	</svg>`;

	const wordmarkScaleFactor = 1.6;
	const scaledWordmarkWidth = Math.round(WORDMARK_WIDTH * wordmarkScaleFactor);
	const scaledWordmarkHeight = Math.round(WORDMARK_HEIGHT * wordmarkScaleFactor);
	const wordmarkLeftOffset = Math.round((ogWidthInPx - scaledWordmarkWidth) / 2);
	const wordmarkTopOffset = 140;

	const scaledWordmark = await sharp(wordmarkPath)
		.resize(scaledWordmarkWidth, scaledWordmarkHeight)
		.toBuffer();

	const taglineSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ogWidthInPx}" height="150">
		<text x="600" y="50" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="36" fill="#9CA3AF">Long-running PRD-driven development</text>
		<text x="600" y="100" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="36" fill="#9CA3AF">with AI coding agents</text>
	</svg>`;

	const footerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ogWidthInPx}" height="50">
		<text x="600" y="30" text-anchor="middle" font-family="monospace" font-size="22" fill="${BRAND_COLOR}">github.com/nitodeco/ralph</text>
	</svg>`;

	const composited = await sharp(Buffer.from(bgSvg))
		.resize(ogWidthInPx, ogHeightInPx)
		.composite([
			{
				input: scaledWordmark,
				left: wordmarkLeftOffset,
				top: wordmarkTopOffset,
			},
			{
				input: Buffer.from(taglineSvg),
				left: 0,
				top: 380,
			},
			{
				input: Buffer.from(footerSvg),
				left: 0,
				top: 540,
			},
		])
		.toBuffer();

	const png = new Uint8Array(await sharp(composited).png({ quality: 90 }).toBuffer());
	const webp = new Uint8Array(await sharp(composited).webp({ quality: 85 }).toBuffer());

	return { png, webp };
}

async function generateAssets() {
	await mkdir(faviconDir, { recursive: true });
	await mkdir(ogDir, { recursive: true });

	const faviconSvgPath = join(faviconDir, "favicon.svg");

	try {
		await rm(faviconSvgPath);
		console.log("  ✓ Removed obsolete favicon.svg");
	} catch {
		// File doesn't exist, ignore
	}

	console.log("Generating favicons from ralph.webp...");

	const favicon16 = await extractRLetterSquare(16);

	await writeFile(join(faviconDir, "favicon-16x16.png"), favicon16);
	console.log("  ✓ favicon-16x16.png");

	const favicon32 = await extractRLetterSquare(32);

	await writeFile(join(faviconDir, "favicon-32x32.png"), favicon32);
	console.log("  ✓ favicon-32x32.png");

	const appleTouchIcon = await extractRLetterSquare(180);

	await writeFile(join(faviconDir, "apple-touch-icon.png"), appleTouchIcon);
	console.log("  ✓ apple-touch-icon.png (180x180)");

	const androidChrome192 = await extractRLetterSquare(192);

	await writeFile(join(faviconDir, "android-chrome-192x192.png"), androidChrome192);
	console.log("  ✓ android-chrome-192x192.png");

	const androidChrome512 = await extractRLetterSquare(512);

	await writeFile(join(faviconDir, "android-chrome-512x512.png"), androidChrome512);
	console.log("  ✓ android-chrome-512x512.png");

	console.log("\nGenerating OG image from ralph.webp...");
	const ogImages = await generateOgImage();

	await writeFile(join(ogDir, "og-image.png"), ogImages.png);
	console.log("  ✓ og-image.png (1200x630)");

	await writeFile(join(ogDir, "og-image.webp"), ogImages.webp);
	console.log("  ✓ og-image.webp (1200x630)");

	console.log("\nGenerating webmanifest...");
	const webManifest = {
		name: "Ralph",
		short_name: "Ralph",
		icons: [
			{ src: "/favicon/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
			{ src: "/favicon/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
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
