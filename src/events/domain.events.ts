import { EventEmitter } from 'events';

export type DomainEventMap = {
  AppointmentConfirmed: { appointmentId: string; patientId: string; practitionerId: string };
  AppointmentCancelled: { appointmentId: string; patientId: string; practitionerId: string };
  PrescriptionIssued: { prescriptionId: string; patientId: string };
  AdminInvited: { email: string; token: string };
  EmailVerificationRequested: { email: string; token: string };
  PasswordResetRequested: { email: string; token: string };
  PractitionerVerified: { practitionerId: string };
};

class TypedEmitter extends EventEmitter {
  emitTyped<K extends keyof DomainEventMap>(event: K, payload: DomainEventMap[K]): boolean {
    return this.emit(event, payload);
  }

  onTyped<K extends keyof DomainEventMap>(event: K, listener: (payload: DomainEventMap[K]) => void): this {
    return this.on(event, listener as (...args: unknown[]) => void);
  }
}

export const domainEvents = new TypedEmitter();
