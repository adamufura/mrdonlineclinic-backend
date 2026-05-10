import type { Types } from 'mongoose';
import type { Server as SocketServer } from 'socket.io';

export type AuthRole = 'PATIENT' | 'PRACTITIONER' | 'ADMIN';
export type AdminRole = 'SUPER_ADMIN' | 'ADMIN';

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
