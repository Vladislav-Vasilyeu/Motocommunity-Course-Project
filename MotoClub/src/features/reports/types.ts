export type ReportTargetType = 'USER' | 'POST' | 'LISTING' | 'COMMUNITY'
export type ReportStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED'
export type ReportAction = 'DISMISS' | 'RESOLVE' | 'DELETE_TARGET'
export type Report = {
  id: string; targetType: ReportTargetType; targetId: string; targetTitle: string; reason: string
  status: ReportStatus; createdAt: string; reviewedAt: string | null; note: string; action: ReportAction | null
  reporter?: { id: string; displayName: string }; reviewer?: { id: string; displayName: string } | null
}
