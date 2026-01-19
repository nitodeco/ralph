#!/usr/bin/env bun

import { program } from "commander";
import { initCommand } from "./commands/init.ts";
import { runCommand } from "./commands/run.ts";

const VERSION = "1.0.0";

program
	.name("ralph")
	.description("A CLI tool for long-running PRD-driven development with Cursor AI")
	.version(VERSION);

program
	.command("run [iterations]")
	.description("Run the agent loop for the specified number of iterations (default: 10)")
	.action(runCommand);

program
	.command("init")
	.description("Initialize a new PRD project with prd.json and progress.txt")
	.action(initCommand);

program.parse();
