type CardPatchLikePayload = {
  assigneeIds?: string[];
  labelIds?: string[];
} & Record<string, unknown>;

export type CardPatchExecutionPlan = {
  shouldUpdateAssignees: boolean;
  shouldUpdateLabels: boolean;
  shouldRunLabelAutomation: boolean;
  shouldLookupAssigneesForAutomation: boolean;
  shouldNotifyAssignees: boolean;
  shouldResolveWorkspace: boolean;
};

export function buildCardPatchExecutionPlan(
  payload: CardPatchLikePayload,
  actorUserId: string,
): CardPatchExecutionPlan {
  const shouldUpdateAssignees = payload.assigneeIds !== undefined;
  const shouldUpdateLabels = payload.labelIds !== undefined;
  const shouldRunLabelAutomation = Boolean(payload.labelIds?.length);
  const shouldLookupAssigneesForAutomation =
    shouldRunLabelAutomation && !shouldUpdateAssignees;
  const shouldNotifyAssignees = Boolean(
    payload.assigneeIds?.some((assigneeId) => assigneeId !== actorUserId),
  );
  const shouldResolveWorkspace =
    shouldRunLabelAutomation || shouldNotifyAssignees;

  return {
    shouldUpdateAssignees,
    shouldUpdateLabels,
    shouldRunLabelAutomation,
    shouldLookupAssigneesForAutomation,
    shouldNotifyAssignees,
    shouldResolveWorkspace,
  };
}

export function buildCardUpdatedActivityMetadata(
  payload: Record<string, unknown>,
  plan: Pick<CardPatchExecutionPlan, "shouldUpdateAssignees" | "shouldUpdateLabels">,
): Record<string, unknown> {
  const metadata = { ...payload };

  if (!plan.shouldUpdateAssignees) {
    delete metadata.assigneeIds;
  }
  if (!plan.shouldUpdateLabels) {
    delete metadata.labelIds;
  }

  return metadata;
}
