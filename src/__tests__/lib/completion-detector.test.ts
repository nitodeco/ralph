import { describe, expect, it } from "bun:test";
import { createCompletionDetector } from "@/lib/completion-detector.ts";

describe("createCompletionDetector", () => {
	const MARKER = "<<COMPLETE>>";

	it("detects marker in a single chunk", () => {
		const detector = createCompletionDetector(MARKER);

		detector.feed("Some output text <<COMPLETE>> more text");

		expect(detector.isComplete()).toBe(true);
	});

	it("detects marker spanning two chunks", () => {
		const detector = createCompletionDetector(MARKER);

		detector.feed("Some output text <<COMP");
		expect(detector.isComplete()).toBe(false);

		detector.feed("LETE>> more text");
		expect(detector.isComplete()).toBe(true);
	});

	it("detects marker spanning three chunks", () => {
		const detector = createCompletionDetector(MARKER);

		detector.feed("text <<CO");
		expect(detector.isComplete()).toBe(false);

		detector.feed("MPLE");
		expect(detector.isComplete()).toBe(false);

		detector.feed("TE>> end");
		expect(detector.isComplete()).toBe(true);
	});

	it("detects marker at chunk boundary start", () => {
		const detector = createCompletionDetector(MARKER);

		detector.feed("some text");
		expect(detector.isComplete()).toBe(false);

		detector.feed("<<COMPLETE>>");
		expect(detector.isComplete()).toBe(true);
	});

	it("detects marker at chunk boundary end", () => {
		const detector = createCompletionDetector(MARKER);

		detector.feed("text <<COMPLETE>>");
		expect(detector.isComplete()).toBe(true);
	});

	it("returns false when marker is not present", () => {
		const detector = createCompletionDetector(MARKER);

		detector.feed("Some random output");
		detector.feed("More random output");
		detector.feed("Even more output without the marker");

		expect(detector.isComplete()).toBe(false);
	});

	it("handles empty chunks", () => {
		const detector = createCompletionDetector(MARKER);

		detector.feed("");
		expect(detector.isComplete()).toBe(false);

		detector.feed("<<COMPLETE>>");
		expect(detector.isComplete()).toBe(true);
	});

	it("handles multiple empty chunks", () => {
		const detector = createCompletionDetector(MARKER);

		detector.feed("");
		detector.feed("");
		detector.feed("<<COMPLETE>>");
		detector.feed("");

		expect(detector.isComplete()).toBe(true);
	});

	it("reset clears state and allows re-detection", () => {
		const detector = createCompletionDetector(MARKER);

		detector.feed("<<COMPLETE>>");
		expect(detector.isComplete()).toBe(true);

		detector.reset();
		expect(detector.isComplete()).toBe(false);

		detector.feed("new stream <<COMPLETE>>");
		expect(detector.isComplete()).toBe(true);
	});

	it("does not detect partial markers", () => {
		const detector = createCompletionDetector(MARKER);

		detector.feed("<<COMPLETE");
		expect(detector.isComplete()).toBe(false);

		detector.feed("X>>");
		expect(detector.isComplete()).toBe(false);
	});

	it("handles marker appearing character by character", () => {
		const detector = createCompletionDetector(MARKER);

		for (const char of MARKER) {
			detector.feed(char);
		}

		expect(detector.isComplete()).toBe(true);
	});

	it("stops processing after marker is found", () => {
		const detector = createCompletionDetector(MARKER);

		detector.feed("<<COMPLETE>>");
		expect(detector.isComplete()).toBe(true);

		detector.feed("more text that should be ignored");
		expect(detector.isComplete()).toBe(true);
	});

	it("works with different marker strings", () => {
		const customMarker = "===END===";
		const detector = createCompletionDetector(customMarker);

		detector.feed("output ===END=== done");

		expect(detector.isComplete()).toBe(true);
	});

	it("handles marker with special characters", () => {
		const specialMarker = "[DONE]\n";
		const detector = createCompletionDetector(specialMarker);

		detector.feed("output [DONE]\n");

		expect(detector.isComplete()).toBe(true);
	});

	it("detects marker appearing after false start", () => {
		const detector = createCompletionDetector(MARKER);

		detector.feed("<<COM");
		expect(detector.isComplete()).toBe(false);

		detector.feed("something else <<COMPLETE>>");
		expect(detector.isComplete()).toBe(true);
	});
});
