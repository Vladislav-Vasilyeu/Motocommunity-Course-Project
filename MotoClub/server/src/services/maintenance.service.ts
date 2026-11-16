import { prisma } from "../db/client.js";
import { Prisma, type MaintenanceRecord } from "../generated/prisma/client.js";

type MaintenanceInput = {
  title: string;
  date: Date;
  mileage: number | null;
  cost: number | null;
  notes: string | null;
};

function serialize(record: MaintenanceRecord) {
  return { ...record, date: record.date.toISOString().slice(0, 10), cost: record.cost?.toNumber() ?? null };
}

export async function listMaintenance(ownerId: string, motorcycleId: string) {
  const motorcycle = await prisma.motorcycle.findUnique({
    where: { id: motorcycleId, ownerId },
    select: {
      id: true,
      make: true,
      model: true,
      maintenanceRecords: { orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }] },
    },
  });
  if (!motorcycle) return null;
  const { maintenanceRecords, ...summary } = motorcycle;
  return { motorcycle: summary, records: maintenanceRecords.map(serialize) };
}

export async function createMaintenance(ownerId: string, motorcycleId: string, data: MaintenanceInput) {
  try {
    const record = await prisma.maintenanceRecord.create({
      data: { ...data, motorcycle: { connect: { id: motorcycleId, ownerId } } },
    });
    return serialize(record);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2025", "P2003"].includes(error.code)) return null;
    throw error;
  }
}

export async function updateMaintenance(ownerId: string, motorcycleId: string, recordId: string, data: Partial<MaintenanceInput>) {
  try {
    const record = await prisma.maintenanceRecord.update({
      where: { id: recordId, motorcycleId, motorcycle: { ownerId } },
      data,
    });
    return serialize(record);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return null;
    throw error;
  }
}

export async function deleteMaintenance(ownerId: string, motorcycleId: string, recordId: string) {
  const result = await prisma.maintenanceRecord.deleteMany({
    where: { id: recordId, motorcycleId, motorcycle: { ownerId } },
  });
  return result.count > 0;
}
