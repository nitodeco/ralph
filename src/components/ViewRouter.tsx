import type { DryRunState } from "@/hooks/useDryRun.ts";
import type { ActiveView, AppState, RalphConfig, Session, ValidationWarning } from "@/types.ts";
import { AddTaskWizard } from "./AddTaskWizard.tsx";
import type { CommandArgs, SlashCommand } from "./CommandInput.tsx";
import { HelpView } from "./HelpView.tsx";
import { InitWizard } from "./InitWizard.tsx";
import { SetupWizard } from "./SetupWizard.tsx";
import { UpdatePrompt } from "./UpdatePrompt.tsx";
import {
	AgentSelectView,
	AnalyzeView,
	ArchiveView,
	DryRunView,
	GuardrailsView,
	MemoryView,
	MigrationPromptView,
	NotInitializedView,
	ProjectsView,
	ResumePromptView,
	StatusView,
	TasksView,
} from "./views/index.ts";

interface ViewRouterProps {
	activeView: ActiveView;
	version: string;
	appState: AppState;
	config: RalphConfig | null;
	projectName?: string;
	pendingSession: Session | null;
	validationWarning: ValidationWarning | null;
	needsMigration: boolean;
	dryRun: boolean;
	dryRunState: DryRunState;
	onViewComplete: () => void;
	onHelpClose: () => void;
	onCommand: (command: SlashCommand, args?: CommandArgs) => void;
	onMigrationComplete: () => void;
	onMigrationSkip: () => void;
	children: React.ReactNode;
}

export function ViewRouter({
	activeView,
	version,
	appState,
	config,
	projectName,
	pendingSession,
	validationWarning,
	needsMigration,
	dryRun,
	dryRunState,
	onViewComplete,
	onHelpClose,
	onCommand,
	onMigrationComplete,
	onMigrationSkip,
	children,
}: ViewRouterProps): React.ReactElement {
	if (activeView === "init") {
		return <InitWizard version={version} onComplete={onViewComplete} />;
	}

	if (activeView === "setup") {
		return <SetupWizard version={version} onComplete={onViewComplete} />;
	}

	if (activeView === "update") {
		return <UpdatePrompt version={version} forceCheck onComplete={onViewComplete} />;
	}

	if (activeView === "help") {
		return <HelpView version={version} onClose={onHelpClose} />;
	}

	if (activeView === "add") {
		return <AddTaskWizard version={version} onComplete={onViewComplete} />;
	}

	if (activeView === "status") {
		return <StatusView version={version} onClose={onHelpClose} />;
	}

	if (activeView === "archive") {
		return <ArchiveView version={version} onClose={onViewComplete} />;
	}

	if (activeView === "guardrails") {
		return <GuardrailsView version={version} onClose={onHelpClose} />;
	}

	if (activeView === "analyze") {
		return <AnalyzeView version={version} onClose={onHelpClose} />;
	}

	if (activeView === "memory") {
		return <MemoryView version={version} onClose={onHelpClose} />;
	}

	if (activeView === "agent") {
		return <AgentSelectView version={version} onClose={onViewComplete} />;
	}

	if (activeView === "tasks") {
		return <TasksView version={version} onClose={onHelpClose} />;
	}

	if (activeView === "projects") {
		return <ProjectsView version={version} onClose={onHelpClose} />;
	}

	if (activeView === "migration_prompt" && needsMigration) {
		return (
			<MigrationPromptView
				version={version}
				config={config}
				projectName={projectName}
				onMigrationComplete={onMigrationComplete}
				onSkip={onMigrationSkip}
			/>
		);
	}

	if (dryRun) {
		return (
			<DryRunView
				version={version}
				config={config}
				projectName={projectName}
				dryRunState={dryRunState}
			/>
		);
	}

	if (appState === "not_initialized" && validationWarning) {
		return (
			<NotInitializedView
				version={version}
				validationWarning={validationWarning}
				onCommand={onCommand}
			/>
		);
	}

	if (appState === "resume_prompt" && pendingSession) {
		return (
			<ResumePromptView
				version={version}
				config={config}
				projectName={projectName}
				pendingSession={pendingSession}
				onCommand={onCommand}
			/>
		);
	}

	return <>{children}</>;
}
