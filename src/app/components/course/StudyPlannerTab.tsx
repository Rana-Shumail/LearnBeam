import type { StoredStudyPlan } from "../../../lib/courseData";
import { StudyPlannerCard } from "./StudyPlannerCard";

export function StudyPlannerTab({
  courseColor,
  studyPlan,
  plannerBusy,
  plannerError,
  onRefreshStudyPlan,
  onExportStudyPlan,
  onToggleStudySession,
}: {
  courseColor: string;
  studyPlan: StoredStudyPlan | null;
  plannerBusy: boolean;
  plannerError: string | null;
  onRefreshStudyPlan: () => void;
  onExportStudyPlan: () => void;
  onToggleStudySession: (sessionId: string) => void;
}) {
  return (
    <StudyPlannerCard
      courseColor={courseColor}
      studyPlan={studyPlan}
      busy={plannerBusy}
      error={plannerError}
      onRefresh={onRefreshStudyPlan}
      onExport={onExportStudyPlan}
      onToggleSession={onToggleStudySession}
    />
  );
}
