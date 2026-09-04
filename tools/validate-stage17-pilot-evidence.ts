import { getStage17PilotEvidenceReport, validateStage17PilotEvidence } from "./validate-stage17-pilot-evidence-lib";

const jsonMode = process.argv.includes("--json");

if (jsonMode) {
	const report = getStage17PilotEvidenceReport();
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	if (!report.ok) {
		process.exitCode = 1;
	}
} else {
	validateStage17PilotEvidence();
}
