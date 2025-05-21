// server/types/financials.d.ts

// Interface for individual line items
export interface FinancialLineItem {
  account: string; // e.g., "1100"
  description: string;
  total: number | null; // Using number for actual values, null for placeholders initially
}

// Main categories mirroring "THE BEAST" template
export interface AboveTheLine {
  storyRights: FinancialLineItem;
  producer: FinancialLineItem;
  director: FinancialLineItem;
  castAndStunts: FinancialLineItem;
  fringes: FinancialLineItem;
  total: number | null;
}

export interface BelowTheLineProduction {
  productionStaff: FinancialLineItem;
  extrasStandins: FinancialLineItem;
  setDesign: FinancialLineItem;
  setConstruction: FinancialLineItem;
  setOperations: FinancialLineItem;
  specialEffects: FinancialLineItem;
  setDressing: FinancialLineItem;
  props: FinancialLineItem;
  wardrobe: FinancialLineItem;
  ledVirtual: FinancialLineItem;
  makeupHairdressing: FinancialLineItem;
  setLighting: FinancialLineItem;
  camera: FinancialLineItem;
  productionSound: FinancialLineItem;
  transportation: FinancialLineItem;
  locationExpenses: FinancialLineItem;
  pictureVehiclesAnimals: FinancialLineItem;
  productionFilmLab: FinancialLineItem;
  miscProduction: FinancialLineItem; // "MISC" in template
  healthSafety: FinancialLineItem;
  overtime: FinancialLineItem;
  studioEquipmentFacilities: FinancialLineItem;
  tests: FinancialLineItem;
  btlTravelLiving: FinancialLineItem; // "BTL T&L"
  serviceCompany: FinancialLineItem;
  fringes: FinancialLineItem;
  total: number | null;
}

export interface PostProduction {
  filmEditing: FinancialLineItem;
  music: FinancialLineItem;
  sound: FinancialLineItem;
  filmLabPost: FinancialLineItem; // "FILM&LAB"
  titles: FinancialLineItem;
  vfx: FinancialLineItem;
  fringes: FinancialLineItem;
  total: number | null;
}

export interface OtherBelowTheLine {
  publicity: FinancialLineItem;
  insurance: FinancialLineItem;
  miscExpenses: FinancialLineItem;
  legalAccounting: FinancialLineItem;
  fringes: FinancialLineItem;
  total: number | null;
}

// The main financial breakdown structure
export interface FinancialBreakdown {
  projectName: string | null;
  expectedReleaseDate: string | null; // YYYY-MM-DD
  location: string | null; // e.g., "ATHENS, GREECE"
  prepWeeks: number | null; // e.g., 12
  shootDays: string | null; // e.g., "30 DAYS (15 ACTION UNIT, 15 LED STAGE)"
  unions: string | null; // e.g., "DGA, WGA, SAG"

  aboveTheLine: AboveTheLine;
  belowTheLineProduction: BelowTheLineProduction;
  postProduction: PostProduction;
  otherBelowTheLine: OtherBelowTheLine; // Corresponds to "Total Below-The-Line Other"

  bondFee: FinancialLineItem;
  contingency: FinancialLineItem;

  // Summary Totals from the template
  summaryTotalAboveTheLine: number | null; // Matches "Total Above-The-Line"
  summaryTotalBelowTheLine: number | null; // Matches "Total Below-The-Line" (Production + Post + Other)
  summaryTotalAboveAndBelowTheLine: number | null; // Matches "Total Above and Below-The-Line"
  summaryGrandTotal: number | null; // Matches "Grand Total" (includes contingency and bond)

  // New fields for Vadis-specific analysis
  totalBudgetInput: number | null; // The user-inputted total budget
  estimatedBrandSponsorshipValue: number | null;
  estimatedLocationIncentiveValue: number | null;
  netExternalCapitalRequired: number | null;
}