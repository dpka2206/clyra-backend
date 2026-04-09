import { Types } from "mongoose";

import { AuditLogModel } from "../../models/AuditLog.js";

export async function createAuditLog(input: {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: unknown;
}) {
  return AuditLogModel.create({
    actorUserId: input.actorUserId ? new Types.ObjectId(input.actorUserId) : undefined,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata,
  });
}
