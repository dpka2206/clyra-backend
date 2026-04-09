import { Schema, Types, model } from "mongoose";

const auditLogSchema = new Schema(
  {
    actorUserId: {
      type: Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    action: { type: String, required: true, trim: true, index: true },
    entityType: { type: String, required: true, trim: true, index: true },
    entityId: { type: String, required: true, trim: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: null },
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

export const AuditLogModel = model("AuditLog", auditLogSchema);
