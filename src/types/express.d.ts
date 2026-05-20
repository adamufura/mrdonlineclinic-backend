import type { Types } from 'mongoose';
import type { Server as SocketServer } from 'socket.io';

export type AuthRole = 'PATIENT' | 'PRACTITIONER' | 'ADMIN';
import type { AdminRole as MinistryAdminRole } from '../config/admin-rbac';

export type AdminRole = MinistryAdminRole;

declare module 'express-serve-static-core' {
  interface Locals {
    io?: SocketServer;
  }
  interface Request {
    user?: {
      id: Types.ObjectId;
      role: AuthRole;
      adminRole?: AdminRole;
    };
  }
}

export {};
