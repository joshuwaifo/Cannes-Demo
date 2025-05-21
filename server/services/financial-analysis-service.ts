// server/services/financial-analysis-service.ts
import * as storage from "../storage";
import { Script } from "@shared/schema";
import { FinancialBreakdown, FinancialLineItem } from "../types/financials"; // Adjust path if needed

function createLineItem(account: string, description: string, total: number | null = 0): FinancialLineItem {
    return { account, description, total };
}

export async function generateFinancialBreakdown(scriptId: number): Promise<FinancialBreakdown | null> {
    const script = await storage.getScriptById(scriptId);

    if (!script) {
        console.warn(`[FinancialAnalysis] Script with ID ${scriptId} not found.`);
        return null;
    }

    const totalBudgetInput = script.totalBudget ?? 0; // Use 0 if null

    // Initialize with placeholder values, mirroring "THE BEAST" structure
    // For now, all line item totals are 0 or null, except for the main budget.
    // In future tasks, these would be calculated or fetched.
    const breakdown: FinancialBreakdown = {
        projectName: script.title,
        expectedReleaseDate: script.expectedReleaseDate ?? null,
        location: "ATHENS, GREECE", // Placeholder
        prepWeeks: 12, // Placeholder
        shootDays: "30 DAYS (15 ACTION UNIT, 15 LED STAGE)", // Placeholder
        unions: "DGA, WGA, SAG", // Placeholder

        aboveTheLine: {
            storyRights: createLineItem("1100", "STORY & RIGHTS"),
            producer: createLineItem("1300", "PRODUCER"),
            director: createLineItem("1400", "DIRECTOR"),
            castAndStunts: createLineItem("1500", "CAST & STUNTS"),
            fringes: createLineItem("1999", "Total Fringes"),
            total: 0,
        },
        belowTheLineProduction: {
            productionStaff: createLineItem("2000", "PRODUCTION STAFF"),
            extrasStandins: createLineItem("2100", "EXTRAS & STANDINS"),
            setDesign: createLineItem("2200", "SET DESIGN"),
            setConstruction: createLineItem("2300", "SET CONSTRUCTION"),
            setOperations: createLineItem("2500", "SET OPERATIONS"),
            specialEffects: createLineItem("2600", "SPECIAL EFFECTS"),
            setDressing: createLineItem("2700", "SET DRESSING"),
            props: createLineItem("2800", "PROPS"),
            wardrobe: createLineItem("2900", "WARDROBE"),
            ledVirtual: createLineItem("3000", "LED VIRTUAL"),
            makeupHairdressing: createLineItem("3100", "MAKEUP & HAIRDRESSING"),
            setLighting: createLineItem("3200", "SET LIGHTING"),
            camera: createLineItem("3300", "CAMERA"),
            productionSound: createLineItem("3400", "PRODUCTION SOUND"),
            transportation: createLineItem("3500", "TRANSPORTATION"),
            locationExpenses: createLineItem("3600", "LOCATION EXPENSES"),
            pictureVehiclesAnimals: createLineItem("3700", "PICTURE VEHICLES/ANIMALS"),
            productionFilmLab: createLineItem("3800", "PRODUCTION FILM AND LAB"),
            miscProduction: createLineItem("3900", "MISC"),
            healthSafety: createLineItem("3950", "HEALTH AND SAFETY PROTOCOLS"),
            overtime: createLineItem("4100", "OVERTIME"),
            studioEquipmentFacilities: createLineItem("4200", "STUDIO/EQUIPMENT/FACILITIES"),
            tests: createLineItem("4300", "TESTS"),
            btlTravelLiving: createLineItem("4450", "BTL T&L"),
            serviceCompany: createLineItem("4455", "SERVICE COMPANY"),
            fringes: createLineItem("4499", "Total Fringes"),
            total: 0,
        },
        postProduction: {
            filmEditing: createLineItem("4500", "FILM EDITING"),
            music: createLineItem("4600", "MUSIC"),
            sound: createLineItem("4700", "SOUND"),
            filmLabPost: createLineItem("4800", "FILM&LAB"),
            titles: createLineItem("5000", "TITLES"),
            vfx: createLineItem("5100", "VFX"),
            fringes: createLineItem("", "Total Fringes"), // Account missing in template for this fringe
            total: 0,
        },
        otherBelowTheLine: {
            publicity: createLineItem("6500", "PUBLICITY"),
            insurance: createLineItem("6700", "INSURANCE"),
            miscExpenses: createLineItem("6800", "MISC EXPENSES"),
            legalAccounting: createLineItem("7500", "LEGAL & ACCOUNTING"),
            fringes: createLineItem("7699", "Total Fringes"),
            total: 0,
        },
        bondFee: createLineItem("9000", "BOND FEE"),
        contingency: createLineItem("9100", "CONTINGENCY", totalBudgetInput * 0.10), // Example: 10% of total budget input

        // Summary totals - these would normally be calculated from the line items.
        // For now, they are placeholders or simple copies.
        summaryTotalAboveTheLine: 0, // Placeholder
        summaryTotalBelowTheLine: 0,  // Placeholder (sum of BTL Prod + Post + Other BTL)
        summaryTotalAboveAndBelowTheLine: 0, // Placeholder
        summaryGrandTotal: totalBudgetInput, // For now, this is the main figure we have

        // Vadis-specific fields
        totalBudgetInput: totalBudgetInput,
        estimatedBrandSponsorshipValue: 0, // Placeholder
        estimatedLocationIncentiveValue: 0, // Placeholder
        netExternalCapitalRequired: totalBudgetInput, // Initially, all of it
    };

    // Basic summation for section totals (currently summing up mostly zeros)
    breakdown.aboveTheLine.total = Object.values(breakdown.aboveTheLine)
        .filter(item => typeof item === 'object' && item && typeof item.total === 'number' && item.description !== 'Total Fringes') // Exclude fringes from direct sum into ATL total for now if they are separate
        .reduce((sum, item) => sum + (item as FinancialLineItem).total!, 0) + (breakdown.aboveTheLine.fringes.total || 0);

    breakdown.belowTheLineProduction.total = Object.values(breakdown.belowTheLineProduction)
        .filter(item => typeof item === 'object' && item && typeof item.total === 'number' && item.description !== 'Total Fringes')
        .reduce((sum, item) => sum + (item as FinancialLineItem).total!, 0) + (breakdown.belowTheLineProduction.fringes.total || 0);

    breakdown.postProduction.total = Object.values(breakdown.postProduction)
        .filter(item => typeof item === 'object' && item && typeof item.total === 'number' && item.description !== 'Total Fringes')
        .reduce((sum, item) => sum + (item as FinancialLineItem).total!, 0) + (breakdown.postProduction.fringes.total || 0);

    breakdown.otherBelowTheLine.total = Object.values(breakdown.otherBelowTheLine)
        .filter(item => typeof item === 'object' && item && typeof item.total === 'number' && item.description !== 'Total Fringes')
        .reduce((sum, item) => sum + (item as FinancialLineItem).total!, 0) + (breakdown.otherBelowTheLine.fringes.total || 0);

    // Summary Totals from template:
    breakdown.summaryTotalAboveTheLine = breakdown.aboveTheLine.total;
    breakdown.summaryTotalBelowTheLine = (breakdown.belowTheLineProduction.total || 0) + 
                                       (breakdown.postProduction.total || 0) + 
                                       (breakdown.otherBelowTheLine.total || 0);
    breakdown.summaryTotalAboveAndBelowTheLine = (breakdown.summaryTotalAboveTheLine || 0) + 
                                               (breakdown.summaryTotalBelowTheLine || 0);
    // Grand Total based on the template structure should ideally be summaryTotalAboveAndBelowTheLine + contingency + bondFee.
    // However, since we only have totalBudgetInput reliably, we'll adjust.
    // If these were real numbers, this sum would ideally match totalBudgetInput.
    // For now, let's keep grandTotal aligned with what user input, and contingency can be part of that.
    breakdown.summaryGrandTotal = (breakdown.summaryTotalAboveAndBelowTheLine || 0) + 
                                  (breakdown.contingency.total || 0) + 
                                  (breakdown.bondFee.total || 0);

    // If the summaryGrandTotal is 0 because all line items are 0, but we have a totalBudgetInput,
    // set summaryGrandTotal to totalBudgetInput. This makes more sense for the initial placeholder state.
    if (breakdown.summaryGrandTotal === 0 && totalBudgetInput > 0) {
        breakdown.summaryGrandTotal = totalBudgetInput;
        // If contingency wasn't specifically set based on totalBudgetInput, we might set it here if not done above.
        if (!breakdown.contingency.total && totalBudgetInput > 0) {
             breakdown.contingency.total = totalBudgetInput * 0.10; // Recalculate if it was 0
             // Re-update grand total if contingency changed
             breakdown.summaryGrandTotal = (breakdown.summaryTotalAboveAndBelowTheLine || 0) + 
                                           (breakdown.contingency.total || 0) + 
                                           (breakdown.bondFee.total || 0);
             if (breakdown.summaryGrandTotal === (breakdown.contingency.total || 0) + (breakdown.bondFee.total || 0) && totalBudgetInput > 0) {
                breakdown.summaryGrandTotal = totalBudgetInput; // If ATL/BTL are zero, Grand Total is just budget.
             }
        }
    }


    // Vadis Specific Calculations (will be more meaningful later)
    breakdown.netExternalCapitalRequired = 
        (breakdown.summaryGrandTotal || 0) - 
        (breakdown.estimatedBrandSponsorshipValue || 0) - 
        (breakdown.estimatedLocationIncentiveValue || 0);


    return breakdown;
}