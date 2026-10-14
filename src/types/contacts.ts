export interface FamilyContact {
  id: string;
  name: string;
  relation: string;
  phone: string;
  isPrimary: boolean;
}

export interface EmergencyConfig {
  family: FamilyContact[];
  ambulance: string;
}
