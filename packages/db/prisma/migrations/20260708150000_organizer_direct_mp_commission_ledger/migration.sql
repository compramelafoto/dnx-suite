-- CLF-ORGANIZER-AS-COLLECTOR-100: estados para cobro directo MP del organizador (sin retiro manual)
ALTER TYPE "EventOrganizerCommissionStatus" ADD VALUE IF NOT EXISTS 'PAID_DIRECT_TO_ORGANIZER';
ALTER TYPE "EventOrganizerCommissionPayoutMode" ADD VALUE IF NOT EXISTS 'ORGANIZER_AS_COLLECTOR';
