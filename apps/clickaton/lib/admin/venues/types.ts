import { toDateTimeLocalValue } from "@/lib/admin/datetime-input";

export type ClickatonVenueRecord = {
  id: string;
  editionId: string;
  name: string;
  slug: string;
  city: string;
  provinceOrState: string | null;
  country: string;
  address: string | null;
  meetingPoint: string | null;
  capacity: number | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  edition?: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
};

export type ClickatonVenueFormInput = {
  editionId: string;
  name: string;
  slug: string;
  city: string;
  provinceOrState: string;
  country: string;
  address: string;
  meetingPoint: string;
  capacity: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

export function emptyVenueFormInput(editionId = ""): ClickatonVenueFormInput {
  return {
    editionId,
    name: "",
    slug: "",
    city: "",
    provinceOrState: "",
    country: "AR",
    address: "",
    meetingPoint: "",
    capacity: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    startsAt: "",
    endsAt: "",
    isActive: true,
  };
}

export function venueToFormInput(venue: ClickatonVenueRecord): ClickatonVenueFormInput {
  return {
    editionId: venue.editionId,
    name: venue.name,
    slug: venue.slug,
    city: venue.city,
    provinceOrState: venue.provinceOrState ?? "",
    country: venue.country,
    address: venue.address ?? "",
    meetingPoint: venue.meetingPoint ?? "",
    capacity:
      venue.capacity === null || venue.capacity === undefined ? "" : String(venue.capacity),
    contactName: venue.contactName ?? "",
    contactEmail: venue.contactEmail ?? "",
    contactPhone: venue.contactPhone ?? "",
    startsAt: toDateTimeLocalValue(venue.startsAt),
    endsAt: toDateTimeLocalValue(venue.endsAt),
    isActive: venue.isActive,
  };
}
