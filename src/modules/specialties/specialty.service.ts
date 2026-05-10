import type { Types } from 'mongoose';
import { ConflictError, NotFoundError } from '../../shared/errors';
import { buildMeta, skipForPage } from '../../shared/pagination';
import { PractitionerModel } from '../users/user.model';
import { SpecialtyModel } from './specialty.model';
import type { SpecialtyDto } from './specialty.types';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function toDto(doc: { _id: Types.ObjectId; name: string; slug: string; description?: string; icon?: string; isActive: boolean }): SpecialtyDto {
  return {
    id: String(doc._id),
    name: doc.name,
    slug: doc.slug,
    description: doc.description,
    icon: doc.icon,
    isActive: doc.isActive,
  };
}

export async function listPublicSpecialties() {
  const rows = await SpecialtyModel.find({ isActive: true }).sort({ name: 1 }).lean();
  return rows.map((r) => toDto(r as never));
}

export async function listAdminSpecialties(page: number, limit: number, activeOnly?: boolean) {
  const filter = activeOnly ? { isActive: true } : {};
  const total = await SpecialtyModel.countDocuments(filter);
  const rows = await SpecialtyModel.find(filter)
    .sort({ name: 1 })
    .skip(skipForPage(page, limit))
    .limit(limit)
    .lean();
  return { items: rows.map((r) => toDto(r as never)), meta: buildMeta(total, page, limit) };
}

export async function createSpecialty(
  body: { name: string; description?: string; icon?: string },
  adminId: Types.ObjectId,
) {
  const slug = slugify(body.name);
  const exists = await SpecialtyModel.exists({ $or: [{ slug }, { name: body.name }] });
  if (exists) throw new ConflictError('Specialty name or slug already exists');
  const doc = await SpecialtyModel.create({ ...body, slug, createdBy: adminId, isActive: true });
  return toDto(doc.toObject() as never);
}

export async function updateSpecialty(id: string, body: { name?: string; description?: string; icon?: string; isActive?: boolean }) {
  const doc = await SpecialtyModel.findById(id);
  if (!doc) throw new NotFoundError('Specialty not found');

  if (body.name) {
    const slug = slugify(body.name);
    const clash = await SpecialtyModel.exists({ _id: { $ne: doc._id }, $or: [{ slug }, { name: body.name }] });
    if (clash) throw new ConflictError('Specialty name already in use');
    doc.name = body.name;
    doc.slug = slug;
  }
  if (body.description !== undefined) doc.description = body.description;
  if (body.icon !== undefined) doc.icon = body.icon;
  if (body.isActive !== undefined) doc.isActive = body.isActive;
  await doc.save();
  return toDto(doc.toObject() as never);
}

export async function softDeleteOrDeactivateSpecialty(id: string) {
  const doc = await SpecialtyModel.findById(id);
  if (!doc) throw new NotFoundError('Specialty not found');

  const inUse = await PractitionerModel.exists({ specialties: doc._id });
  if (inUse) {
    doc.isActive = false;
    await doc.save();
    return { action: 'deactivated' as const, specialty: toDto(doc.toObject() as never) };
  }

  await doc.deleteOne();
  return { action: 'deleted' as const };
}
